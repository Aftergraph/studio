import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { issueMagicToken } from '../src/auth/magic-link.mjs';
import { createUser, getUser, updateCapabilities } from '../src/user/user-store.mjs';
import { normalizeCapabilities, listGrantableCapabilities } from '../src/user/capability-set.mjs';

function ensureUser(id, capabilities) {
  if (getUser(id)) return updateCapabilities(id, capabilities);
  return createUser({ id, name: id, role: 'integration', capabilities });
}

async function withProductionServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-source-'));
  const secret = 'billing-source-test-secret';
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: path.join(dir, 'state.json'), fixtures: false, requireAuth: true, authSecret: secret, runtimeIntervalMs: 20 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`, secret); }
  finally { await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}
function syncRequest(actor, token, key, source, customers, visits) {
  return fetchArgs({ schema: 'aftergraph.billing.source.v1', actor, source, customers, visits }, token, key);
}

function fetchArgs(body, token, key) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    },
    body: JSON.stringify({ ...body, idempotencyKey: key }),
  };
}

async function json(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

const customer = {
  id: 'live-customer', name: 'Live Customer', address: 'Livevej 1, 8000 Aarhus C',
  email: 'live@example.test', status: 'active',
  billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 },
};
const visit = {
  id: 'live-visit', customerId: customer.id,
  scheduledStart: '2026-09-11T08:00:00+02:00', scheduledEnd: '2026-09-11T09:00:00+02:00',
  status: 'completed', actual: { workers: 2, workMinutes: 120 },
};

const source = { id: 'pilot-ops', revision: 'rev-001', syncedAt: '2026-09-11T20:00:00.000Z' };

test('billing.sync is a separately grantable capability', () => {
  assert.deepEqual(normalizeCapabilities(['billing.sync']), ['billing.sync']);
  assert.ok(listGrantableCapabilities().includes('billing.sync'));
});

test('billing.sync imports operational source data into a new production tenant', async () => {
  const actor = 'billing-source-operator';
  ensureUser(actor, ['billing.sync']);
  await withProductionServer(async (base, secret) => {
    const token = issueMagicToken({ userId: actor, secret });
    const result = await json(`${base}/api/v1/billing/sync`, syncRequest(actor, token, 'sync-1', source, [customer], [visit]));
    assert.equal(result.response.status, 200);
    assert.equal(result.body.sync.sourceId, 'pilot-ops');
    assert.equal(result.body.sync.revision, 'rev-001');
    assert.equal(result.body.billing.customers[0].id, customer.id);
    assert.equal(result.body.billing.visits[0].id, visit.id);
  });
});
test('source revision replay is idempotent with a fresh action key', async () => {
  const actor = 'billing-source-replay';
  ensureUser(actor, ['billing.sync']);
  await withProductionServer(async (base, secret) => {
    const token = issueMagicToken({ userId: actor, secret });
    const first = await json(`${base}/api/v1/billing/sync`, syncRequest(actor, token, 'sync-a', source, [customer], [visit]));
    assert.equal(first.response.status, 200);
    const replay = await json(`${base}/api/v1/billing/sync`, syncRequest(actor, token, 'sync-b', source, [customer], [visit]));
    assert.equal(replay.response.status, 200);
    assert.equal(replay.body.sync.replayed, true);
    assert.equal(replay.body.billing.customers.length, 1);
    assert.equal(replay.body.billing.visits.length, 1);
  });
});

test('billing.manage alone cannot perform source sync', async () => {
  const actor = 'billing-manage-only';
  ensureUser(actor, ['billing.manage']);
  await withProductionServer(async (base, secret) => {
    const token = issueMagicToken({ userId: actor, secret });
    const result = await json(`${base}/api/v1/billing/sync`, syncRequest(actor, token, 'sync-denied', source, [customer], [visit]));
    assert.equal(result.response.status, 403);
    assert.equal(result.body.error, 'forbidden');
  });
});
test('billing.sync producer can target its assigned company workspace without gaining billing.manage', async () => {
  const owner = `billing-owner-${Date.now()}`;
  const worker = `${owner}-renos`;
  createUser({ id: owner, name: owner, role: 'owner', capabilities: ['billing.manage'] });
  createUser({ id: worker, name: worker, role: 'integration', workspaceId: owner, capabilities: ['billing.sync'] });
  await withProductionServer(async (base, secret) => {
    const workerToken = issueMagicToken({ userId: worker, secret });
    const ownerToken = issueMagicToken({ userId: owner, secret });
    const pushed = await json(`${base}/api/v1/billing/sync`, syncRequest(worker, workerToken, 'delegated-sync', source, [customer], [visit]));
    assert.equal(pushed.response.status, 200);

    const ownerRead = await json(`${base}/api/v1/billing?actor=${encodeURIComponent(owner)}`, {
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(ownerRead.response.status, 200);
    assert.equal(ownerRead.body.billing.customers[0].id, customer.id);
    assert.equal(ownerRead.body.billing.visits[0].id, visit.id);
    assert.equal(getUser(worker).capabilities.includes('billing.manage'), false);
  });
});
