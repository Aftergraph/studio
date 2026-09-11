import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { evaluateBilling } from '../src/billing/readiness.mjs';

function statusByCustomer(result) {
  return new Map(result.items.map((item) => [item.customerName, item.status]));
}

test('fixture billing state represents reference operational patterns without access secrets', () => {
  const billing = billingFixtureState();
  const serialized = JSON.stringify(billing).toLowerCase();
  assert.equal(billing.settings.taxRateBps, 2500);
  assert.equal(billing.settings.locale, 'da-DK');
  assert.ok(billing.customers.length >= 5);
  assert.doesNotMatch(serialized, /garage|key|nøgle|alarm|parking|parkering|white door|hvid dør/);

  const projection = evaluateBilling({ ...billing, now: '2026-09-11T10:00:00+02:00' });
  const statuses = statusByCustomer(projection);
  assert.equal(statuses.get('Katrine Rindom Andersen'), 'ready');
  assert.equal(statuses.get('Anton Horsbøl Skjeldmoes'), 'waiting');
  assert.equal(statuses.get('Heidi'), 'waiting');
  assert.equal(statuses.get('Casper & Nora'), 'waiting');
  assert.equal(statuses.get('Peder Kjær'), 'needs_info');
});

test('fixture-mode Studio state embeds billing fixtures', () => {
  const state = createInitialState({ fixtures: true });
  assert.ok(state.billing);
  assert.ok(state.billing.customers.some((customer) => customer.name === 'Katrine Rindom Andersen'));
  assert.ok(state.billing.visits.some((visit) => visit.id === 'katrine-2026-09-07'));
});

test('non-fixture Studio state starts with an empty billing ledger', () => {
  const state = createInitialState({ fixtures: false });
  assert.deepEqual(state.billing.customers, []);
  assert.deepEqual(state.billing.visits, []);
  assert.deepEqual(state.billing.invoices, []);
  assert.equal(state.billing.settings.taxRateBps, 2500);
});
