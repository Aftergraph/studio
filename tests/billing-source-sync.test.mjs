import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBillingState } from '../src/billing/fixtures.mjs';
import { syncBillingSource } from '../src/billing/source-sync.mjs';

const source = { id: 'pilot-ops', revision: 'rev-001', syncedAt: '2026-09-11T20:00:00.000Z' };
const customer = {
  id: 'customer-live-1', name: 'Pilot Customer', address: 'Pilotvej 1, 8000 Aarhus C',
  email: 'pilot@example.test', status: 'active',
  billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 },
};
const visit = {
  id: 'visit-live-1', customerId: customer.id,
  scheduledStart: '2026-09-11T08:00:00+02:00', scheduledEnd: '2026-09-11T10:00:00+02:00',
  status: 'completed', actual: { workers: 2, workMinutes: 240 },
};
test('source sync imports customers and visits into an empty production billing state', () => {
  const result = syncBillingSource(emptyBillingState(), { schema: 'aftergraph.billing.source.v1', source, customers: [customer], visits: [visit] });
  assert.equal(result.billing.customers.length, 1);
  assert.equal(result.billing.visits.length, 1);
  assert.deepEqual(result.billing.visits[0].actual, visit.actual);
  assert.equal(result.summary.customersCreated, 1);
  assert.equal(result.summary.visitsCreated, 1);
  assert.deepEqual(result.billing.sourceSync['pilot-ops'], {
    revision: 'rev-001', digest: result.billing.sourceSync['pilot-ops'].digest,
    syncedAt: source.syncedAt,
  });
});

test('same source revision and payload is idempotent while changed payload conflicts', () => {
  const first = syncBillingSource(emptyBillingState(), { schema: 'aftergraph.billing.source.v1', source, customers: [customer], visits: [visit] });
  const replay = syncBillingSource(first.billing, { schema: 'aftergraph.billing.source.v1', source, customers: [customer], visits: [visit] });
  assert.deepEqual(replay.billing, first.billing);
  assert.equal(replay.summary.replayed, true);

  const changed = { ...customer, name: 'Changed under same revision' };
  assert.throws(
    () => syncBillingSource(first.billing, { schema: 'aftergraph.billing.source.v1', source, customers: [changed], visits: [visit] }),
    (error) => error?.code === 'source_revision_conflict',
  );
});
test('source sync cannot mutate invoice ledger or invoice sequence', () => {
  const billing = emptyBillingState();
  billing.invoices = [{ id: 'invoice-7', number: '7', customerId: 'customer-live-1', visitIds: ['visit-live-1'], status: 'issued' }];
  billing.settings.invoiceSequence.nextNumber = 8;
  const beforeInvoices = structuredClone(billing.invoices);
  const beforeSettings = structuredClone(billing.settings);
  const result = syncBillingSource(billing, { schema: 'aftergraph.billing.source.v1', source, customers: [customer], visits: [visit] });
  assert.deepEqual(result.billing.invoices, beforeInvoices);
  assert.deepEqual(result.billing.settings, beforeSettings);
});

test('source sync preserves established actuals and rejects conflicting actual evidence', () => {
  const first = syncBillingSource(emptyBillingState(), { schema: 'aftergraph.billing.source.v1', source, customers: [customer], visits: [visit] });
  const nextSource = { ...source, revision: 'rev-002' };
  const sameActual = syncBillingSource(first.billing, {
    schema: 'aftergraph.billing.source.v1', source: nextSource,
    customers: [customer], visits: [{ ...visit, scheduledEnd: '2026-09-11T10:30:00+02:00' }],
  });
  assert.deepEqual(sameActual.billing.visits[0].actual, visit.actual);
  assert.equal(sameActual.billing.visits[0].scheduledEnd, '2026-09-11T10:30:00+02:00');

  assert.throws(() => syncBillingSource(first.billing, {
    schema: 'aftergraph.billing.source.v1', source: nextSource,
    customers: [customer], visits: [{ ...visit, actual: { workers: 2, workMinutes: 300 } }],
  }), (error) => error?.code === 'actuals_conflict');
});