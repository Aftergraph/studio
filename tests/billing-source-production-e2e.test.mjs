import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { issueMagicToken } from '../src/auth/magic-link.mjs';
import { createUser, getUser, updateCapabilities } from '../src/user/user-store.mjs';
import { buildBillingSourceEnvelope } from '../src/billing/source-contract.mjs';
import { pushBillingSourceEnvelope } from '../scripts/billing_source_push.mjs';

function ensurePilot(id) {
  const capabilities = ['billing.manage', 'billing.sync'];
  if (getUser(id)) return updateCapabilities(id, capabilities);
  return createUser({ id, name: 'Billing Pilot', role: 'operator', capabilities });
}

const customer = {
  id: 'pilot-customer', name: 'Pilot Kunde', address: 'Pilotvej 1, 8000 Aarhus C',
  status: 'active', billing: {
    mode: 'per_visit', paymentTermsDays: 8, rateMinor: 34900,
    currency: 'DKK', discountPercent: 0,
  },
};

const visit = {
  id: 'pilot-visit', customerId: customer.id,
  scheduledStart: '2026-09-11T09:00:00+02:00',
  scheduledEnd: '2026-09-11T11:00:00+02:00',
  status: 'completed', actual: { workMinutes: 120 },
};

test('production tenant accepts governed source push with fixtures disabled', async () => {
  const actor = 'billing-public-pilot';
  ensurePilot(actor);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'billing-prod-e2e-'));
  const authKey = 'billing-production-e2e-key';
  const server = createAppServer({
    root: new URL('../', import.meta.url), stateFile: path.join(dir, 'state.json'),
    fixtures: false, requireAuth: true, authSecret: authKey, runtimeIntervalMs: 20,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const token = issueMagicToken({ userId: actor, secret: authKey });
    const envelope = buildBillingSourceEnvelope({
      sourceId: 'renos-control', revision: 'pilot-r1',
      syncedAt: '2026-09-11T21:00:00.000Z', customers: [customer], visits: [visit],
    });
    const pushed = await pushBillingSourceEnvelope(envelope, {
      baseUrl, actor, token, key: 'pilot-r1',
    });
    assert.equal(pushed.sync.sourceId, 'renos-control');
    assert.equal(pushed.sync.replayed, false);
    assert.equal(pushed.billing.customers.length, 1);
    assert.equal(pushed.billing.customers[0].id, customer.id);
    assert.equal(pushed.billing.visits.length, 1);
    assert.equal(pushed.billing.visits[0].id, visit.id);
    assert.equal(pushed.billing.invoices.length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
});
