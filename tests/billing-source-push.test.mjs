import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcePushConfigFromEnv, pushBillingSourceEnvelope } from '../scripts/billing_source_push.mjs';

test('source push config requires explicit actor, token and safe base URL', () => {
  assert.throws(() => sourcePushConfigFromEnv({}), /billing_source_config_required/);
  assert.throws(() => sourcePushConfigFromEnv({ AFTERGRAPH_BILLING_BASE_URL: 'http://billing.example.test', AFTERGRAPH_BILLING_SYNC_ACTOR: 'renos-worker', AFTERGRAPH_BILLING_SYNC_TOKEN: 'token' }), /billing_source_https_required/);
  const local = sourcePushConfigFromEnv({ AFTERGRAPH_BILLING_BASE_URL: 'http://127.0.0.1:8000', AFTERGRAPH_BILLING_SYNC_ACTOR: 'renos-worker', AFTERGRAPH_BILLING_SYNC_TOKEN: 'token' });
  assert.equal(local.actor, 'renos-worker');
});

test('producer push sends versioned envelope with auth and idempotency', async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ sync: { revision: 'r1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const envelope = { schema: 'aftergraph.billing.source.v1', source: { id: 'renos', revision: 'r1', syncedAt: '2026-09-11T20:00:00.000Z' }, customers: [], visits: [] };
  const result = await pushBillingSourceEnvelope(envelope, {
    baseUrl: 'https://billing.example.test', actor: 'renos-worker', token: 'secret-token', key: 'renos-r1', fetchFn,
  });
  assert.equal(result.sync.revision, 'r1');
  assert.equal(calls[0].url, 'https://billing.example.test/api/v1/billing/sync');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-token');
  assert.equal(calls[0].options.headers['idempotency-key'], 'renos-r1');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.actor, 'renos-worker');
  assert.equal(body.schema, 'aftergraph.billing.source.v1');
});
