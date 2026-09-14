import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { issueMagicToken } from '../src/auth/magic-link.mjs';
import { createUser } from '../src/user/user-store.mjs';
import { pushBillingSourceEnvelope } from '../scripts/billing_source_push.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-prod-ingest-'));
  const authSecret = `prod-ingest-${Date.now()}`;
  const server = createAppServer({
    root: new URL('../', import.meta.url), stateFile: path.join(dir, 'state.json'),
    fixtures: false, requireAuth: true, authSecret, runtimeIntervalMs: 20,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await fn({ baseUrl: `http://127.0.0.1:${server.address().port}`, authSecret, server }); }
  finally { await new Promise((resolve) => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
}

test('production tenant ingests source data without demo fixtures and owner can read it', async () => {
  await withServer(async ({ baseUrl, authSecret, server }) => {
    const suffix = Date.now().toString(36);
    const ownerId = `pilot-owner-${suffix}`;
    const workerId = `pilot-sync-${suffix}`;
    createUser({ id: ownerId, role: 'owner', capabilities: ['billing.manage'] });
    createUser({ id: workerId, role: 'integration', workspaceId: ownerId, capabilities: ['billing.sync'] });
    const ownerToken = issueMagicToken({ userId: ownerId, secret: authSecret });
    const workerToken = issueMagicToken({ userId: workerId, secret: authSecret });

    const ownerStore = server.workspace.storeFor(ownerId);
    await ownerStore.readyP;
    assert.equal(ownerStore.snapshot().fixtureMode, false);
    assert.equal(ownerStore.snapshot().billing.customers.length, 0);

    const envelope = {
      schema: 'aftergraph.billing.source.v1',
      source: { id: 'renos-control', revision: 'prod-r1', syncedAt: '2026-09-12T06:00:00.000Z' },
      customers: [{ id: 'customer-1', name: 'Pilot Customer', address: 'Pilotvej 1, Aarhus', email: 'pilot@example.test', status: 'active', billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 } }],
      visits: [{ id: 'visit-1', customerId: 'customer-1', scheduledStart: '2026-09-12T08:00:00+02:00', scheduledEnd: '2026-09-12T10:00:00+02:00', status: 'completed', actual: { workMinutes: 240, workers: 2 } }],
    };

    const pushed = await pushBillingSourceEnvelope(envelope, {
      baseUrl, actor: workerId, token: workerToken, key: 'prod-r1',
    });
    assert.equal(pushed.sync.sourceId, 'renos-control');
    assert.equal(pushed.sync.revision, 'prod-r1');

    const ownerBilling = ownerStore.snapshot().billing;
    assert.equal(ownerBilling.customers.length, 1);
    assert.equal(ownerBilling.customers[0].id, 'customer-1');
    assert.equal(ownerBilling.visits.length, 1);
    assert.equal(ownerBilling.visits[0].actual.workMinutes, 240);
    assert.equal(ownerStore.snapshot().fixtureMode, false);

    const worker = server.workspace.storeFor(workerId);
    await worker.readyP;
    assert.equal(worker.snapshot().billing.customers.length, 0);
    assert.ok(ownerToken);
  });
});
