import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createAppServer } from '../server.mjs';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function withBillingServer(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'billing-manual-draft-'));
  const server = createAppServer({
    root: new URL('../', import.meta.url),
    stateFile: path.join(dir, 'state.json'),
    runtimeIntervalMs: 20,
    ...options,
  });
  const base = await listen(server);
  try {
    await fn({ base, dir, server });
  } finally {
    server.close();
    await once(server, 'close');
    await rm(dir, { recursive: true, force: true });
  }
}

async function req(base, urlPath, options = {}) {
  const response = await fetch(`${base}${urlPath}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

function writeHeaders(idempotencyKey) {
  return {
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey,
  };
}

async function seedCustomer(base) {
  const { response, body } = await req(base, '/api/v1/billing/customers', {
    method: 'POST',
    headers: writeHeaders('seed-cust-manual'),
    body: JSON.stringify({
      actor: 'demo-user',
      id: 'cust-manual',
      name: 'Manual Test ApS',
      address: 'Testvej 1, 1000 København',
      countryCode: 'DK',
      billing: { currency: 'DKK', paymentTermsDays: 8 },
    }),
  });
  assert.equal(response.status, 201, `customer seed failed: ${response.status} ${JSON.stringify(body)}`);
  return body.customer;
}

test('POST /api/v1/billing/invoices/manual-draft creates a manual draft and persists it', async () => {
  await withBillingServer(async ({ base }) => {
    await seedCustomer(base);
    const { response, body } = await req(base, '/api/v1/billing/invoices/manual-draft', {
      method: 'POST',
      headers: writeHeaders('manual-create-1'),
      body: JSON.stringify({
        actor: 'demo-user',
        customerId: 'cust-manual',
        lines: [
          { description: 'Konsulentbistand', quantity: 2, unitPriceMinor: 50000 },
        ],
        number: 'MAN-001',
        issueDate: '2026-09-13',
      }),
    });
    assert.equal(response.status, 201);
    assert.equal(body.invoice.source, 'manual');
    assert.equal(body.invoice.status, 'draft');
    assert.equal(body.invoice.number, 'MAN-001');
    assert.equal(body.invoice.customerId, 'cust-manual');
    assert.equal(body.invoice.manualLines.length, 1);
    assert.equal(body.invoice.manualLines[0].description, 'Konsulentbistand');
    assert.ok(body.invoice.id);

    // Persistence readback via GET billing state
    const state = await req(base, '/api/v1/billing');
    assert.equal(state.response.status, 200);
    const persisted = state.body.billing.invoices.find((inv) => inv.id === body.invoice.id);
    assert.ok(persisted, 'manual draft must persist in billing state');
    assert.equal(persisted.source, 'manual');
    assert.equal(persisted.number, 'MAN-001');
  });
});

test('PATCH /api/v1/billing/invoices/:id updates a manual draft', async () => {
  await withBillingServer(async ({ base }) => {
    await seedCustomer(base);
    const created = await req(base, '/api/v1/billing/invoices/manual-draft', {
      method: 'POST',
      headers: writeHeaders('manual-create-2'),
      body: JSON.stringify({
        actor: 'demo-user',
        customerId: 'cust-manual',
        lines: [{ description: 'Original', quantity: 1, unitPriceMinor: 10000 }],
        number: 'MAN-002',
        issueDate: '2026-09-13',
      }),
    });
    assert.equal(created.response.status, 201);
    const invoiceId = created.body.invoice.id;

    const { response, body } = await req(base, `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'PATCH',
      headers: writeHeaders('manual-update-1'),
      body: JSON.stringify({
        actor: 'demo-user',
        lines: [{ description: 'Opdateret', quantity: 3, unitPriceMinor: 20000 }],
        issueDate: '2026-09-14',
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(body.invoice.manualLines[0].description, 'Opdateret');
    assert.equal(body.invoice.manualLines[0].quantity, 3);
    assert.equal(body.invoice.issueDate, '2026-09-14');
    assert.equal(body.invoice.id, invoiceId);
  });
});

test('PATCH /api/v1/billing/invoices/:id denies edit on issued invoice', async () => {
  await withBillingServer(async ({ base }) => {
    await seedCustomer(base);
    const created = await req(base, '/api/v1/billing/invoices/manual-draft', {
      method: 'POST',
      headers: writeHeaders('manual-create-3'),
      body: JSON.stringify({
        actor: 'demo-user',
        customerId: 'cust-manual',
        lines: [{ description: 'Line', quantity: 1, unitPriceMinor: 10000 }],
        number: 'MAN-003',
        issueDate: '2026-09-13',
      }),
    });
    const invoiceId = created.body.invoice.id;

    // Issue the invoice
    const issued = await req(base, `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/issue`, {
      method: 'POST',
      headers: writeHeaders('manual-issue-1'),
      body: JSON.stringify({ actor: 'demo-user' }),
    });
    assert.equal(issued.response.status, 200);

    // Attempt edit after issue
    const { response, body } = await req(base, `/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'PATCH',
      headers: writeHeaders('manual-update-denied-1'),
      body: JSON.stringify({
        actor: 'demo-user',
        lines: [{ description: 'Nope', quantity: 1, unitPriceMinor: 10000 }],
      }),
    });
    assert.equal(response.status, 422);
    assert.equal(body.error, 'invoice_not_editable');
  });
});

test('POST /api/v1/billing/invoices/manual-draft requires authentication when requireAuth is enabled', async () => {
  await withBillingServer(async ({ base, server }) => {
    await seedCustomer(base);
    // Send request without bearer token — should be denied in requireAuth mode
    const { response } = await req(base, '/api/v1/billing/invoices/manual-draft', {
      method: 'POST',
      headers: writeHeaders('manual-no-auth-1'),
      body: JSON.stringify({
        actor: 'demo-user',
        customerId: 'cust-manual',
        lines: [{ description: 'X', quantity: 1, unitPriceMinor: 100 }],
        issueDate: '2026-09-13',
      }),
    });
    // In non-requireAuth mode, demo-user fallback succeeds; this test validates
    // that the route itself is wired. Auth denial is tested via requireAuth server below.
    assert.equal(response.status, 201, 'route works without bearer in demo mode');
  });

  // Now test actual auth denial with requireAuth: true
  await withBillingServer(async ({ base, server }) => {
    const bootToken = server.workspace.bootToken;
    assert.ok(bootToken, 'bootToken must exist in requireAuth mode');

    // Seed customer with valid token first
    await req(base, '/api/v1/billing/customers', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'seed-cust-auth',
        authorization: `Bearer ${bootToken}`,
      },
      body: JSON.stringify({
        actor: 'demo-user',
        id: 'cust-auth',
        name: 'Auth Test ApS',
        address: 'Testvej 2',
        countryCode: 'DK',
        billing: { currency: 'DKK', paymentTermsDays: 8 },
      }),
    });

    // Request without bearer should fail
    const { response } = await req(base, '/api/v1/billing/invoices/manual-draft', {
      method: 'POST',
      headers: writeHeaders('manual-no-auth-2'),
      body: JSON.stringify({
        actor: 'demo-user',
        customerId: 'cust-auth',
        lines: [{ description: 'X', quantity: 1, unitPriceMinor: 100 }],
        issueDate: '2026-09-13',
      }),
    });
    assert.equal(response.status, 401, `expected 401 without bearer in requireAuth mode, got ${response.status}`);
  }, { requireAuth: true, authSecret: 'test-secret-for-manual-draft' });
});

test('PATCH /api/v1/billing/invoices/:id requires authentication when requireAuth is enabled', async () => {
  await withBillingServer(async ({ base, server }) => {
    const bootToken = server.workspace.bootToken;
    assert.ok(bootToken);

    // Request without bearer should fail
    const { response } = await req(base, '/api/v1/billing/invoices/fake-id', {
      method: 'PATCH',
      headers: writeHeaders('patch-no-auth-1'),
      body: JSON.stringify({ actor: 'demo-user', lines: [] }),
    });
    assert.equal(response.status, 401, `expected 401 without bearer, got ${response.status}`);
  }, { requireAuth: true, authSecret: 'test-secret-for-patch-auth' });
});
