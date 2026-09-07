import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server.mjs';

test('idle user stores are evicted past the cap and reseed on access', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-evict-'));
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'), runtimeIntervalMs: 20, maxUserStores: 2 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const post = (body, key) => fetch(`http://127.0.0.1:${port}/api/v1/users`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify(body),
    });
    for (const id of ['u1', 'u2', 'u3']) {
      const res = await post({ actor: 'demo-user', id, capabilities: [] }, `evict-seed-${id}`);
      assert.equal(res.status, 201, `seed ${id}`);
    }
    const snap = async actor => (await (await fetch(`http://127.0.0.1:${port}/api/v1/state?actor=${actor}`)).json()).state;
    await snap('u1');
    await snap('u2');
    await snap('u3');
    const ids = [...server.workspace.stores.keys()].sort();
    assert.ok(ids.length <= 3, `bounded stores, got ${ids}`);
    assert.ok(!ids.includes('u1') || ids.includes('u3'), 'oldest idle evicted first');
    assert.ok(ids.includes('demo-user'), 'default scope never evicted');
    const reseeded = await snap('u1');
    assert.ok(Array.isArray(reseeded.conversations), 'evicted user reseeds cleanly on access');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test('evicted user data reloads from disk on next access', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-evict-disk-'));
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'), runtimeIntervalMs: 20, maxUserStores: 2 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const post = (path, body, key) => fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify(body),
    }).then(async r => ({ status: r.status, json: await r.json() }));
    for (const id of ['w1', 'w2', 'w3', 'w4']) {
      await post('/api/v1/users', { actor: 'demo-user', id, capabilities: ['memory.write'] }, `dseed-${id}`);
    }
    const w = await post('/api/v1/conversations', { actor: 'w1', title: 'Keep me' }, 'w1-conv');
    assert.equal(w.status, 201);
    const convId = w.json.conversation.id;
    for (const a of ['w2', 'w3', 'w4']) await fetch(`http://127.0.0.1:${port}/api/v1/state?actor=${a}`);
    assert.ok(!server.workspace.stores.has('w1'), 'w1 evicted from memory');
    const back = await (await fetch(`http://127.0.0.1:${port}/api/v1/state?actor=w1`)).json();
    assert.ok(back.state.conversations.some(c => c.id === convId), 'conversation reloads from disk after eviction');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
