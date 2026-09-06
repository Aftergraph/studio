// V7.4 Outcome Economy exit tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CostLedger,
  settleOutcomeEconomy,
  reconcileEconomy,
} from '../src/economy/outcome-economy.mjs';
import { AGOutcomeReceipt } from '../packages/ui/index.mjs';

test('Economy: ledger records attributable integer-cent costs', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  ledger.record({ id: 'c1', missionId: 'm1', kind: 'model', amountCents: 125 });
  ledger.record({ id: 'c2', missionId: 'm1', kind: 'compute', amountCents: 75 });
  assert.equal(ledger.totalFor('m1'), 200);
  assert.equal(ledger.currency, 'EUR');
});

test('Economy: rejects fractional, unsafe, negative and non-numeric cents', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  for (const amountCents of [1.5, -1, Number.MAX_SAFE_INTEGER + 1, Number.MAX_VALUE, NaN, null, '100']) {
    assert.throws(() => ledger.record({ id: `bad-${String(amountCents)}`, missionId: 'm1', kind: 'model', amountCents }), /integer|safe|finite|number|negative/i);
  }
  ledger.record({ id: 'max', missionId: 'm1', kind: 'model', amountCents: Number.MAX_SAFE_INTEGER });
});

test('Economy: idempotency rejects duplicate cost ids with changed payload', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  const entry = { id: 'c1', missionId: 'm1', kind: 'model', amountCents: 100 };
  ledger.record(entry);
  ledger.record(entry);
  assert.equal(ledger.totalFor('m1'), 100);
  assert.throws(() => ledger.record({ ...entry, amountCents: 101 }), /duplicate|idempot/i);
});

test('Economy: entries are immutable and scoped to a mission', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  const entry = ledger.record({ id: 'c1', missionId: 'm1', kind: 'agent', amountCents: 50, evidenceRef: 'ev1' });
  assert.ok(Object.isFrozen(entry));
  assert.equal(ledger.totalFor('m2'), 0);
  assert.throws(() => ledger.record({ id: 'c2', missionId: '', kind: 'agent', amountCents: 50 }), /mission/i);
});

test('Economy: settlement ties actual cost to outcome evidence and budget', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  ledger.record({ id: 'c1', missionId: 'm1', kind: 'model', amountCents: 300, evidenceRef: 'ev1' });
  const settlement = settleOutcomeEconomy({ missionId: 'm1', ledger, allocatedCents: 500, evidenceRefs: ['ev1'], verdict: 'success' });
  assert.deepEqual(settlement, {
    missionId: 'm1', currency: 'EUR', allocatedCents: 500, actualCents: 300,
    varianceCents: 200, withinBudget: true, verdict: 'success',
    evidenceRefs: ['ev1'], authority: 'none',
  });
});

test('Economy: budget overrun is explicit and blocks settlement without approval', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  ledger.record({ id: 'c1', missionId: 'm1', kind: 'model', amountCents: 600 });
  assert.throws(() => settleOutcomeEconomy({ missionId: 'm1', ledger, allocatedCents: 500, evidenceRefs: ['ev1'], verdict: 'success' }), /budget|exceed/i);
  const settlement = settleOutcomeEconomy({ missionId: 'm1', ledger, allocatedCents: 500, evidenceRefs: ['ev1'], verdict: 'success', humanApprovedOverrun: true });
  assert.equal(settlement.withinBudget, false);
  assert.equal(settlement.actualCents, 600);
});

test('Economy: settlement requires evidence for a successful outcome', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  assert.throws(() => settleOutcomeEconomy({ missionId: 'm1', ledger, allocatedCents: 500, evidenceRefs: [], verdict: 'success' }), /evidence/i);
});

test('Economy: reconciliation reports missing and unexplained costs', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  ledger.record({ id: 'c1', missionId: 'm1', kind: 'model', amountCents: 100 });
  const result = reconcileEconomy({ ledger, receipts: [{ missionId: 'm1', actualCents: 80 }, { missionId: 'm2', actualCents: 20 }] });
  assert.deepEqual(result.mismatches, [
    { missionId: 'm1', ledgerCents: 100, receiptCents: 80, deltaCents: 20 },
    { missionId: 'm2', ledgerCents: 0, receiptCents: 20, deltaCents: -20 },
  ]);
  assert.equal(result.authority, 'none');
});

test('Economy: outcome receipt communicates settled cost without implying payment', () => {
  const html = AGOutcomeReceipt({ title: 'Report verified', detail: '€3.00 actual · €5.00 allocated · €2.00 remaining', evidenceCount: 2, actualCents: 300, allocatedCents: 500 });
  assert.match(html, /Outcome settled/);
  assert.match(html, /actual/);
  assert.match(html, /data-economy-status="settled"/);
  assert.doesNotMatch(html, /paid|payment|invoice/i);
});

test('V7.4 exit: cost, evidence and outcome remain attributable and authority-free', () => {
  const ledger = new CostLedger({ id: 'ledger-1', currency: 'EUR' });
  ledger.record({ id: 'c1', missionId: 'm1', kind: 'agent', amountCents: 10, evidenceRef: 'ev1' });
  const outcome = settleOutcomeEconomy({ missionId: 'm1', ledger, allocatedCents: 10, evidenceRefs: ['ev1'], verdict: 'success' });
  assert.equal(outcome.authority, 'none');
  assert.equal(outcome.actualCents, 10);
});
