// V81-distributed-03: server-side sync for offline event logs — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-v81-sync-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive:true, force:true }); }
}

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

const post = (base, payload, key = 'sync-test-key') => json(`${base}/api/v1/sync/events`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'idempotency-key': key },
  body: JSON.stringify(payload),
});

function evt(nodeId, seq, type = 'test.event') {
  return {
    id: `evt_${nodeId}_${seq}`,
    nodeId,
    type,
    payload: { seq },
    vectorClock: { [nodeId]: seq },
    appendedAt: new Date(Date.UTC(2026, 8, 7, 0, 0, seq)).toISOString(),
  };
}

test('Sync: node submits offline events, server merges and returns converged log', async () => {
  await withServer(async base => {
    const { response, body } = await post(base, {
      actor: 'demo-user',
      nodeId: 'node-a',
      idempotencyKey: 'sync-a-1',
      events: [evt('node-a', 1), evt('node-a', 2)],
    });
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.events), 'response must carry converged events');
    assert.ok(body.clock && typeof body.clock === 'object', 'response must carry server clock');
    const ids = body.events.map(e => e.id);
    assert.ok(ids.includes('evt_node-a_1'));
    assert.ok(ids.includes('evt_node-a_2'));
  });
});

test('Sync: missing actor, nodeId or events are rejected', async () => {
  await withServer(async base => {
    const noActor = await post(base, { nodeId: 'node-a', events: [] }, 'k1');
    assert.equal(noActor.response.status, 422);
    const noNode = await post(base, { actor: 'demo-user', events: [] }, 'k2');
    assert.equal(noNode.response.status, 422);
    const noEvents = await post(base, { actor: 'demo-user', nodeId: 'node-a' }, 'k3');
    assert.equal(noEvents.response.status, 422);
    const badEvent = await post(base, {
      actor: 'demo-user', nodeId: 'node-a', events: [{ type: 'no-id' }],
    }, 'k4');
    assert.equal(badEvent.response.status, 422);
  });
});

test('Sync: two nodes converge through the server without loss', async () => {
  await withServer(async base => {
    await post(base, {
      actor: 'demo-user', nodeId: 'node-a', idempotencyKey: 'sync-a-2',
      events: [evt('node-a', 1, 'a.offline'), evt('node-a', 2, 'a.offline')],
    });
    await post(base, {
      actor: 'demo-user', nodeId: 'node-b', idempotencyKey: 'sync-b-2',
      events: [evt('node-b', 1, 'b.offline'), evt('node-b', 2, 'b.offline'), evt('node-b', 3, 'b.offline')],
    });
    const read = await json(`${base}/api/v1/sync/events`);
    assert.equal(read.response.status, 200);
    assert.equal(read.body.events.length, 5, 'all events from both nodes preserved');
    const ids = read.body.events.map(e => e.id).sort();
    assert.deepEqual(ids, ['evt_node-a_1', 'evt_node-a_2', 'evt_node-b_1', 'evt_node-b_2', 'evt_node-b_3']);
    // Deterministic order: repeated reads return identical ordering
    const read2 = await json(`${base}/api/v1/sync/events`);
    assert.deepEqual(read2.body.events.map(e => e.id), read.body.events.map(e => e.id));
  });
});

test('Sync: duplicate submit does not duplicate events', async () => {
  await withServer(async base => {
    const payload = {
      actor: 'demo-user', nodeId: 'node-a', idempotencyKey: 'sync-dup-1',
      events: [evt('node-a', 1)],
    };
    await post(base, payload, 'dup-key-1');
    const replay = await post(base, payload, 'dup-key-1');
    assert.equal(replay.response.status, 200);
    const read = await json(`${base}/api/v1/sync/events`);
    assert.equal(read.body.events.filter(e => e.id === 'evt_node-a_1').length, 1);
  });
});

test('Sync: conflicting payload with same id does not overwrite server truth', async () => {
  await withServer(async base => {
    await post(base, {
      actor: 'demo-user', nodeId: 'node-a', idempotencyKey: 'sync-fw-1',
      events: [{ ...evt('node-a', 1), payload: { value: 'original' } }],
    }, 'fw-key-1');
    await post(base, {
      actor: 'demo-user', nodeId: 'node-b', idempotencyKey: 'sync-fw-2',
      events: [{ ...evt('node-a', 1), payload: { value: 'tampered' }, nodeId: 'node-b' }],
    }, 'fw-key-2');
    const read = await json(`${base}/api/v1/sync/events`);
    const found = read.body.events.find(e => e.id === 'evt_node-a_1');
    assert.equal(found.payload.value, 'original', 'first writer wins on the server');
  });
});
