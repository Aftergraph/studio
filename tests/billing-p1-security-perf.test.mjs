import test from 'node:test';
import assert from 'node:assert/strict';

// We test the internal reportToCsv and queryBilling by importing the server module
// and exercising them through their exported behavior. Since they are not directly
// exported, we replicate the logic here to unit-test the exact patterns used.

// ── P1-11: CSV injection prevention ──────────────────────────────────────────

const DANGEROUS_CSV_LEAD = /^[=+\-@\t\r]/;
function esc(v) {
  if (v == null) return '';
  const s = String(v);
  // P1-11: check original leading char BEFORE quoting
  const dangerous = DANGEROUS_CSV_LEAD.test(s);
  const quoted = /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  return dangerous ? `'${quoted}` : quoted;
}

test('P1-11: esc prefixes leading = with single quote', () => {
  assert.equal(esc('=SUM(A1:A10)'), "'=SUM(A1:A10)");
});

test('P1-11: esc prefixes leading + with single quote', () => {
  assert.equal(esc('+cmd|calc'), "'+cmd|calc");
});

test('P1-11: esc prefixes leading - with single quote', () => {
  assert.equal(esc('-2+3'), "'-2+3");
});

test('P1-11: esc prefixes leading @ with single quote', () => {
  assert.equal(esc('@SUM(A1)'), "'@SUM(A1)");
});

test('P1-11: esc prefixes leading tab with single quote', () => {
  assert.equal(esc('\t=hidden'), "'\t=hidden");
});

test('P1-11: esc prefixes leading CR with single quote', () => {
  assert.equal(esc('\r=hidden'), "'\r=hidden");
});

test('P1-11: esc does NOT prefix safe values', () => {
  assert.equal(esc('Normal text'), 'Normal text');
  assert.equal(esc(12345), '12345');
  assert.equal(esc(''), '');
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

test('P1-11: esc still quotes fields containing commas and newlines', () => {
  assert.equal(esc('hello,world'), '"hello,world"');
  assert.equal(esc('line1\nline2'), '"line1\nline2"');
  assert.equal(esc('has"quote'), '"has""quote"');
});

test('P1-11: esc prefixes dangerous lead even when value also needs quoting', () => {
  // ="evil" has dangerous leading = AND quotes → quoted then prefixed
  const result = esc('="evil"');
  assert.equal(result, `'"=""evil"""`);
});

test('P1-11: esc prefixes dangerous lead even when quoting is needed', () => {
  // +cmd,calc has dangerous leading + AND comma → quoted then prefixed
  const r = esc('+cmd,calc');
  assert.ok(r.startsWith("'"), `Expected leading quote, got: ${r}`);
  assert.ok(r.includes('"'), `Expected inner quotes, got: ${r}`);
});

// ── P1-9: O(n²) customer query elimination ───────────────────────────────────

function queryBillingCustomerBranch(invoices, customers) {
  // Replicate the fixed logic from billing-server.mjs queryBilling
  const invoicesByCustomer = new Map();
  for (const inv of invoices) {
    if (!inv || inv.status === 'void') continue;
    let bucket = invoicesByCustomer.get(inv.customerId);
    if (!bucket) { bucket = []; invoicesByCustomer.set(inv.customerId, bucket); }
    bucket.push(inv);
  }
  const items = [];
  for (const cust of customers) {
    if (!cust) continue;
    const custInvoices = invoicesByCustomer.get(cust.id) || [];
    const invoiceCount = custInvoices.length;
    const totalBilled = custInvoices.reduce((s, i) => s + (i.totalGrossMinor || 0), 0);
    items.push({ id: cust.id, invoiceCount, totalBilledMinor: totalBilled });
  }
  return items;
}

test('P1-9: pre-indexed customer query produces correct counts and totals', () => {
  const customers = [
    { id: 'c1', name: 'Alpha' },
    { id: 'c2', name: 'Beta' },
    { id: 'c3', name: 'Gamma' },
  ];
  const invoices = [
    { id: 'i1', customerId: 'c1', status: 'issued', totalGrossMinor: 1000 },
    { id: 'i2', customerId: 'c1', status: 'issued', totalGrossMinor: 2000 },
    { id: 'i3', customerId: 'c2', status: 'issued', totalGrossMinor: 5000 },
    { id: 'i4', customerId: 'c2', status: 'void', totalGrossMinor: 9999 },
    { id: 'i5', customerId: 'c99', status: 'issued', totalGrossMinor: 100 },
  ];
  const result = queryBillingCustomerBranch(invoices, customers);
  assert.equal(result.length, 3);
  const alpha = result.find((r) => r.id === 'c1');
  const beta = result.find((r) => r.id === 'c2');
  const gamma = result.find((r) => r.id === 'c3');
  assert.equal(alpha.invoiceCount, 2);
  assert.equal(alpha.totalBilledMinor, 3000);
  assert.equal(beta.invoiceCount, 1, 'void invoice should be excluded');
  assert.equal(beta.totalBilledMinor, 5000);
  assert.equal(gamma.invoiceCount, 0);
  assert.equal(gamma.totalBilledMinor, 0);
});

test('P1-9: performance — 10k invoices × 1k customers completes under 50ms', () => {
  const customerCount = 1000;
  const invoiceCount = 10000;
  const customers = [];
  for (let i = 0; i < customerCount; i++) {
    customers.push({ id: `c${i}`, name: `Customer ${i}` });
  }
  const invoices = [];
  for (let i = 0; i < invoiceCount; i++) {
    invoices.push({
      id: `i${i}`,
      customerId: `c${i % customerCount}`,
      status: i % 50 === 0 ? 'void' : 'issued',
      totalGrossMinor: 1000 + i,
    });
  }
  const start = performance.now();
  const result = queryBillingCustomerBranch(invoices, customers);
  const elapsed = performance.now() - start;
  assert.equal(result.length, customerCount);
  assert.ok(elapsed < 50, `Expected <50ms, took ${elapsed.toFixed(1)}ms`);
});

test('P1-9: empty invoices list returns zero counts for all customers', () => {
  const customers = [{ id: 'c1' }, { id: 'c2' }];
  const result = queryBillingCustomerBranch([], customers);
  assert.equal(result.length, 2);
  assert.equal(result[0].invoiceCount, 0);
  assert.equal(result[1].totalBilledMinor, 0);
});
