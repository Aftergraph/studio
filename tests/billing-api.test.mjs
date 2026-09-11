import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-api-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20, fixtures: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

async function json(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

function post(body, key) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ actor: 'demo-user', idempotencyKey: key, ...body }),
  };
}

test('GET /api/v1/billing returns canonical billing state and queue projection', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing`);
    assert.equal(response.status, 200);
    assert.equal(body.version, 'aftergraph.workspace.v5');
    assert.ok(Array.isArray(body.billing.customers));
    const statuses = new Map(body.billing.projection.items.map((item) => [item.customerName, item.status]));
    assert.equal(statuses.get('Katrine Rindom Andersen'), 'ready');
    assert.equal(statuses.get('Anton Horsbøl Skjeldmoes'), 'waiting');
    assert.equal(statuses.get('Peder Kjær'), 'needs_info');
  });
});

test('actuals mutation persists and turns a missing-evidence visit ready', async () => {
  await withServer(async (base) => {
    const write = await json(`${base}/api/v1/billing/actuals`, post({
      visitId: 'peder-2026-09-02',
      actual: {
        startedAt: '2026-09-02T08:30:00+02:00',
        endedAt: '2026-09-02T09:30:00+02:00',
        workers: 2,
        workMinutes: 120,
      },
    }, 'billing-actuals-1'));
    assert.equal(write.response.status, 200);
    assert.equal(write.body.visit.actual.workMinutes, 120);

    const read = await json(`${base}/api/v1/billing`);
    const peder = read.body.billing.projection.items.find((item) => item.customerName === 'Peder Kjær');
    assert.equal(peder.status, 'ready');
  });
});

test('draft creation rejects a group whose billing window is still open', async () => {
  await withServer(async (base) => {
    const result = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-anton',
      visitIds: ['anton-2026-09-09'],
      number: '1371',
      issueDate: '2026-09-11',
    }, 'billing-draft-anton'));
    assert.equal(result.response.status, 422);
    assert.equal(result.body.error, 'billing_not_ready');
  });
});

test('ready group can create a deterministic draft with payment terms and duplicate protection', async () => {
  await withServer(async (base) => {
    const request = {
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    };
    const created = await json(`${base}/api/v1/billing/invoices/draft`, post(request, 'billing-draft-katrine'));
    assert.equal(created.response.status, 201);
    assert.equal(created.body.invoice.status, 'draft');
    assert.equal(created.body.invoice.number, '1370');
    assert.equal(created.body.invoice.dueDate, '2026-09-19');
    assert.equal(created.body.invoice.totalGrossMinor, 453700);
    assert.deepEqual(created.body.invoice.visitIds, ['katrine-2026-09-07']);

    const duplicate = await json(`${base}/api/v1/billing/invoices/draft`, post(request, 'billing-draft-katrine-2'));
    assert.equal(duplicate.response.status, 422);
    assert.equal(duplicate.body.error, 'billing_not_ready');
  });
});

test('issue transition is guarded and stable when retried with a fresh request key', async () => {
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    }, 'billing-draft-before-issue'));
    assert.equal(draft.response.status, 201);
    const id = draft.body.invoice.id;

    const issued = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'billing-issue-1'));
    assert.equal(issued.response.status, 200);
    assert.equal(issued.body.invoice.status, 'issued');

    const retried = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'billing-issue-2'));
    assert.equal(retried.response.status, 200);
    assert.equal(retried.body.invoice.status, 'issued');
  });
});

test('consequential billing writes require actor and idempotency key', async () => {
  await withServer(async (base) => {
    const missingActor = await json(`${base}/api/v1/billing/actuals`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'missing-actor' },
      body: JSON.stringify({ visitId: 'peder-2026-09-02', actual: { workMinutes: 120 } }),
    });
    assert.equal(missingActor.response.status, 422);

    const missingKey = await json(`${base}/api/v1/billing/actuals`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'demo-user', visitId: 'peder-2026-09-02', actual: { workMinutes: 120 } }),
    });
    assert.equal(missingKey.response.status, 422);
  });
});
