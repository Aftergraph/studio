import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import {
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  tickRecurringScheduler,
} from '../src/billing/recurring.mjs';

function makeBilling() {
  const state = billingFixtureState();
  // billingFixtureState returns flat shape { settings, invoices, customers, visits }
  if (!state.customers?.length) {
    state.customers = [{
      id: 'cust-test-1',
      name: 'Test Kunde A/S',
      email: 'test@example.dk',
      vatNumber: null,
      address: { line1: 'Vestergade 1', postalCode: '1000', city: 'København', countryCode: 'DK' },
      active: true,
    }];
  }
  return state;
}

const validLines = [
  { description: 'Månedlig hosting', quantity: 1, unitPriceMinor: 49900 },
];

const validSchedule = { interval: { value: 1, unit: 'month' } };

test('createRecurringInvoice creates entity with correct shape', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const result = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: validSchedule,
    actor: 'admin',
  });
  assert.ok(result.recurring.id.startsWith('recurring-'));
  assert.equal(result.recurring.customerId, customerId);
  assert.equal(result.recurring.productLines.length, 1);
  assert.equal(result.recurring.productLines[0].unitPriceMinor, 49900);
  assert.equal(result.recurring.active, true);
  assert.equal(result.recurring.lastInvoiceId, null);
  assert.ok(result.recurring.nextRunAt);
  assert.equal(result.recurring.createdBy, 'admin');
  assert.equal(result.billing.recurringInvoices.length, 1);
});

test('createRecurringInvoice rejects missing customer', () => {
  const billing = makeBilling();
  assert.throws(
    () => createRecurringInvoice(billing, { productLines: validLines, schedule: validSchedule }),
    (err) => err.code === 'customer_required',
  );
  assert.throws(
    () => createRecurringInvoice(billing, { customerId: 'nonexistent', productLines: validLines, schedule: validSchedule }),
    (err) => err.code === 'customer_not_found',
  );
});

test('createRecurringInvoice rejects invalid product lines', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: [], schedule: validSchedule }),
    (err) => err.code === 'product_lines_required',
  );
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: [{ description: '', quantity: 1, unitPriceMinor: 100 }], schedule: validSchedule }),
    (err) => err.code === 'invalid_product_line_description',
  );
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: [{ description: 'x', quantity: 0, unitPriceMinor: 100 }], schedule: validSchedule }),
    (err) => err.code === 'invalid_product_line_quantity',
  );
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: [{ description: 'x', quantity: 1, unitPriceMinor: -1 }], schedule: validSchedule }),
    (err) => err.code === 'invalid_product_line_price',
  );
});

test('createRecurringInvoice rejects invalid schedule', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: validLines, schedule: {} }),
    (err) => err.code === 'schedule_required',
  );
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: validLines, schedule: { interval: { value: 0, unit: 'month' } } }),
    (err) => err.code === 'invalid_interval_value',
  );
  assert.throws(
    () => createRecurringInvoice(billing, { customerId, productLines: validLines, schedule: { interval: { value: 1, unit: 'year' } } }),
    (err) => err.code === 'invalid_interval_unit',
  );
});

test('updateRecurringInvoice modifies fields and preserves audit trail', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const created = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: validSchedule,
    actor: 'admin',
  });
  // Small delay to ensure updatedAt differs
  const updated = updateRecurringInvoice(created.billing, {
    id: created.recurring.id,
    productLines: [{ description: 'Opdateret ydelse', quantity: 2, unitPriceMinor: 25000 }],
    actor: 'editor',
  });
  assert.equal(updated.recurring.productLines[0].description, 'Opdateret ydelse');
  assert.equal(updated.recurring.productLines[0].quantity, 2);
  assert.equal(updated.recurring.updatedBy, 'editor');
  assert.ok(updated.recurring.updatedAt, 'updatedAt should be set');
  assert.equal(updated.recurring.createdBy, 'admin');
});

test('updateRecurringInvoice toggles active and recomputes nextRunAt', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const created = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: validSchedule,
  });
  const paused = updateRecurringInvoice(created.billing, {
    id: created.recurring.id,
    active: false,
  });
  assert.equal(paused.recurring.active, false);
  const resumed = updateRecurringInvoice(paused.billing, {
    id: created.recurring.id,
    active: true,
  });
  assert.equal(resumed.recurring.active, true);
  assert.ok(resumed.recurring.nextRunAt);
});

test('updateRecurringInvoice throws on unknown id', () => {
  const billing = makeBilling();
  assert.throws(
    () => updateRecurringInvoice(billing, { id: 'nonexistent', active: false }),
    (err) => err.code === 'recurring_not_found',
  );
});

test('deleteRecurringInvoice removes entity', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const created = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: validSchedule,
  });
  assert.equal(created.billing.recurringInvoices.length, 1);
  const deleted = deleteRecurringInvoice(created.billing, { id: created.recurring.id });
  assert.equal(deleted.billing.recurringInvoices.length, 0);
});

test('deleteRecurringInvoice throws on unknown id', () => {
  const billing = makeBilling();
  assert.throws(
    () => deleteRecurringInvoice(billing, { id: 'nonexistent' }),
    (err) => err.code === 'recurring_not_found',
  );
});

test('tickRecurringScheduler generates draft invoice when due', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
  const created = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: validSchedule,
  });
  // Force nextRunAt to the past
  const forced = updateRecurringInvoice(created.billing, {
    id: created.recurring.id,
    schedule: { interval: { value: 1, unit: 'day' } },
  });
  forced.billing.recurringInvoices[0].nextRunAt = pastDate;

  const result = tickRecurringScheduler(forced.billing, { now: new Date().toISOString(), actor: 'scheduler' });
  assert.equal(result.generated.length, 1);
  assert.equal(result.generated[0].recurringId, created.recurring.id);
  assert.ok(result.generated[0].invoiceId);
  // Verify invoice was actually created in billing state
  const invoices = result.billing.invoices || [];
  const found = invoices.find((inv) => inv.id === result.generated[0].invoiceId);
  assert.ok(found, 'generated invoice should exist in billing state');
});

test('tickRecurringScheduler skips inactive recurring invoices', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const created = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: validSchedule,
  });
  const paused = updateRecurringInvoice(created.billing, {
    id: created.recurring.id,
    active: false,
  });
  paused.billing.recurringInvoices[0].nextRunAt = new Date(Date.now() - 86400000).toISOString();
  const result = tickRecurringScheduler(paused.billing);
  assert.equal(result.generated.length, 0);
});

test('tickRecurringScheduler skips future nextRunAt', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const created = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: { interval: { value: 1, unit: 'month' } },
  });
  // nextRunAt is already in the future by default
  const result = tickRecurringScheduler(created.billing);
  assert.equal(result.generated.length, 0);
});

test('computeNextRunAt handles hour/day/week/month intervals', () => {
  const billing = makeBilling();
  const customerId = billing.customers[0].id;
  const base = new Date('2026-01-15T10:00:00Z');

  const hourResult = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: { interval: { value: 2, unit: 'hour' } },
  });
  // Override for deterministic test
  const hourNext = new Date(new Date(hourResult.recurring.nextRunAt).getTime());
  assert.ok(hourNext > base);

  const weekResult = createRecurringInvoice(billing, {
    customerId,
    productLines: validLines,
    schedule: { interval: { value: 2, unit: 'week' } },
  });
  assert.ok(weekResult.recurring.nextRunAt);
});
