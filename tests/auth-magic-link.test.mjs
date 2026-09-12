import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { issueMagicToken, verifyMagicToken } from '../src/auth/magic-link.mjs';
import { createAppServer } from '../server.mjs';

const SECRET = 'test-secret-123';

test('token round-trips to the same user', () => {
  const token = issueMagicToken({ userId: 'alice', secret: SECRET });
  assert.equal(verifyMagicToken(token, { secret: SECRET }).userId, 'alice');
});

test('tampered token is rejected', () => {
  const token = issueMagicToken({ userId: 'alice', secret: SECRET });
  const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => verifyMagicToken(tampered, { secret: SECRET }), /bad_signature/);
});

test('expired token is rejected', () => {
  const token = issueMagicToken({ userId: 'alice', secret: SECRET, ttlMs: 1000, now: 1000 });
  assert.throws(() => verifyMagicToken(token, { secret: SECRET, now: 5000 }), /expired/);
});

test('wrong secret is rejected', () => {
  const token = issueMagicToken({ userId: 'alice', secret: SECRET });
  assert.throws(() => verifyMagicToken(token, { secret: 'other' }), /bad_signature/);
});

test('auth server: requireAuth mode rejects bare actors, accepts tokens', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-auth-strict-'));
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'), runtimeIntervalMs: 20, authSecret: SECRET, requireAuth: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    assert.ok(server.workspace.bootToken, 'bootstraps a demo-user token');
    const bare = await post(port, '/api/v1/memory', { actor: 'demo-user', scope: 's', label: 'l', value: 'v', source: 't' }, 'strict-bare-1');
    assert.equal(bare.status, 401, 'bare actor rejected in requireAuth mode');
    const authed = await post(port, '/api/v1/memory', { actor: 'demo-user', scope: 's', label: 'l', value: 'v', source: 't' }, 'strict-ok-1', { authorization: `Bearer ${server.workspace.bootToken}` });
    assert.equal(authed.status, 201, 'boot token accepted');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});

test('auth server: magic-link issuance is rate limited per IP', async () => {
  await withServer(async port => {
    const admin = await post(port, '/api/v1/users', { actor: 'demo-user', id: 'rl-user', capabilities: [] }, 'rl-seed');
    assert.equal(admin.status, 201);
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const r = await post(port, '/api/v1/auth/magic-link', { actor: 'demo-user', userId: 'rl-user' }, `rl-${i}`);
      last = r.status;
    }
    assert.equal(last, 429, 'eleventh issuance in the hour is throttled');
  });
});

async function withServer(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-auth-'));
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'), runtimeIntervalMs: 20, authSecret: SECRET });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

async function post(port, path, body, key, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key, ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('auth server: token issuance is capability-gated and binding enforced', async () => {
  await withServer(async port => {
    const admin = await post(port, '/api/v1/users', { actor: 'demo-user', id: 'alice', capabilities: ['memory.write'] }, 'auth-alice');
    assert.equal(admin.status, 201);
    const issued = await post(port, '/api/v1/auth/magic-link', { actor: 'demo-user', userId: 'alice' }, 'auth-issue-1');
    assert.equal(issued.status, 201);
    assert.match(issued.json.token, /^v1\./);
    const me = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, { headers: { authorization: `Bearer ${issued.json.token}` } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).userId, 'alice');
    const mismatch = await post(port, '/api/v1/memory', { actor: 'bob', scope: 's', label: 'l', value: 'v', source: 't' }, 'auth-mm-1', { authorization: `Bearer ${issued.json.token}` });
    assert.equal(mismatch.status, 403, 'token subject must match actor');
    const bad = await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`, { headers: { authorization: 'Bearer v1.forged.sig' } });
    assert.equal(bad.status, 403, 'forged token rejected');
  });
});

test('auth server: static Billing shell stays public while API remains bearer-gated', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-auth-static-'));
  const server = createAppServer({
    root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'),
    runtimeIntervalMs: 20, authSecret: SECRET, requireAuth: true, fixtures: false,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const shell = await fetch(`http://127.0.0.1:${port}/billing/`);
    assert.equal(shell.status, 200, 'static Billing shell must load before browser token auth');
    assert.match(await shell.text(), /Aftergraph Billing/);
    const api = await fetch(`http://127.0.0.1:${port}/api/v1/state`);
    assert.equal(api.status, 401, 'API remains bearer-gated');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
