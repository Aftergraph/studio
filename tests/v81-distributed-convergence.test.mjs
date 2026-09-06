// V81-distributed-02: Convergence — deterministic total order + bidirectional merge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineEventLog } from '../src/distributed/offline-event-log.mjs';
import { converge } from '../src/distributed/convergence.mjs';

function makeLog(nodeId) {
  return createOfflineEventLog({ nodeId });
}

test('Convergence: bidirectional merge yields identical event sets and order', () => {
  const logA = makeLog('node-a');
  const logB = makeLog('node-b');

  // Offline writes on each node
  logA.append({ type: 'a.offline.1', payload: { v: 1 }, id: 'evt-a-1' });
  logA.append({ type: 'a.offline.2', payload: { v: 2 }, id: 'evt-a-2' });
  logB.append({ type: 'b.offline.1', payload: { v: 10 }, id: 'evt-b-1' });
  logB.append({ type: 'b.offline.2', payload: { v: 20 }, id: 'evt-b-2' });

  // Merge both ways
  logA.merge(logB.events());
  logB.merge(logA.events());

  const aEvents = logA.events();
  const bEvents = logB.events();

  assert.equal(aEvents.length, bEvents.length, 'both logs must have same count');
  // Deterministic total order via converge() — same regardless of input order
  const aOrdered = converge(aEvents, bEvents);
  const bOrdered = converge(bEvents, aEvents);
  assert.deepEqual(
    aOrdered.map(e => e.id),
    bOrdered.map(e => e.id),
    'deterministic total order must match across nodes'
  );
});

test('Convergence: merge is idempotent on repeated application', () => {
  const logA = makeLog('node-a');
  const logB = makeLog('node-b');

  logA.append({ type: 'x', id: 'evt-x-1' });
  logB.append({ type: 'y', id: 'evt-y-1' });

  logA.merge(logB.events());
  const firstIds = logA.events().map(e => e.id);

  // Merge again — should be no-op
  logA.merge(logB.events());
  logA.merge(logB.events());
  const afterIds = logA.events().map(e => e.id);

  assert.deepEqual(firstIds, afterIds, 'repeated merge must not change order or count');
});

test('Convergence: conflicting payload with same id does not overwrite (first-writer-wins)', () => {
  const logA = makeLog('node-a');
  const logB = makeLog('node-b');

  const original = logA.append({ type: 'shared', payload: { value: 'original' }, id: 'evt-shared-1' });

  // Fabricate a conflicting event with same id but different payload
  const conflict = {
    ...original,
    payload: { value: 'tampered' },
    vectorClock: { 'node-a': 999, 'node-b': 999 },
    appendedAt: new Date(Date.now() + 100000).toISOString(),
  };

  logB.merge([conflict]);
  logA.merge(logB.events());

  const found = logA.events().find(e => e.id === 'evt-shared-1');
  assert.equal(found.payload.value, 'original', 'first writer wins; no authority leakage');
});

test('Convergence: independent concurrent events from both nodes are all preserved', () => {
  const logA = makeLog('node-a');
  const logB = makeLog('node-b');

  logA.append({ type: 'a.concurrent', id: 'evt-a-c1' });
  logA.append({ type: 'a.concurrent', id: 'evt-a-c2' });
  logB.append({ type: 'b.concurrent', id: 'evt-b-c1' });
  logB.append({ type: 'b.concurrent', id: 'evt-b-c2' });
  logB.append({ type: 'b.concurrent', id: 'evt-b-c3' });

  logA.merge(logB.events());
  logB.merge(logA.events());

  const idsA = new Set(logA.events().map(e => e.id));
  const idsB = new Set(logB.events().map(e => e.id));

  for (const id of ['evt-a-c1', 'evt-a-c2', 'evt-b-c1', 'evt-b-c2', 'evt-b-c3']) {
    assert.ok(idsA.has(id), `logA missing ${id}`);
    assert.ok(idsB.has(id), `logB missing ${id}`);
  }
  assert.equal(logA.events().length, 5);
  assert.equal(logB.events().length, 5);
});

test('Convergence: converge() helper returns deterministically sorted merged array', () => {
  const logA = makeLog('node-a');
  const logB = makeLog('node-b');

  logA.append({ type: 'a', id: 'evt-a-z' });
  logB.append({ type: 'b', id: 'evt-b-a' });

  const merged = converge(logA.events(), logB.events());
  const ids = merged.map(e => e.id);

  assert.equal(merged.length, 2);
  // Run twice to confirm determinism
  const merged2 = converge(logB.events(), logA.events());
  assert.deepEqual(ids, merged2.map(e => e.id), 'converge order independent of input order');
});
