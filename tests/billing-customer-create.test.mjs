import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-customer-'));
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

test('POST /api/v1/billing/customers creates a new customer and returns it in billing state', async () => {
  await withServer(async (base) => {
    const payload = {
      id: 'customer-new-slice',
      name: 'Ny Kunde A/S',
      address: 'Testvej 1, 8000 Aarhus',
      email: 'ny@example.test',
      countryCode: 'DK',
      registrationId: '12345678',
      billing: {
        mode: 'per_visit',
        paymentTermsDays: 8,
        rateMinor: 34900,
        currency: 'DKK',
      },
    };
    const created = await json(`${base}/api/v1/billing/customers`, post(payload, 'billing-customer-create-1'));
    assert.equal(created.response.status, 201);
    assert.equal(created.body.customer.id, 'customer-new-slice');
    assert.equal(created.body.customer.name, 'Ny Kunde A/S');
    assert.equal(created.body.customer.billing.mode, 'per_visit');
    assert.equal(created.body.customer.createdBy, 'demo-user');

    const read = await json(`${base}/api/v1/billing`);
    const found = read.body.billing.customers.find((c) => c.id === 'customer-new-slice');
    assert.ok(found, 'new customer appears in GET /api/v1/billing');
    assert.equal(found.name, 'Ny Kunde A/S');
  });
});

test('POST /api/v1/billing/customers rejects duplicate id with 409', async () => {
  await withServer(async (base) => {
    const payload = {
      id: 'customer-dup',
      name: 'Dup Kunde',
      billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 10000, currency: 'DKK' },
    };
    const first = await json(`${base}/api/v1/billing/customers`, post(payload, 'billing-customer-dup-1'));
    assert.equal(first.response.status, 201);

    const second = await json(`${base}/api/v1/billing/customers`, post(payload, 'billing-customer-dup-2'));
    assert.equal(second.response.status, 409);
    assert.equal(second.body.error, 'customer_id_conflict');
  });
});

test('POST /api/v1/billing/customers validates required fields and billing shape', async () => {
  await withServer(async (base) => {
    const missingName = await json(`${base}/api/v1/billing/customers`, post({
      id: 'customer-no-name',
      billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 10000, currency: 'DKK' },
    }, 'billing-customer-validate-1'));
    assert.equal(missingName.response.status, 422);
    assert.equal(missingName.body.error, 'customer_name_required');

    const badMode = await json(`${base}/api/v1/billing/customers`, post({
      id: 'customer-bad-mode',
      name: 'Bad Mode',
      billing: { mode: 'invalid', paymentTermsDays: 8, rateMinor: 10000, currency: 'DKK' },
    }, 'billing-customer-validate-2'));
    assert.equal(badMode.response.status, 422);
    assert.equal(badMode.body.error, 'invalid_billing_mode');
  });
});
