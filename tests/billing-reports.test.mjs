import test from 'node:test';
import assert from 'node:assert/strict';
import { computeReport, periodKey, inRange } from '../src/billing/reports.mjs';

const CUSTOMERS = [
  { id: 'c1', name: 'Alpha' },
  { id: 'c2', name: 'Beta' },
];

function makeInvoice(overrides = {}) {
  return {
    id: overrides.id || 'inv-1',
    customerId: overrides.customerId || 'c1',
    status: overrides.status || 'issued',
    issuedAt: overrides.issuedAt || '2026-09-01T10:00:00Z',
    createdAt: overrides.createdAt || '2026-09-01T10:00:00Z',
    dueDate: overrides.dueDate || '2026-09-08',
    totalGrossMinor: overrides.totalGrossMinor ?? 10000,
    totalNetMinor: overrides.totalNetMinor ?? 8000,
    taxMinor: overrides.taxMinor ?? 2000,
    payments: overrides.payments || [],
    number: overrides.number || '100',
  };
}

test('periodKey returns month key by default', () => {
  assert.equal(periodKey('2026-09-14T12:00:00Z', 'month'), '2026-09');
});

test('periodKey returns day key when requested', () => {
  assert.equal(periodKey('2026-09-14T12:00:00Z', 'day'), '2026-09-14');
});

test('periodKey returns week key', () => {
  const key = periodKey('2026-01-05T00:00:00Z', 'week');
  assert.match(key, /^\d{4}-W\d{2}$/);
});

test('periodKey returns null for invalid date', () => {
  assert.equal(periodKey('not-a-date', 'month'), null);
  assert.equal(periodKey(null, 'month'), null);
});

test('inRange filters correctly', () => {
  assert.ok(inRange('2026-09-14', '2026-09-01', '2026-09-30'));
  assert.ok(!inRange('2026-08-31', '2026-09-01', '2026-09-30'));
  assert.ok(!inRange('2026-10-01', '2026-09-01', '2026-09-30'));
  assert.ok(inRange('2026-09-14', null, null));
  assert.ok(!inRange(null, '2026-09-01', '2026-09-30'));
});

test('computeReport rejects unknown type', () => {
  const result = computeReport({ invoices: [], customers: [], type: 'bogus' });
  assert.equal(result.error, 'unknown_report_type');
});

test('revenue-by-customer aggregates paid amounts per customer', () => {
  const invoices = [
    makeInvoice({ id: 'i1', customerId: 'c1', payments: [{ amountMinor: 5000, paidAt: '2026-09-10T10:00:00Z' }] }),
    makeInvoice({ id: 'i2', customerId: 'c1', payments: [{ amountMinor: 3000, paidAt: '2026-09-12T10:00:00Z' }] }),
    makeInvoice({ id: 'i3', customerId: 'c2', payments: [{ amountMinor: 7000, paidAt: '2026-09-11T10:00:00Z' }] }),
    makeInvoice({ id: 'i4', customerId: 'c2', status: 'void', payments: [{ amountMinor: 9999, paidAt: '2026-09-11T10:00:00Z' }] }),
  ];
  const result = computeReport({ invoices, customers: CUSTOMERS, type: 'revenue-by-customer' });
  assert.equal(result.type, 'revenue-by-customer');
  assert.equal(result.rows.length, 2);
  const alpha = result.rows.find((r) => r.customerId === 'c1');
  const beta = result.rows.find((r) => r.customerId === 'c2');
  assert.equal(alpha.totalPaidMinor, 8000);
  assert.equal(alpha.invoiceCount, 2);
  assert.equal(beta.totalPaidMinor, 7000);
  // Sorted descending by totalPaidMinor
  assert.equal(result.rows[0].customerId, 'c1');
});

test('revenue-by-customer skips unpaid invoices', () => {
  const invoices = [makeInvoice({ payments: [] })];
  const result = computeReport({ invoices, customers: CUSTOMERS, type: 'revenue-by-customer' });
  assert.equal(result.rows.length, 0);
});

test('revenue-by-period groups payments by month', () => {
  const invoices = [
    makeInvoice({ payments: [{ amountMinor: 1000, paidAt: '2026-09-05T10:00:00Z' }, { amountMinor: 2000, paidAt: '2026-10-05T10:00:00Z' }] }),
  ];
  const result = computeReport({ invoices, customers: CUSTOMERS, type: 'revenue-by-period', granularity: 'month' });
  assert.equal(result.rows.length, 2);
  const sep = result.rows.find((r) => r.period === '2026-09');
  const oct = result.rows.find((r) => r.period === '2026-10');
  assert.equal(sep.amountMinor, 1000);
  assert.equal(oct.amountMinor, 2000);
});

test('vat-overview uses taxMinor from invoice model', () => {
  const invoices = [
    makeInvoice({ totalGrossMinor: 12500, totalNetMinor: 10000, taxMinor: 2500 }),
    makeInvoice({ totalGrossMinor: 5000, totalNetMinor: 4000, taxMinor: 1000 }),
    makeInvoice({ status: 'void', totalGrossMinor: 99999, totalNetMinor: 99999, taxMinor: 99999 }),
  ];
  const result = computeReport({ invoices, customers: CUSTOMERS, type: 'vat-overview' });
  assert.equal(result.totalGrossMinor, 17500);
  assert.equal(result.totalNetMinor, 14000);
  assert.equal(result.totalTaxMinor, 3500);
  assert.equal(result.totalVatMinor, undefined);
});

test('days-to-pay computes average and per-invoice days', () => {
  const invoices = [
    makeInvoice({
      id: 'i1', issuedAt: '2026-09-01T00:00:00Z', totalGrossMinor: 10000,
      payments: [{ amountMinor: 10000, paidAt: '2026-09-11T00:00:00Z' }],
    }),
    makeInvoice({
      id: 'i2', issuedAt: '2026-09-01T00:00:00Z', totalGrossMinor: 5000,
      payments: [{ amountMinor: 5000, paidAt: '2026-09-06T00:00:00Z' }],
    }),
    // Partially paid — excluded
    makeInvoice({
      id: 'i3', issuedAt: '2026-09-01T00:00:00Z', totalGrossMinor: 8000,
      payments: [{ amountMinor: 4000, paidAt: '2026-09-10T00:00:00Z' }],
    }),
  ];
  const result = computeReport({ invoices, customers: CUSTOMERS, type: 'days-to-pay' });
  assert.equal(result.rows.length, 2);
  assert.equal(result.averageDays, 8); // (10+5)/2 = 7.5 → 8
  const first = result.rows.find((r) => r.invoiceId === 'i1');
  assert.equal(first.days, 10);
});

test('outstanding-aging buckets unpaid amounts', () => {
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };
  const invoices = [
    // Current (due in future)
    makeInvoice({ id: 'i1', dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), totalGrossMinor: 1000, payments: [] }),
    // 1-30 days overdue
    makeInvoice({ id: 'i2', dueDate: daysAgo(10), totalGrossMinor: 2000, payments: [] }),
    // 31-60
    makeInvoice({ id: 'i3', dueDate: daysAgo(45), totalGrossMinor: 3000, payments: [{ amountMinor: 1000, paidAt: daysAgo(40) }] }),
    // Fully paid — excluded
    makeInvoice({ id: 'i4', dueDate: daysAgo(100), totalGrossMinor: 5000, payments: [{ amountMinor: 5000, paidAt: daysAgo(90) }] }),
  ];
  const result = computeReport({ invoices, customers: CUSTOMERS, type: 'outstanding-aging' });
  assert.equal(result.totalOutstandingMinor, 5000); // 1000 + 2000 + 2000
  const current = result.rows.find((r) => r.bucket === 'current');
  assert.equal(current.amountMinor, 1000);
  const b130 = result.rows.find((r) => r.bucket === '1-30');
  assert.equal(b130.amountMinor, 2000);
  const b3160 = result.rows.find((r) => r.bucket === '31-60');
  assert.equal(b3160.amountMinor, 2000);
});
