// V81-distributed-04: offline-first client + V8.1 exit gate — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { createApiClient } from '../src/api-client.mjs';

let createOfflineClient;
try {
  ({ createOfflineClient } = await import('../src/distributed/offline-client.mjs'));
} catch {}

function fakeApi({ fail = false, store = null } = {}) {
  return {
    async submitSync() {
      if (fail) { const e = new Error('backend_unavailable'); e.code = 'backend_unavailable'; throw e; }
      return { events: [...(store ?? [])], clock: {} };
    },
    async readSync() {
      if (fail) { const e = new Error('backend_unavailable'); e.code = 'backend_unavailable'; throw e; }
      return { events: [...(store ?? [])], clock: {} };
    },
  };
}

test('OfflineClient: appends locally while offline, truth preserved', async () => {
  assert.ok(createOfflineClient, 'createOfflineClient must exist');
  const client = createOfflineClient({ nodeId: 'node-a', api: fakeApi({ fail: true }), actor: 'demo-user' });
  client.append({ type: 'a.offline', payload: { v: 1 } });
  client.append({ type: 'a.offline', payload: { v: 2 } });
  assert.equal(client.events().length, 2, 'local truth intact while offline');
  assert.equal(client.pendingCount(), 2, 'both events pending sync');
});

test('OfflineClient: sync fails closed, local truth survives', async () => {
  const client = createOfflineClient({ nodeId: 'node-a', api: fakeApi({ fail: true }), actor: 'demo-user' });
  client.append({ type: 'a.offline' });
  const result = await client.sync();
  assert.equal(result.synced, false, 'sync reports failure, does not throw');
  assert.equal(client.events().length, 1, 'local event not lost on failed sync');
  assert.equal(client.pendingCount(), 1, 'event still pending after failed sync');
});

test('OfflineClient: sync pushes local events and merges server state', async () => {
  const serverEvents = [{
    id: 'evt_node-b_1', nodeId: 'node-b', type: 'b.event', payload: {},
    vectorClock: { 'node-b': 1 }, appendedAt: '2026-09-07T00:00:01.000Z',
  }];
  const seen = [];
  const api = {
    async submitSync({ events }) { seen.push(...events); return { events: [...events, ...serverEvents], clock: {} }; },
    async readSync() { return { events: serverEvents, clock: {} }; },
  };
  const client = createOfflineClient({ nodeId: 'node-a', api, actor: 'demo-user' });
  client.append({ type: 'a.offline', id: 'evt_node-a_1' });
  const result = await client.sync();
  assert.equal(result.synced, true);
  assert.ok(seen.some(e => e.id === 'evt_node-a_1'), 'local events pushed to server');
  const ids = client.events().map(e => e.id);
  assert.ok(ids.includes('evt_node-a_1'), 'local event kept after sync');
  assert.ok(ids.includes('evt_node-b_1'), 'server event merged locally');
  assert.equal(client.pendingCount(), 0, 'nothing pending after successful sync');
});

test('OfflineClient: readback is deterministic across calls', async () => {
  const client = createOfflineClient({ nodeId: 'node-a', api: fakeApi(), actor: 'demo-user' });
  client.append({ type: 'b', id: 'evt-b' });
  client.append({ type: 'a', id: 'evt-a' });
  const first = client.events().map(e => e.id);
  const second = client.events().map(e => e.id);
  assert.deepEqual(first, second);
});

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-v81-exit-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}

test('V8.1 EXIT: two offline nodes converge through the server with no authority leakage', async () => {
  await withServer(async base => {
    const api = createApiClient({ baseUrl: base });
    assert.ok(typeof api.submitSync === 'function', 'api client must expose submitSync');
    assert.ok(typeof api.readSync === 'function', 'api client must expose readSync');
    // Both nodes write fully offline (no server contact)
    const nodeA = createOfflineClient({ nodeId: 'exit-a', api: fakeApi({ fail: true }), actor: 'demo-user' });
    const nodeB = createOfflineClient({ nodeId: 'exit-b', api: fakeApi({ fail: true }), actor: 'demo-user' });
    nodeA.append({ type: 'a.truth', id: 'exit-a-1', payload: { value: 'a-original' } });
    nodeB.append({ type: 'b.truth', id: 'exit-b-1', payload: { value: 'b-original' } });
    assert.equal(nodeA.pendingCount(), 1);
    assert.equal(nodeB.pendingCount(), 1);
    // Reconnect: sync both through the real server
    const liveA = createOfflineClient({ nodeId: 'exit-a', api, actor: 'demo-user' });
    const liveB = createOfflineClient({ nodeId: 'exit-b', api, actor: 'demo-user' });
    liveA.append({ type: 'a.truth', id: 'exit-a-1', payload: { value: 'a-original' } });
    liveB.append({ type: 'b.truth', id: 'exit-b-1', payload: { value: 'b-original' } });
    const rA = await liveA.sync();
    const rB = await liveB.sync();
    assert.equal(rA.synced, true);
    assert.equal(rB.synced, true);
    // Attack: node B tries to overwrite A's event on the server
    await api.submitSync({
      actor: 'demo-user', nodeId: 'exit-b', idempotencyKey: `exit-attack-${Date.now()}`,
      events: [{ id: 'exit-a-1', nodeId: 'exit-b', type: 'a.truth', payload: { value: 'tampered' }, vectorClock: {}, appendedAt: new Date().toISOString() }],
    });
    const read = await api.readSync();
    const ids = read.events.map(e => e.id);
    assert.ok(ids.includes('exit-a-1') && ids.includes('exit-b-1'), 'no event loss through offline → server → readback');
    assert.equal(read.events.find(e => e.id === 'exit-a-1').payload.value, 'a-original', 'no authority leakage end to end');
    assert.equal(liveA.pendingCount(), 0);
    assert.equal(liveB.pendingCount(), 0);
  });
});
