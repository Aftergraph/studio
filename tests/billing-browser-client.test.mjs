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

test('billing client exposes authenticated artifact download and guarded delivery', async () => {
  const calls = [];
  const client = createBillingClient({
    actor: 'operator-1',
    token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options });
      if (String(url).endsWith('/artifact?actor=operator-1')) return new Response('%PDF-1.4', { status: 200, headers: { 'content-type': 'application/pdf' } });
      return jsonResponse({ invoice: { id: 'invoice-1', status: 'emailed' }, billing: {} });
    },
  });

  const artifact = await client.downloadArtifact('invoice-1');
  assert.equal(artifact.contentType, 'application/pdf');
  assert.ok(artifact.blob instanceof Blob);
  await client.deliverInvoice('invoice-1');
  assert.equal(calls[0].options.headers.authorization, 'Bearer studio-token');
  assert.match(calls[0].url, /\/artifact\?actor=operator-1$/);
  assert.equal(calls[1].url, '/api/v1/billing/invoices/invoice-1/deliver');
  assert.equal(calls[1].options.method, 'POST');
});

test('billing client exposes tenant settings and document profile operations', async () => {
  const calls = [];
  const client = createBillingClient({
    actor: 'operator-1', token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes('/document')) return jsonResponse({ document: { schema: 'aftergraph.invoice.semantic.v1' } });
      if (url.includes('/peppol-bis3')) return new Response('<Invoice/>', { status: 200, headers: { 'content-type': 'application/xml' } });
      return jsonResponse({ billing: { settings: {} } });
    },
  });
  await client.updateSettings({ defaultServiceLabel: 'Service', invoiceSequence: { nextNumber: 2000 }, issuer: { name: 'Pilot' } });
  const document = await client.getDocument('invoice-1');
  const peppol = await client.downloadPeppol('invoice-1');
  assert.equal(document.document.schema, 'aftergraph.invoice.semantic.v1');
  assert.equal(peppol.contentType, 'application/xml');
  const settingsCall = calls.find((call) => call.url === '/api/v1/billing/settings');
  assert.ok(settingsCall);
  const settingsBody = JSON.parse(settingsCall.options.body);
  assert.equal(settingsBody.defaultServiceLabel, 'Service');
  assert.equal(settingsBody.invoiceSequence.nextNumber, 2000);
  assert.equal(settingsBody.issuer.name, 'Pilot');
  assert.equal(settingsBody.settings, undefined);
});
