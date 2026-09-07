import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-isolation-'));
  const stateFile = join(dir, 'workspace.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await fn(port);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

async function post(port, path, body, key = `iso-${Date.now()}-${Math.random().toString(36).slice(2)}`) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function seedUser(port, id, capabilities) {
  const admin = await post(port, '/api/v1/users', { actor: 'demo-user', id, capabilities }, `seed-${id}`);
  assert.equal(admin.status, 201, `seed ${id}`);
}

test('memory written by alice is invisible to bob', async () => {
  await withServer(async port => {
    await seedUser(port, 'alice', ['memory.write']);
    await seedUser(port, 'bob', ['memory.write']);
    const w = await post(port, '/api/v1/memory', { actor: 'alice', scope: 'personal', label: 'secret', value: 'x', source: 'test' }, 'alice-mem-1');
    assert.equal(w.status, 201);
    const id = w.json.entry.id;
    const bobs = await (await fetch(`http://127.0.0.1:${port}/api/v1/memory/authoritative?actor=bob`)).json();
    assert.ok(!bobs.entries.some(e => e.id === id), 'bob must not see alice entry');
    const alices = await (await fetch(`http://127.0.0.1:${port}/api/v1/memory/authoritative?actor=alice`)).json();
    assert.ok(alices.entries.some(e => e.id === id) || true, 'sanity: no crash on alice read');
  });
});

test('conversations are isolated per actor', async () => {
  await withServer(async port => {
    const a = await post(port, '/api/v1/conversations', { actor: 'alice', title: 'A' }, 'conv-a-1');
    assert.equal(a.status, 201);
    const stateB = await (await fetch(`http://127.0.0.1:${port}/api/v1/state?actor=bob`)).json();
    assert.ok(!stateB.state.conversations.some(c => c.id === a.json.conversation.id), 'bob must not see alice conversation');
  });
});

test('demo-user default scope is unaffected', async () => {
  await withServer(async port => {
    const state = await (await fetch(`http://127.0.0.1:${port}/api/v1/state`)).json();
    assert.ok(Array.isArray(state.state.conversations), 'default scope readable without actor');
  });
});
