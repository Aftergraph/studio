// V82-brain-02: server wiring for knowledge lifecycle — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-v82-srv-'));
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

const postMemory = (base, payload, key = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`) =>
  json(`${base}/api/v1/memory`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(payload),
  });

const promote = (base, id, payload, key = `prm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`) =>
  json(`${base}/api/v1/memory/${encodeURIComponent(id)}/promote`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(payload),
  });

test('Brain server: new memory is always ephemeral, client status ignored', async () => {
  await withServer(async base => {
    const { response, body } = await postMemory(base, {
      actor: 'demo-user', scope: 'project', label: 'Style', value: 'Concise.',
      source: 'user preference', confidence: 0.9, status: 'authoritative',
    });
    assert.equal(response.status, 201);
    assert.equal(body.entry.status, 'ephemeral', 'client cannot self-authorize');
    assert.equal(body.entry.confidence, 0.9);
    assert.ok(body.entry.provenance, 'provenance carried');
  });
});

test('Brain server: memory creation validates input', async () => {
  await withServer(async base => {
    const noActor = await postMemory(base, { scope: 's', label: 'l', value: 'v', source: 'r' });
    assert.equal(noActor.response.status, 422);
    const noLabel = await postMemory(base, { actor: 'demo-user', scope: 's', value: 'v', source: 'r' });
    assert.equal(noLabel.response.status, 422);
    const badConf = await postMemory(base, { actor: 'demo-user', scope: 's', label: 'l', value: 'v', source: 'r', confidence: 2 });
    assert.equal(badConf.response.status, 422);
  });
});

test('Brain server: promotion requires human, evidence and confidence', async () => {
  await withServer(async base => {
    const created = await postMemory(base, {
      actor: 'demo-user', scope: 'project', label: 'Low', value: 'hunch', source: 'runtime', confidence: 0.2,
    });
    const id = created.body.entry.id;
    const agent = await promote(base, id, { actor: 'agent:worker', evidence: 'ev1' });
    assert.ok([403, 422].includes(agent.response.status), 'agent cannot promote');
    const noEvidence = await promote(base, id, { actor: 'demo-user' });
    assert.equal(noEvidence.response.status, 422);
    const lowConf = await promote(base, id, { actor: 'demo-user', evidence: 'ev1' });
    assert.equal(lowConf.response.status, 422, 'low confidence needs override');
    const forced = await promote(base, id, { actor: 'demo-user', evidence: 'ev1', override: true });
    assert.equal(forced.response.status, 200);
    assert.equal(forced.body.entry.status, 'authoritative');
    const again = await promote(base, id, { actor: 'demo-user', evidence: 'ev2' });
    assert.equal(again.response.status, 422, 'already authoritative cannot re-promote');
  });
});

test('Brain server: promote unknown id is 404', async () => {
  await withServer(async base => {
    const { response } = await promote(base, 'mem_missing', { actor: 'demo-user', evidence: 'ev1' });
    assert.equal(response.status, 404);
  });
});

test('Brain server: authoritative read excludes ephemeral', async () => {
  await withServer(async base => {
    const created = await postMemory(base, {
      actor: 'demo-user', scope: 'project', label: 'Fresh', value: 'unverified', source: 'runtime', confidence: 0.9,
    });
    const id = created.body.entry.id;
    const before = await json(`${base}/api/v1/memory/authoritative`);
    assert.equal(before.response.status, 200);
    assert.ok(!before.body.entries.some(e => e.id === id), 'ephemeral not in authoritative read');
    await promote(base, id, { actor: 'demo-user', evidence: 'ev1' });
    const after = await json(`${base}/api/v1/memory/authoritative`);
    assert.ok(after.body.entries.some(e => e.id === id), 'promoted appears in authoritative read');
  });
});
