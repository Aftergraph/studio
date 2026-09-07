// V90-goal-02: goal registry register/revise/retire — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';

let createGoalRegistry, createGoal;
try {
  ({ createGoalRegistry } = await import('../src/goal/goal-registry.mjs'));
  ({ createGoal } = await import('../src/goal/goal-schema.mjs'));
} catch {}

const futureISO = () => new Date(Date.now() + 86400000).toISOString();

const makeGoal = (overrides = {}) =>
  createGoal({
    id: 'g-1',
    owner: 'demo-user',
    successCriteria: [{ predicate: 'revenue >= 1M verified by ledger' }],
    budgetCents: 50000,
    horizonEnd: futureISO(),
    ...overrides,
  });

test('Goal registry: register stores goal and rejects duplicates', () => {
  const reg = createGoalRegistry();
  const g = makeGoal();
  reg.register(g);
  assert.equal(reg.get(g.id).id, g.id);
  assert.throws(() => reg.register(g), /duplicate|exists/i, 'duplicate id rejected');
});

test('Goal registry: revise requires human approvedBy and appends immutable history', () => {
  const reg = createGoalRegistry();
  const original = makeGoal();
  reg.register(original);

  assert.throws(
    () =>
      reg.revise(original.id, {
        changes: { budgetCents: 60000 },
        approvedBy: 'agent:worker',
      }),
    /approvedBy.*human/i,
    'agent approval rejected',
  );

  const revised = reg.revise(original.id, {
    changes: { budgetCents: 60000 },
    approvedBy: 'demo-user',
  });
  assert.equal(revised.budgetCents, 60000);
  assert.equal(revised.history.length, 1);
  assert.equal(revised.history[0].approvedBy, 'demo-user');
  assert.ok(Object.isFrozen(revised), 'revised goal is frozen');
  assert.ok(Object.isFrozen(revised.history), 'history array is frozen');
  assert.ok(Object.isFrozen(revised.history[0]), 'history entry is frozen');

  // original untouched
  assert.equal(reg.get(original.id).budgetCents, 60000);
});

test('Goal registry: retire requires human by + reason, marks retired', () => {
  const reg = createGoalRegistry();
  reg.register(makeGoal());

  assert.throws(
    () => reg.retire('g-1', { by: 'agent:worker', reason: 'done' }),
    /by.*human/i,
    'agent retire rejected',
  );
  assert.throws(
    () => reg.retire('g-1', { by: 'demo-user' }),
    /reason/i,
    'missing reason rejected',
  );

  const retired = reg.retire('g-1', { by: 'demo-user', reason: 'scope change' });
  assert.equal(retired.retired, true);
  assert.equal(retired.retiredBy, 'demo-user');
  assert.equal(retired.retireReason, 'scope change');
  assert.ok(Object.isFrozen(retired));
});

test('Goal registry: deletion is forbidden', () => {
  const reg = createGoalRegistry();
  reg.register(makeGoal());
  assert.equal(typeof reg.delete, 'undefined', 'no delete method exposed');
  assert.equal(typeof reg.remove, 'undefined', 'no remove method exposed');
});

test('Goal registry: list returns all registered goals', () => {
  const reg = createGoalRegistry();
  reg.register(makeGoal({ id: 'g-a' }));
  reg.register(makeGoal({ id: 'g-b' }));
  const all = reg.list();
  assert.equal(all.length, 2);
  assert.ok(all.every((g) => Object.isFrozen(g)));
});
