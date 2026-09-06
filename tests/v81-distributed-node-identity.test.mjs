// V81-distributed-01: Node Identity + Offline Event Log + Vector Clocks — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';

// These imports will fail until we implement the modules
let createNodeIdentity, createOfflineEventLog, createVectorClock, mergeVectorClocks;

try {
  const mod = await import('../src/distributed/node-identity.mjs');
  createNodeIdentity = mod.createNodeIdentity;
} catch {}

try {
  const mod = await import('../src/distributed/offline-event-log.mjs');
  createOfflineEventLog = mod.createOfflineEventLog;
} catch {}

try {
  const mod = await import('../src/distributed/vector-clock.mjs');
  createVectorClock = mod.createVectorClock;
  mergeVectorClocks = mod.mergeVectorClocks;
} catch {}

test('NodeIdentity: generates stable unique node ID', () => {
  assert.ok(createNodeIdentity, 'createNodeIdentity must exist');
  const node = createNodeIdentity();
  assert.ok(node.id, 'node must have id');
  assert.ok(typeof node.id === 'string', 'id must be string');
  assert.ok(node.id.length > 0, 'id must not be empty');
});

test('NodeIdentity: accepts explicit node ID', () => {
  const node = createNodeIdentity({ id: 'node-alpha' });
  assert.equal(node.id, 'node-alpha');
});

test('NodeIdentity: two nodes have different IDs when auto-generated', () => {
  const a = createNodeIdentity();
  const b = createNodeIdentity();
  assert.notEqual(a.id, b.id, 'auto-generated IDs must differ');
});

test('NodeIdentity: exposes createdAt timestamp', () => {
  const node = createNodeIdentity();
  assert.ok(node.createdAt, 'node must have createdAt');
  assert.ok(typeof node.createdAt === 'string', 'createdAt must be ISO string');
});

test('VectorClock: starts at zero for unknown nodes', () => {
  assert.ok(createVectorClock, 'createVectorClock must exist');
  const vc = createVectorClock();
  assert.equal(vc.get('node-a'), 0, 'unknown node starts at 0');
});

test('VectorClock: increments for known node', () => {
  const vc = createVectorClock({ 'node-a': 5 });
  vc.increment('node-a');
  assert.equal(vc.get('node-a'), 6);
});

test('VectorClock: returns snapshot of all known counters', () => {
  const vc = createVectorClock({ 'node-a': 3, 'node-b': 7 });
  const snap = vc.snapshot();
  assert.deepEqual(snap, { 'node-a': 3, 'node-b': 7 });
});

test('VectorClock: snapshot is frozen/immutable', () => {
  const vc = createVectorClock({ 'node-a': 1 });
  const snap = vc.snapshot();
  assert.throws(() => { snap['node-a'] = 999; }, 'snapshot must be immutable');
});

test('mergeVectorClocks: takes component-wise maximum', () => {
  assert.ok(mergeVectorClocks, 'mergeVectorClocks must exist');
  const a = { 'node-a': 3, 'node-b': 1 };
  const b = { 'node-a': 1, 'node-b': 5, 'node-c': 2 };
  const merged = mergeVectorClocks(a, b);
  assert.deepEqual(merged, { 'node-a': 3, 'node-b': 5, 'node-c': 2 });
});

test('mergeVectorClocks: handles empty clocks', () => {
  const merged = mergeVectorClocks({}, { 'node-a': 4 });
  assert.deepEqual(merged, { 'node-a': 4 });
});

test('OfflineEventLog: appends events with node ID and vector clock', () => {
  assert.ok(createOfflineEventLog, 'createOfflineEventLog must exist');
  const log = createOfflineEventLog({ nodeId: 'node-a' });
  const event = log.append({ type: 'test.event', payload: { x: 1 } });
  assert.ok(event.id, 'event must have id');
  assert.equal(event.nodeId, 'node-a');
  assert.ok(event.vectorClock, 'event must have vectorClock');
  assert.equal(event.vectorClock['node-a'], 1, 'first event from node-a has clock 1');
  assert.equal(event.type, 'test.event');
});

test('OfflineEventLog: successive appends increment vector clock', () => {
  const log = createOfflineEventLog({ nodeId: 'node-a' });
  const e1 = log.append({ type: 'a' });
  const e2 = log.append({ type: 'b' });
  const e3 = log.append({ type: 'c' });
  assert.equal(e1.vectorClock['node-a'], 1);
  assert.equal(e2.vectorClock['node-a'], 2);
  assert.equal(e3.vectorClock['node-a'], 3);
});

test('OfflineEventLog: events are append-only and ordered', () => {
  const log = createOfflineEventLog({ nodeId: 'node-a' });
  log.append({ type: 'first' });
  log.append({ type: 'second' });
  const all = log.events();
  assert.equal(all.length, 2);
  assert.equal(all[0].type, 'first');
  assert.equal(all[1].type, 'second');
});

test('OfflineEventLog: events list is a snapshot (immutable)', () => {
  const log = createOfflineEventLog({ nodeId: 'node-a' });
  log.append({ type: 'x' });
  const snap = log.events();
  assert.throws(() => { snap.push({ type: 'hack' }); }, 'events() must return immutable snapshot');
  assert.equal(log.events().length, 1, 'original log unchanged');
});

test('OfflineEventLog: merges remote events without losing local ordering', () => {
  const logA = createOfflineEventLog({ nodeId: 'node-a' });
  const logB = createOfflineEventLog({ nodeId: 'node-b' });
  const a1 = logA.append({ type: 'a-event-1' });
  const b1 = logB.append({ type: 'b-event-1' });
  // Merge B's events into A
  logA.merge([b1]);
  const all = logA.events();
  assert.equal(all.length, 2, 'merged log has both events');
  // Both events present
  const types = all.map(e => e.type);
  assert.ok(types.includes('a-event-1'));
  assert.ok(types.includes('b-event-1'));
});

test('OfflineEventLog: merge is idempotent (same event merged twice = no duplicate)', () => {
  const logA = createOfflineEventLog({ nodeId: 'node-a' });
  const logB = createOfflineEventLog({ nodeId: 'node-b' });
  const b1 = logB.append({ type: 'b-event' });
  logA.merge([b1]);
  logA.merge([b1]); // merge same event again
  const all = logA.events();
  const bEvents = all.filter(e => e.id === b1.id);
  assert.equal(bEvents.length, 1, 'duplicate merge must not create duplicate event');
});

test('OfflineEventLog: current vector clock reflects merged state', () => {
  const logA = createOfflineEventLog({ nodeId: 'node-a' });
  const logB = createOfflineEventLog({ nodeId: 'node-b' });
  logA.append({ type: 'a1' }); // clock: {node-a:1}
  logA.append({ type: 'a2' }); // clock: {node-a:2}
  logB.append({ type: 'b1' }); // clock: {node-b:1}
  const bEvents = logB.events();
  logA.merge(bEvents);
  const clock = logA.currentClock();
  assert.equal(clock['node-a'], 2, 'local counter preserved');
  assert.equal(clock['node-b'], 1, 'remote counter merged');
});

test('OfflineEventLog: no authority leakage — merge does not overwrite local events', () => {
  const logA = createOfflineEventLog({ nodeId: 'node-a' });
  const logB = createOfflineEventLog({ nodeId: 'node-b' });
  const localEvent = logA.append({ type: 'local-truth', payload: { value: 'correct' } });
  // Attempt to merge a conflicting event with same ID (should not overwrite)
  const conflicting = {
    ...localEvent,
    payload: { value: 'tampered' },
    vectorClock: { 'node-a': 999 } // fake higher clock
  };
  logA.merge([conflicting]);
  const all = logA.events();
  const found = all.find(e => e.id === localEvent.id);
  assert.equal(found.payload.value, 'correct', 'local event must not be overwritten by merge');
});
