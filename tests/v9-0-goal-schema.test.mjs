// V90-goal-01: goal schema validation — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';

let createGoal;
try {
  ({ createGoal } = await import('../src/goal/goal-schema.mjs'));
} catch {}

const futureISO = () => new Date(Date.now() + 86400000).toISOString();

const validGoal = () => ({
  id: 'g-1',
  owner: 'demo-user',
  successCriteria: [{ predicate: 'revenue >= 1M verified by ledger' }],
  budgetCents: 50000,
  horizonEnd: futureISO(),
});

test('Goal schema: createGoal exists', () => {
  assert.ok(createGoal, 'createGoal must be exported');
});

test('Goal schema: rejects agent: owner', () => {
  assert.throws(
    () => createGoal({ ...validGoal(), owner: 'agent:worker' }),
    /owner.*human/i,
    'agent: prefix must be rejected',
  );
});

test('Goal schema: requires at least one success criterion with predicate', () => {
  assert.throws(
    () => createGoal({ ...validGoal(), successCriteria: [] }),
    /successCriteria/i,
    'empty criteria rejected',
  );
  assert.throws(
    () => createGoal({ ...validGoal(), successCriteria: [{}] }),
    /predicate/i,
    'missing predicate rejected',
  );
  assert.throws(
    () => createGoal({ ...validGoal(), successCriteria: [{ predicate: '' }] }),
    /predicate/i,
    'blank predicate rejected',
  );
});

test('Goal schema: budgetCents must be non-negative integer', () => {
  assert.throws(
    () => createGoal({ ...validGoal(), budgetCents: -1 }),
    /budgetCents/i,
    'negative budget rejected',
  );
  assert.throws(
    () => createGoal({ ...validGoal(), budgetCents: 1.5 }),
    /budgetCents/i,
    'non-integer budget rejected',
  );
  const g = createGoal({ ...validGoal(), budgetCents: 0 });
  assert.equal(g.budgetCents, 0);
});

test('Goal schema: horizonEnd must be future ISO date', () => {
  assert.throws(
    () => createGoal({ ...validGoal(), horizonEnd: 'not-a-date' }),
    /horizonEnd/i,
    'invalid ISO rejected',
  );
  assert.throws(
    () => createGoal({ ...validGoal(), horizonEnd: '2020-01-01T00:00:00.000Z' }),
    /horizonEnd/i,
    'past date rejected',
  );
});

test('Goal schema: returns frozen record with all fields', () => {
  const input = validGoal();
  const g = createGoal(input);
  assert.ok(Object.isFrozen(g), 'goal must be immutable');
  assert.equal(g.id, input.id);
  assert.equal(g.owner, input.owner);
  assert.deepEqual(g.successCriteria, input.successCriteria);
  assert.equal(g.budgetCents, input.budgetCents);
  assert.equal(g.horizonEnd, input.horizonEnd);
  assert.equal(g.parentGoalId, undefined);
});

test('Goal schema: optional parentGoalId preserved when provided', () => {
  const g = createGoal({ ...validGoal(), parentGoalId: 'g-parent' });
  assert.equal(g.parentGoalId, 'g-parent');
  assert.ok(Object.isFrozen(g));
});
