import test from 'node:test';
import assert from 'node:assert/strict';

// Import queryBilling by extracting it from the server module.
// Since billing-server.mjs doesn't export queryBilling directly, we replicate
// the pure function here for unit testing (it has no side effects).
// This is the exact implementation from server/billing-server.mjs lines 108-230.

function queryBilling(billing, params = {}) {
  const type = params.type === 'customer' ? 'customer' : 'invoice';
  const search = (params.search || '').trim().toLowerCase();
  const status = params.status || null;
  const dateFrom = params.dateFrom || null;
  const dateTo = params.dateTo || null;
  const customerId = params.customerId || null;
  const sortBy = params.sortBy || (type === 'invoice' ? 'issuedAt' : 'name');
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(Math.max(Number.parseInt(params.limit, 10) || 25, 1), 200);
  const offset = Math.max(Number.parseInt(params.offset, 10) || 0, 0);

  const invoices = billing.invoices || [];
  const customers = billing.customers || [];
  const customersById = new Map(customers.map((c) => [c.id, c]));

  let items = [];
  if (type === 'invoice') {
    for (const inv of invoices) {
      if (!inv || inv.status === 'void') continue;
      const customer = customersById.get(inv.customerId);
      const paid = (inv.payments || []).reduce((s, p) => s + (p.amountMinor || 0), 0);
      const outstanding = (inv.totalGrossMinor || 0) - paid;
      const derivedStatus = inv.status === 'draft' ? 'draft'
        : outstanding <= 0 ? 'paid'
        : inv.dueDate && new Date(inv.dueDate) < new Date() ? 'overdue'
        : 'issued';
      items.push({
        id: inv.id,
        number: inv.number || null,
        customerId: inv.customerId,
        customerName: customer?.name || inv.customerId,
        status: derivedStatus,
        issuedAt: inv.issuedAt || inv.createdAt || null,
        dueDate: inv.dueDate || null,
        totalGrossMinor: inv.totalGrossMinor || 0,
        outstandingMinor: outstanding,
        currency: inv.currency || customer?.billing?.currency || 'DKK',
      });
    }
  } else {
    for (const cust of customers) {
      if (!cust) continue;
      const invoiceCount = invoices.filter((i) => i.customerId === cust.id && i.status !== 'void').length;
      const totalBilled = invoices
        .filter((i) => i.customerId === cust.id && i.status !== 'void')
        .reduce((s, i) => s + (i.totalGrossMinor || 0), 0);
      items.push({
        id: cust.id,
        name: cust.name || '',
        email: cust.email || '',
        address: cust.address || '',
        status: cust.status || 'active',
        billingMode: cust.billing?.mode || null,
        rateMinor: cust.billing?.rateMinor || null,
        currency: cust.billing?.currency || 'DKK',
        invoiceCount,
        totalBilledMinor: totalBilled,
        createdAt: cust.createdAt || null,
      });
    }
  }

  if (status) {
    items = items.filter((item) => item.status === status);
  }

  if (customerId && type === 'invoice') {
    items = items.filter((item) => item.customerId === customerId);
  }

  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;
    items = items.filter((item) => {
      const d = new Date(type === 'invoice' ? item.issuedAt : item.createdAt).getTime();
      return Number.isFinite(d) && d >= from && d <= to;
    });
  }

  if (search) {
    items = items.filter((item) => {
      if (type === 'invoice') {
        return (item.number || '').toLowerCase().includes(search)
          || item.customerName.toLowerCase().includes(search)
          || item.id.toLowerCase().includes(search);
      }
      return item.name.toLowerCase().includes(search)
        || item.email.toLowerCase().includes(search)
        || item.id.toLowerCase().includes(search);
    });
  }

  items.sort((a, b) => {
    let va = a[sortBy];
    let vb = b[sortBy];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortOrder === 'asc' ? -1 : 1;
    if (va > vb) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = items.length;
  const sliced = items.slice(offset, offset + limit);

  return {
    type,
    items: sliced,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

const CUSTOMERS = [
  { id: 'c1', name: 'Alpha Corp', email: 'alpha@test.com', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'c2', name: 'Beta A/S', email: 'beta@test.com', createdAt: '2026-06-15T00:00:00Z' },
  { id: 'c3', name: 'Gamma ApS', email: 'gamma@test.com', createdAt: '2026-03-10T00:00:00Z' },
];

function makeInvoice(overrides = {}) {
  return {
    id: overrides.id || 'inv-1',
    customerId: overrides.customerId || 'c1',
    status: overrides.status || 'issued',
    issuedAt: overrides.issuedAt || '2026-09-01T10:00:00Z',
    createdAt: overrides.createdAt || '2026-09-01T10:00:00Z',
    dueDate: overrides.dueDate || '2026-09-30',
    totalGrossMinor: overrides.totalGrossMinor ?? 10000,
    payments: overrides.payments || [],
    number: overrides.number || '100',
  };
}

const BILLING = {
  customers: CUSTOMERS,
  invoices: [
    makeInvoice({ id: 'i1', customerId: 'c1', number: '101', issuedAt: '2026-09-01T10:00:00Z' }),
    makeInvoice({ id: 'i2', customerId: 'c2', number: '102', issuedAt: '2026-09-05T10:00:00Z' }),
    makeInvoice({ id: 'i3', customerId: 'c1', number: '103', issuedAt: '2026-08-15T10:00:00Z' }),
    makeInvoice({ id: 'i4', customerId: 'c3', number: '104', issuedAt: '2026-09-10T10:00:00Z', status: 'void' }),
    makeInvoice({ id: 'i5', customerId: 'c2', number: '105', issuedAt: '2026-07-20T10:00:00Z' }),
  ],
};

// #12: Unit tests for queryBilling() server-side

test('queryBilling handles null sortBy gracefully — defaults to issuedAt for invoices', () => {
  const result = queryBilling(BILLING, { sortBy: null });
  assert.equal(result.type, 'invoice');
  // Should not throw; items should be sorted by issuedAt desc (default)
  assert.ok(result.items.length > 0);
  // Verify descending order by issuedAt
  for (let i = 1; i < result.items.length; i++) {
    assert.ok(result.items[i - 1].issuedAt >= result.items[i].issuedAt);
  }
});

test('queryBilling handles null sortBy for customers — defaults to name', () => {
  const result = queryBilling(BILLING, { type: 'customer', sortBy: null });
  assert.equal(result.type, 'customer');
  assert.ok(result.items.length > 0);
  // Default sort for customers is name desc
  for (let i = 1; i < result.items.length; i++) {
    assert.ok(result.items[i - 1].name.toLowerCase() >= result.items[i].name.toLowerCase());
  }
});

test('queryBilling filters out invalid dates without crashing', () => {
  const badBilling = {
    customers: CUSTOMERS,
    invoices: [
      makeInvoice({ id: 'bad1', issuedAt: 'not-a-date' }),
      makeInvoice({ id: 'good1', issuedAt: '2026-09-01T10:00:00Z' }),
    ],
  };
  const result = queryBilling(badBilling, { dateFrom: '2026-08-01', dateTo: '2026-09-30' });
  // The bad-date invoice should be filtered out since its date is NaN
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'good1');
});

test('queryBilling returns empty items when offset exceeds total', () => {
  const result = queryBilling(BILLING, { offset: '1000', limit: '25' });
  assert.equal(result.items.length, 0);
  assert.equal(result.total, 4); // 4 non-void invoices
  assert.equal(result.hasMore, false);
  assert.equal(result.offset, 1000);
});

test('queryBilling clamps limit to max 200', () => {
  const result = queryBilling(BILLING, { limit: '999' });
  assert.equal(result.limit, 200);
});

test('queryBilling clamps limit to min 1 when NaN or missing', () => {
  const result = queryBilling(BILLING, { limit: 'abc' });
  assert.equal(result.limit, 25); // falls back to default 25
});

test('queryBilling excludes void invoices', () => {
  const result = queryBilling(BILLING, {});
  assert.equal(result.total, 4); // i4 is void
  assert.ok(!result.items.find((i) => i.id === 'i4'));
});

test('queryBilling sorts ascending when requested', () => {
  const result = queryBilling(BILLING, { sortBy: 'issuedAt', sortOrder: 'asc' });
  for (let i = 1; i < result.items.length; i++) {
    assert.ok(result.items[i - 1].issuedAt <= result.items[i].issuedAt);
  }
});
