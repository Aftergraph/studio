// V83-autonomy-02: server wiring for kill switch + allowance — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-v83-srv-'));
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
const key = () => `v83-${Date.now()}-${(keyN += 1)}`;
const post = (base, route, payload) => json(`${base}${route}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key() },
  body: JSON.stringify(payload),
});

test('Autonomy server: human engages kill switch, agent is refused', async () => {
  await withServer(async base => {
    const agent = await post(base, '/api/v1/autonomy/kill', { actor: 'agent:worker', scope: 'mission:m1', reason: 'x' });
    assert.equal(agent.response.status, 403);
    const noReason = await post(base, '/api/v1/autonomy/kill', { actor: 'demo-user', scope: 'mission:m1' });
    assert.equal(noReason.response.status, 422);
    const ok = await post(base, '/api/v1/autonomy/kill', { actor: 'demo-user', scope: 'mission:m1', reason: 'cost spike' });
    assert.equal(ok.response.status, 200);
    assert.equal(ok.body.switch.engaged, true);
    assert.equal(ok.body.switch.scope, 'mission:m1');
  });
});

test('Autonomy server: kill state reads back, human releases', async () => {
  await withServer(async base => {
    const fresh = await json(`${base}/api/v1/autonomy/kill?scope=mission%3Am9`);
    assert.equal(fresh.response.status, 200);
    assert.equal(fresh.body.switch.engaged, false);
    await post(base, '/api/v1/autonomy/kill', { actor: 'demo-user', scope: 'mission:m9', reason: 'stop' });
    const engaged = await json(`${base}/api/v1/autonomy/kill?scope=mission%3Am9`);
    assert.equal(engaged.body.switch.engaged, true);
    const agentRelease = await post(base, '/api/v1/autonomy/kill/release', { actor: 'agent:worker', scope: 'mission:m9' });
    assert.equal(agentRelease.response.status, 403);
    const release = await post(base, '/api/v1/autonomy/kill/release', { actor: 'demo-user', scope: 'mission:m9' });
    assert.equal(release.response.status, 200);
    assert.equal(release.body.switch.engaged, false);
  });
});

test('Autonomy server: spend then allowance denies at budget', async () => {
  await withServer(async base => {
    const allowed = await post(base, '/api/v1/autonomy/allowance', { actor: 'demo-user', missionId: 'mB', budgetCents: 1000 });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.body.allowed, true);
    assert.equal(allowed.body.remainingCents, 1000);
    const badCost = await post(base, '/api/v1/autonomy/cost', { actor: 'demo-user', missionId: 'mB', kind: 'agent', amountCents: -5 });
    assert.equal(badCost.response.status, 422);
    const cost = await post(base, '/api/v1/autonomy/cost', { actor: 'demo-user', missionId: 'mB', kind: 'agent', amountCents: 1000, evidenceRef: 'ev1' });
    assert.equal(cost.response.status, 201);
    const denied = await post(base, '/api/v1/autonomy/allowance', { actor: 'demo-user', missionId: 'mB', budgetCents: 1000 });
    assert.equal(denied.response.status, 422);
    assert.equal(denied.body.error, 'autonomy_budget_exhausted');
  });
});

test('Autonomy server: engaged kill and denied policy block allowance', async () => {
  await withServer(async base => {
    await post(base, '/api/v1/autonomy/kill', { actor: 'demo-user', scope: 'mission:mK', reason: 'halt' });
    const killed = await post(base, '/api/v1/autonomy/allowance', { actor: 'demo-user', missionId: 'mK', budgetCents: 5000 });
    assert.equal(killed.response.status, 422);
    assert.equal(killed.body.error, 'autonomy_killed');
    const policy = await post(base, '/api/v1/autonomy/allowance', { actor: 'demo-user', missionId: 'mP', budgetCents: 5000, policyOk: false });
    assert.equal(policy.response.status, 422);
    assert.equal(policy.body.error, 'autonomy_policy_denied');
  });
});
