import test from 'node:test';
import assert from 'node:assert/strict';
import { AGAuthPanel } from '../packages/ui/trust/auth-panel.mjs';
import { createApiClient } from '../src/api-client.mjs';

test('auth panel renders request state with labelled inputs', () => {
  const html = AGAuthPanel({ state: 'request' });
  assert.match(html, /data-ag-component="auth-panel"/);
  assert.match(html, /Signing in proves workspace ownership/);
  assert.match(html, /label[^>]*for="auth-user-id"/);
  assert.match(html, /data-auth-action="request"/);
});

test('auth panel renders token state with sign-in action', () => {
  const html = AGAuthPanel({ state: 'token', userId: 'alice', token: 'v1.abc.def' });
  assert.match(html, /data-auth-action="signin"/);
  assert.match(html, /alice/);
  assert.match(html, /aria-live="polite"/);
});

test('auth panel renders error without leaking the token', () => {
  const html = AGAuthPanel({ state: 'error', userId: 'alice', error: 'unknown user' });
  assert.match(html, /unknown user/);
  assert.doesNotMatch(html, /v1\./);
});

test('api client attaches bearer token after setAuthToken', async () => {
  const seen = [];
  const client = createApiClient({
    fetchImpl: async (url, options) => { seen.push(options?.headers); return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({}) }; },
  });
  await client.state();
  assert.ok(!seen[0]?.authorization, 'no token before sign-in');
  client.setAuthToken('v1.abc.def');
  await client.state();
  assert.equal(seen[1]?.authorization, 'Bearer v1.abc.def');
  client.setAuthToken(null);
  await client.state();
  assert.ok(!seen[2]?.authorization, 'sign-out clears the token');
});
