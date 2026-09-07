import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGoalDrift } from '../src/goal/goal-drift.mjs';

const DAY = 24 * 3600 * 1000;
const goal = (over = {}) => ({
  id: 'g1', owner: 'demo-user', successCriteria: [{ predicate: 'ship' }],
  budgetCents: 10000, horizonEnd: new Date(Date.now() + 10 * DAY).toISOString(),
  ...over,
});
const mission = (over = {}) => ({ id: 'm1', progress: 50, goalId: 'g1', ...over });

test('on-track goal shows no drift', () => {
  const result = assessGoalDrift({ goal: goal(), missions: [mission({ progress: 50 })], now: Date.now(), spentCents: 5000 });
  assert.equal(result.drifted, false);
  assert.deepEqual(result.reasons, []);
});

test('stalled progress near horizon flags drift', () => {
  const nearEnd = goal({ horizonEnd: new Date(Date.now() + DAY).toISOString() });
  const result = assessGoalDrift({ goal: nearEnd, missions: [mission({ progress: 5 })], now: Date.now(), spentCents: 100 });
  assert.equal(result.drifted, true);
  assert.ok(result.reasons.some(r => r.includes('pace')), 'pace reason present');
});

test('budget overrun flags drift', () => {
  const result = assessGoalDrift({ goal: goal(), missions: [mission()], now: Date.now(), spentCents: 12000 });
  assert.equal(result.drifted, true);
  assert.ok(result.reasons.some(r => r.includes('budget')), 'budget reason present');
});

test('no linked missions flags drift', () => {
  const result = assessGoalDrift({ goal: goal(), missions: [], now: Date.now(), spentCents: 0 });
  assert.equal(result.drifted, true);
  assert.ok(result.reasons.some(r => r.includes('linked')), 'linkage reason present');
});

test('expired horizon flags drift', () => {
  const past = goal({ horizonEnd: new Date(Date.now() - DAY).toISOString() });
  const result = assessGoalDrift({ goal: past, missions: [mission({ progress: 100 })], now: Date.now(), spentCents: 0 });
  assert.equal(result.drifted, true);
  assert.ok(result.reasons.some(r => r.includes('horizon')), 'horizon reason present');
});
