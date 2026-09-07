import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server.mjs';

const FUTURE = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

async function withServer(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-goals-'));
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'), runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

async function post(port, path, body, key) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

const goalBody = owner => ({ actor: 'demo-user', owner, successCriteria: [{ predicate: 'ship v1' }], budgetCents: 10000, horizonEnd: FUTURE });

test('goals server: create requires human owner and goal.manage', async () => {
  await withServer(async port => {
    const agent = await post(port, '/api/v1/goals', { ...goalBody('agent:worker') }, 'g-agent-1');
    assert.equal(agent.status, 422, 'agent owner rejected');
    const created = await post(port, '/api/v1/goals', { ...goalBody('demo-user'), id: 'goal_1' }, 'g-ok-1');
    assert.equal(created.status, 201);
    assert.equal(created.json.goal.owner, 'demo-user');
    const list = await (await fetch(`http://127.0.0.1:${port}/api/v1/goals?actor=demo-user`)).json();
    assert.ok(list.goals.some(g => g.id === 'goal_1'), 'goal listed in user scope');
  });
});

test('goals server: mission linkage rolls progress up', async () => {
  await withServer(async port => {
    await post(port, '/api/v1/goals', { ...goalBody('demo-user'), id: 'goal_link' }, 'g-link-1');
    const state = await (await fetch(`http://127.0.0.1:${port}/api/v1/state?actor=demo-user`)).json();
    const missionId = state.state.missions[0].id;
    const link = await fetch(`http://127.0.0.1:${port}/api/v1/missions/${missionId}/goal`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'idempotency-key': 'link-1' },
      body: JSON.stringify({ actor: 'demo-user', goalId: 'goal_link' }),
    });
    assert.equal(link.status, 200);
    const progress = await (await fetch(`http://127.0.0.1:${port}/api/v1/goals/goal_link/progress?actor=demo-user`)).json();
    assert.equal(progress.linkedMissions, 1);
    assert.ok(typeof progress.averageProgress === 'number', 'average progress computed');
    const bad = await fetch(`http://127.0.0.1:${port}/api/v1/missions/${missionId}/goal`, {
      method: 'PATCH', headers: { 'content-type': 'application/json', 'idempotency-key': 'link-2' },
      body: JSON.stringify({ actor: 'demo-user', goalId: 'nope' }),
    });
    assert.equal(bad.status, 404, 'unknown goal rejected');
  });
});
