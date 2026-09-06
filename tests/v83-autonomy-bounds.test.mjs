// V83-autonomy-01: kill switch + bounded allowance — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CostLedger } from '../src/economy/outcome-economy.mjs';

let createKillSwitch, engageKill, releaseKill, assertAutonomyAllowed;
try {
  ({
    createKillSwitch, engageKill, releaseKill, assertAutonomyAllowed,
  } = await import('../src/autonomy/bounds.mjs'));
} catch {}

function ledgerWithSpend(missionId, amountCents) {
  const ledger = new CostLedger({ id: 'test-ledger' });
  if (amountCents > 0) ledger.record({ id: 'c1', missionId, kind: 'agent', amountCents });
  return ledger;
}

test('Autonomy: kill switch starts disengaged with history', () => {
  assert.ok(createKillSwitch, 'createKillSwitch must exist');
  const sw = createKillSwitch({ id: 'ks-q4', scope: 'mission:mission_q4' });
  assert.equal(sw.engaged, false);
  assert.deepEqual(sw.history, []);
  assert.ok(Object.isFrozen(sw), 'switch must be immutable');
});

test('Autonomy: only humans engage or release the kill switch', () => {
  const sw = createKillSwitch({ id: 'ks-1', scope: 'mission:m1' });
  assert.throws(() => engageKill(sw, { by: 'agent:worker', reason: 'rogue' }), 'agent cannot engage');
  const engaged = engageKill(sw, { by: 'demo-user', reason: 'cost spike' });
  assert.equal(engaged.engaged, true);
  assert.equal(engaged.history.length, 1);
  assert.equal(engaged.history[0].by, 'demo-user');
  assert.throws(() => releaseKill(engaged, { by: 'agent:worker' }), 'agent cannot release');
  const released = releaseKill(engaged, { by: 'demo-user' });
  assert.equal(released.engaged, false);
  assert.equal(released.history.length, 2);
  assert.equal(sw.engaged, false, 'original untouched (immutable)');
});

test('Autonomy: engaged kill switch blocks allowance', () => {
  const sw = engageKill(createKillSwitch({ id: 'ks-2', scope: 'mission:m1' }), { by: 'demo-user', reason: 'stop' });
  assert.throws(
    () => assertAutonomyAllowed({ killSwitch: sw, ledger: ledgerWithSpend('m1', 0), missionId: 'm1', budgetCents: 1000 }),
    /autonomy_killed/,
    'engaged switch denies autonomy',
  );
});

test('Autonomy: exhausted budget blocks allowance', () => {
  const sw = createKillSwitch({ id: 'ks-3', scope: 'mission:m1' });
  assert.throws(
    () => assertAutonomyAllowed({ killSwitch: sw, ledger: ledgerWithSpend('m1', 1000), missionId: 'm1', budgetCents: 1000 }),
    /autonomy_budget_exhausted/,
    'spend at budget denies autonomy (overrun needs human)',
  );
  const ok = assertAutonomyAllowed({ killSwitch: sw, ledger: ledgerWithSpend('m1', 400), missionId: 'm1', budgetCents: 1000 });
  assert.equal(ok.allowed, true);
  assert.equal(ok.spentCents, 400);
  assert.equal(ok.remainingCents, 600);
});

test('Autonomy: denied policy blocks allowance', () => {
  const sw = createKillSwitch({ id: 'ks-4', scope: 'mission:m1' });
  assert.throws(
    () => assertAutonomyAllowed({ killSwitch: sw, ledger: ledgerWithSpend('m1', 0), missionId: 'm1', budgetCents: 1000, policyOk: false }),
    /autonomy_policy_denied/,
    'policy denial blocks autonomy',
  );
});

test('Autonomy: allowance carries evidence reference', () => {
  const sw = createKillSwitch({ id: 'ks-5', scope: 'mission:m1' });
  const ok = assertAutonomyAllowed({
    killSwitch: sw, ledger: ledgerWithSpend('m1', 0), missionId: 'm1', budgetCents: 1000, evidenceRef: 'ev-sealed-1',
  });
  assert.equal(ok.allowed, true);
  assert.equal(ok.evidenceRef, 'ev-sealed-1');
});
