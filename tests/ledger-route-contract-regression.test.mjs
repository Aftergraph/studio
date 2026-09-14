/**
 * Ledger route contract regression tests.
 * Covers behavioral contracts broken or at risk during trie-router extraction.
 * SHA under review: b9221a71037051ecb81707153c01d7cbb73dcad9
 * Base: 2041d11c
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ledger-contract-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20, fixtures: true, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, server); }
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

// ── REG-001: queryBilling customer projection must include legacy fields ──
test('REG-001: GET /api/v1/billing/query?type=customer returns full customer fields', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing/query?type=customer`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.items), 'items must be array');
    if (body.items.length === 0) return;
    const c = body.items[0];
    assert.ok('id' in c, 'customer item must have id');
    assert.ok('name' in c, 'customer item must have name');
    assert.ok('email' in c, 'customer item must have email');
    // These fields were present pre-extraction and clients depend on them:
    assert.ok('address' in c, 'REG-001 FAIL: customer item missing address field');
    assert.ok('status' in c, 'REG-001 FAIL: customer item missing status field');
    assert.ok('invoiceCount' in c, 'REG-001 FAIL: customer item missing invoiceCount field');
    assert.ok('totalBilledMinor' in c, 'REG-001 FAIL: customer item missing totalBilledMinor field');
    assert.ok('createdAt' in c, 'REG-001 FAIL: customer item missing createdAt field');
  });
});

// ── REG-003: queryBilling response must include hasMore ──
test('REG-003: GET /api/v1/billing/query includes hasMore pagination field', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing/query?type=invoice&limit=1`);
    assert.equal(response.status, 200);
    assert.ok('hasMore' in body, 'REG-003 FAIL: query response missing hasMore field');
    assert.equal(typeof body.hasMore, 'boolean', 'hasMore must be boolean');
  });
});

// ── REG-004: TrieRouter static vs param priority (unit-level verification) ──
test('REG-004: TrieRouter prefers static segments over params for recurring/tick', async () => {
  const { TrieRouter } = await import('../server/trie-router.mjs');
  const r = new TrieRouter();
  let tickCalled = false;
  let paramCalled = false;
  r.add('POST', '/api/v1/billing/recurring/tick', () => { tickCalled = true; });
  r.add('PATCH', '/api/v1/billing/recurring/:recurringId', () => { paramCalled = true; });
  const match = r.find('POST', '/api/v1/billing/recurring/tick');
  assert.ok(match, 'tick route must match');
  match.handler();
  assert.ok(tickCalled, 'static tick handler must be called');
  assert.ok(!paramCalled, 'param handler must NOT be called for static path');
});

// ── REG-004b: invoices/draft routes correctly via trie ──
test('REG-004b: POST /api/v1/billing/invoices/draft resolves to draft handler', async () => {
  const { TrieRouter } = await import('../server/trie-router.mjs');
  const r = new TrieRouter();
  let draftCalled = false;
  let paramCalled = false;
  r.add('POST', '/api/v1/billing/invoices/draft', () => { draftCalled = true; });
  r.add('PATCH', '/api/v1/billing/invoices/:invoiceId', () => { paramCalled = true; });
  const match = r.find('POST', '/api/v1/billing/invoices/draft');
  assert.ok(match, 'draft route must match');
  match.handler();
  assert.ok(draftCalled, 'static draft handler must be called');
  assert.ok(!paramCalled, 'param handler must NOT shadow draft');
});

// ── Auth gate: approve endpoint is routed and enforces billing.approve ──
test('CONTRACT: POST /invoices/:id/approve is routed and checks capability', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing/invoices/nonexistent/approve`, post({}, 'contract-approve-routed'));
    // demo-user has billing.approve, so we expect invoice_not_found (404 from mutation)
    // NOT api_not_found (404 from router miss). The error code distinguishes them.
    assert.equal(body.error, 'invoice_not_found',
      `approve must be routed; expected invoice_not_found but got ${body.error} (status ${response.status})`);
  });
});

// ── Idempotency: action guard rejects duplicate keys with 409 ──
test('CONTRACT: POST /api/v1/billing/actuals rejects duplicate idempotency-key with 409', async () => {
  await withServer(async (base) => {
    const payload = {
      visitId: 'peder-2026-09-02',
      actual: {
        startedAt: '2026-09-02T08:30:00+02:00',
        endedAt: '2026-09-02T09:30:00+02:00',
        workers: 2,
        workMinutes: 120,
      },
    };
    const key = 'contract-idempotency-reject-' + Date.now();
    const first = await json(`${base}/api/v1/billing/actuals`, post(payload, key));
    assert.equal(first.response.status, 200, 'first call must succeed');
    const second = await json(`${base}/api/v1/billing/actuals`, post(payload, key));
    assert.equal(second.response.status, 409,
      `duplicate idempotency-key must return 409, got ${second.response.status}`);
    assert.equal(second.body.error, 'idempotency_conflict');
  });
});

// ── Error shape contract ──
test('CONTRACT: billing API errors return {error: string} shape', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/v1/billing/customers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'No Actor' }),
    });
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.ok(typeof body.error === 'string', 'error must be a string code');
    assert.equal(body.error, 'actor_required');
  });
});

// ── Settings route preserved ──
test('CONTRACT: POST /api/v1/billing/settings rejects incomplete issuer with 422', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing/settings`, post({
      issuer: { name: 'Test Issuer' },
    }, 'contract-settings-incomplete'));
    // Settings validation requires complete issuer profile
    assert.equal(response.status, 422);
    assert.equal(body.error, 'issuer_profile_incomplete');
  });
});

// ── Recurring list endpoint preserved ──
test('CONTRACT: GET /api/v1/billing/recurring returns recurringInvoices array', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing/recurring`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.recurringInvoices), 'must return recurringInvoices array');
  });
});

// ── Products list endpoint preserved ──
test('CONTRACT: GET /api/v1/billing/products returns products array', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing/products`);
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(body.products), 'must return products array');
  });
});
