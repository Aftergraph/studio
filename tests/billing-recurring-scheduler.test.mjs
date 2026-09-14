import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecurringInvoice, tickRecurringScheduler, updateRecurringInvoice } from '../src/billing/recurring.mjs';
import { billingFixtureState } from '../src/billing/fixtures.mjs';

function baseBilling() {
  const state = billingFixtureState();
  state.settings.invoiceSequence = { nextNumber: 2000 };
  return state;
}

const PRODUCT_LINES = [
  { description: 'Rengøring', quantity: 1, unitPriceMinor: 50000, discountPercent: 0 },
];

test('createRecurringInvoice adds a recurring entry with nextRunAt', () => {
  const billing = baseBilling();
  const result = createRecurringInvoice(billing, {
    customerId: 'customer-katrine',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    actor: 'operator-1',
  });
  assert.equal(result.billing.recurringInvoices.length, 1);
  const rec = result.recurring;
  assert.ok(rec.id.startsWith('recurring-'));
  assert.ok(rec.nextRunAt);
  assert.equal(rec.active, true);
  assert.equal(rec.createdBy, 'operator-1');
});

test('createRecurringInvoice throws on missing customer', () => {
  const billing = baseBilling();
  assert.throws(() => createRecurringInvoice(billing, {
    customerId: 'nonexistent',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
  }), /customer not found/);
});

test('tickRecurringScheduler generates draft invoice when nextRunAt is past', () => {
  const billing = baseBilling();
  const created = createRecurringInvoice(billing, {
    customerId: 'customer-katrine',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    actor: 'operator-1',
  });
  // Force nextRunAt to the past
  const billingWithPast = structuredClone(created.billing);
  billingWithPast.recurringInvoices[0].nextRunAt = '2026-01-01T00:00:00Z';

  const result = tickRecurringScheduler(billingWithPast, { now: '2026-09-14T12:00:00Z', actor: 'scheduler' });
  assert.equal(result.generated.length, 1);
  assert.ok(result.generated[0].invoiceId);
  // A new draft invoice was added
  const newInvoices = result.billing.invoices.filter((i) => i.source === 'manual');
  assert.ok(newInvoices.length >= 1);
  // nextRunAt advanced
  const updatedRec = result.billing.recurringInvoices[0];
  assert.notEqual(updatedRec.nextRunAt, '2026-01-01T00:00:00Z');
  assert.equal(updatedRec.lastInvoiceId, result.generated[0].invoiceId);
});

test('tickRecurringScheduler is idempotent — does not regenerate if already run', () => {
  const billing = baseBilling();
  const created = createRecurringInvoice(billing, {
    customerId: 'customer-katrine',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    actor: 'operator-1',
  });
  const billingWithPast = structuredClone(created.billing);
  billingWithPast.recurringInvoices[0].nextRunAt = '2026-01-01T00:00:00Z';

  const first = tickRecurringScheduler(billingWithPast, { now: '2026-09-14T12:00:00Z' });
  assert.equal(first.generated.length, 1);

  // Second tick at same time should produce nothing (nextRunAt is now in the future)
  const second = tickRecurringScheduler(first.billing, { now: '2026-09-14T12:00:00Z' });
  assert.equal(second.generated.length, 0);
});

test('tickRecurringScheduler skips inactive recurring invoices', () => {
  const billing = baseBilling();
  const created = createRecurringInvoice(billing, {
    customerId: 'customer-katrine',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    actor: 'operator-1',
  });
  const deactivated = updateRecurringInvoice(created.billing, {
    id: created.recurring.id,
    active: false,
    actor: 'operator-1',
  });
  const billingWithPast = structuredClone(deactivated.billing);
  billingWithPast.recurringInvoices[0].nextRunAt = '2026-01-01T00:00:00Z';

  const result = tickRecurringScheduler(billingWithPast, { now: '2026-09-14T12:00:00Z' });
  assert.equal(result.generated.length, 0);
});

test('tickRecurringScheduler does not issue or send — only creates drafts', () => {
  const billing = baseBilling();
  const created = createRecurringInvoice(billing, {
    customerId: 'customer-katrine',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    actor: 'operator-1',
  });
  const billingWithPast = structuredClone(created.billing);
  billingWithPast.recurringInvoices[0].nextRunAt = '2026-01-01T00:00:00Z';

  const result = tickRecurringScheduler(billingWithPast, { now: '2026-09-14T12:00:00Z' });
  const invoice = result.billing.invoices.find((i) => i.id === result.generated[0].invoiceId);
  assert.equal(invoice.status, 'draft');
  assert.equal(invoice.sentAt, undefined);
  assert.equal(invoice.emailSentAt, undefined);
});

test('tickRecurringScheduler is restart-safe — partial failure does not corrupt state', () => {
  const billing = baseBilling();
  // Create two recurring invoices; one will fail (bad customer)
  const good = createRecurringInvoice(billing, {
    customerId: 'customer-katrine',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    actor: 'operator-1',
  });
  // Add a broken recurring entry manually
  const billingWithBroken = structuredClone(good.billing);
  billingWithBroken.recurringInvoices.push({
    id: 'recurring-broken',
    customerId: 'nonexistent-customer',
    productLines: PRODUCT_LINES,
    schedule: { interval: { value: 1, unit: 'month' } },
    nextRunAt: '2026-01-01T00:00:00Z',
    active: true,
    lastInvoiceId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  });
  billingWithBroken.recurringInvoices[0].nextRunAt = '2026-01-01T00:00:00Z';

  const result = tickRecurringScheduler(billingWithBroken, { now: '2026-09-14T12:00:00Z' });
  // The good one still generated
  assert.equal(result.generated.length, 1);
  assert.ok(result.generated[0].recurringId !== 'recurring-broken');
});
