import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-reports-http-'));
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

const VALID_TYPES = ['revenue-by-customer', 'revenue-by-period', 'vat-overview', 'days-to-pay', 'outstanding-aging'];

test('GET /api/v1/billing/reports returns 422 when type is missing', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/billing/reports`);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'report_type_required');
  });
});

test('GET /api/v1/billing/reports returns 422 for unknown report type', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/billing/reports?type=bogus-type`);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'unknown_report_type');
  });
});

for (const type of VALID_TYPES) {
  test(`GET /api/v1/billing/reports returns 200 JSON for type=${type}`, async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/billing/reports?type=${encodeURIComponent(type)}`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.version, 'aftergraph.workspace.v5');
      assert.ok(body.report);
      assert.equal(body.report.type, type);
      assert.ok(body.report.generatedAt);
      assert.equal(body.report.currency, 'DKK');
    });
  });
}

test('GET /api/v1/billing/reports returns CSV when Accept includes text/csv', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/billing/reports?type=vat-overview`, {
      headers: { accept: 'text/csv' },
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/csv/i);
    assert.ok(res.headers.get('content-disposition')?.includes('vat-overview-report.csv'));
    const text = await res.text();
    // CSV content check (BOM optional depending on implementation)
    assert.ok(text.includes('Netto'), 'CSV has Netto header');
  });
});

test('POST /api/v1/billing/reports returns 200 JSON with body params', async () => {
  await withServer(async (base) => {
    const key = `reports-post-${Date.now()}-${Math.random()}`;
    const res = await fetch(`${base}/api/v1/billing/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify({ actor: 'demo-user', idempotencyKey: key, type: 'revenue-by-customer', granularity: 'month' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.report.type, 'revenue-by-customer');
  });
});

test('POST /api/v1/billing/reports returns 422 when type is missing', async () => {
  await withServer(async (base) => {
    const key = `reports-notype-${Date.now()}-${Math.random()}`;
    const res = await fetch(`${base}/api/v1/billing/reports`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': key },
      body: JSON.stringify({ actor: 'demo-user', idempotencyKey: key }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'report_type_required');
  });
});

test('reports do not mix currencies — currency field is DKK', async () => {
  await withServer(async (base) => {
    for (const type of VALID_TYPES) {
      const res = await fetch(`${base}/api/v1/billing/reports?type=${encodeURIComponent(type)}`);
      const body = await res.json();
      assert.equal(body.report.currency, 'DKK', `${type} should report DKK currency`);
    }
  });
});

test('revenue-by-customer report has rows array and correct structure', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/billing/reports?type=revenue-by-customer`);
    const body = await res.json();
    assert.ok(Array.isArray(body.report.rows));
    if (body.report.rows.length > 0) {
      const row = body.report.rows[0];
      assert.ok('customerId' in row);
      assert.ok('totalPaidMinor' in row);
      assert.ok('invoiceCount' in row);
    }
  });
});

test('outstanding-aging report has totalOutstandingMinor and bucket rows', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/v1/billing/reports?type=outstanding-aging`);
    const body = await res.json();
    assert.ok(typeof body.report.totalOutstandingMinor === 'number');
    assert.ok(Array.isArray(body.report.rows));
    const buckets = body.report.rows.map((r) => r.bucket);
    assert.ok(buckets.includes('current'));
    assert.ok(buckets.includes('1-30'));
  });
});
