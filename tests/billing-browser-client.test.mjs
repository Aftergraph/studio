import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillingClient } from '../src/billing/browser-client.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('billing client validates and binds the canonical Studio bearer session', async () => {
  const calls = [];
  const client = createBillingClient({
    token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options });
      if (url === '/api/v1/auth/me') return jsonResponse({ userId: 'operator-1' });
      if (url === '/api/v1/billing?actor=operator-1') return jsonResponse({ billing: { customers: [] } });
      throw new Error(`unexpected request: ${url}`);
    },
  });

  const me = await client.authMe();
  assert.equal(me.userId, 'operator-1');
  client.setSession({ actor: me.userId, token: 'studio-token' });
  await client.load();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers.authorization, 'Bearer studio-token');
  assert.equal(calls[1].options.headers.authorization, 'Bearer studio-token');
});

test('billing writes carry the bearer-bound actor and idempotency key', async () => {
  let call;
  const client = createBillingClient({
    actor: 'operator-1',
    token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      call = { url, options };
      return jsonResponse({ billing: {}, visit: { id: 'visit-1' } });
    },
  });

  await client.recordActuals({ visitId: 'visit-1', actual: { workMinutes: 60 } });
  const body = JSON.parse(call.options.body);
  assert.equal(body.actor, 'operator-1');
  assert.match(call.options.headers.authorization, /^Bearer /);
  assert.ok(call.options.headers['idempotency-key']);
});
