// User profiles slice-2: server user routes + guard rewire + scoped actors — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-users-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

let keyN = 0;
const post = (base, route, payload) => json(`${base}${route}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': `u${Date.now()}-${(keyN += 1)}` },
  body: JSON.stringify(payload),
});

test('Users: create scoped user, wildcard rejected', async () => {
  await withServer(async base => {
    const wild = await post(base, '/api/v1/users', { actor: 'demo-user', id: 'mallory', capabilities: ['*'] });
    assert.equal(wild.response.status, 422);
    const bad = await post(base, '/api/v1/users', { actor: 'demo-user', id: 'mallory', capabilities: ['teleport'] });
    assert.equal(bad.response.status, 422);
    const alice = await post(base, '/api/v1/users', {
      actor: 'demo-user', id: 'alice', name: 'Alice', role: 'operator', capabilities: ['memory.write'],
    });
    assert.equal(alice.response.status, 201);
    assert.ok(!alice.body.user.capabilities.includes('*'), 'no wildcard issued');
    assert.deepEqual(alice.body.user.capabilities, ['memory.write']);
  });
});

test('Users: profile reads back, unknown is 404', async () => {
  await withServer(async base => {
    await post(base, '/api/v1/users', { actor: 'demo-user', id: 'bob', capabilities: ['memory.write'] });
    const read = await json(`${base}/api/v1/users/bob`);
    assert.equal(read.response.status, 200);
    assert.equal(read.body.user.id, 'bob');
    const missing = await json(`${base}/api/v1/users/nobody`);
    assert.equal(missing.response.status, 404);
  });
});

test('Users: scoped actor passes allowed op, fails forbidden op', async () => {
  await withServer(async base => {
    await post(base, '/api/v1/users', { actor: 'demo-user', id: 'carol', capabilities: ['memory.write'] });
    const ok = await post(base, '/api/v1/memory', {
      actor: 'carol', scope: 'project', label: 'L', value: 'v', source: 'user', idempotencyKey: `c${Date.now()}`,
    });
    assert.equal(ok.response.status, 201, 'scoped user passes granted capability');
    const denied = await post(base, '/api/v1/reset', {
      actor: 'carol', confirmationToken: 'RESET_WORKSPACE', idempotencyKey: `c${Date.now()}-r`,
    });
    assert.equal(denied.response.status, 403, 'scoped user fails missing capability');
  });
});

test('Users: demo-user keeps full access without wildcard', async () => {
  await withServer(async base => {
    const me = await json(`${base}/api/v1/users/demo-user`);
    assert.equal(me.response.status, 200);
    assert.ok(!me.body.user.capabilities.includes('*'), 'seeded demo-user has no wildcard');
    const reset = await post(base, '/api/v1/reset', {
      actor: 'demo-user', confirmationToken: 'RESET_WORKSPACE', idempotencyKey: `d${Date.now()}`,
    });
    assert.equal(reset.response.status, 200, 'demo-user retains reset capability');
  });
});

test('Users: capability grant is scoped and validated', async () => {
  await withServer(async base => {
    await post(base, '/api/v1/users', { actor: 'demo-user', id: 'dave', capabilities: [] });
    const bad = await json(`${base}/api/v1/users/dave/capabilities`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'idempotency-key': `g${Date.now()}` },
      body: JSON.stringify({ actor: 'demo-user', capabilities: ['*'] }),
    });
    assert.equal(bad.response.status, 422);
    const grant = await json(`${base}/api/v1/users/dave/capabilities`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'idempotency-key': `g${Date.now()}-2` },
      body: JSON.stringify({ actor: 'demo-user', capabilities: ['memory.write', 'memory.promote'] }),
    });
    assert.equal(grant.response.status, 200);
    assert.deepEqual(grant.body.user.capabilities, ['memory.write', 'memory.promote']);
    const agentGrant = await json(`${base}/api/v1/users/dave/capabilities`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'idempotency-key': `g${Date.now()}-3` },
      body: JSON.stringify({ actor: 'agent:worker', capabilities: ['memory.write'] }),
    });
    assert.equal(agentGrant.response.status, 403, 'agent cannot grant capabilities');
  });
});
