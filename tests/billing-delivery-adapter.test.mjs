import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWebhookBillingDeliveryAdapter,
  billingDeliveryAdapterFromEnv,
} from '../server/billing-delivery.mjs';

const invoice = {
  id: 'invoice-1400', number: '1400', issueDate: '2026-09-11',
  dueDate: '2026-09-25', currency: 'DKK', totalGrossMinor: 123400,
  customerSnapshot: { name: 'Pilot Customer', email: 'customer@test.invalid' },
};
const artifact = {
  filename: 'invoice-1400.pdf', contentType: 'application/pdf',
  body: Buffer.from('%PDF-test'),
};

test('webhook delivery posts immutable invoice recipient and PDF attachment', async () => {
  const calls = [];
  const adapter = createWebhookBillingDeliveryAdapter({
    url: 'https://delivery.test.invalid/invoices', token: 'secret-token',
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ messageId: 'msg-1400', deliveredAt: '2026-09-11T19:00:00.000Z' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    },
  });
  const receipt = await adapter.deliver({ invoice, artifact });
  assert.deepEqual(receipt, { messageId: 'msg-1400', deliveredAt: '2026-09-11T19:00:00.000Z' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://delivery.test.invalid/invoices');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-token');
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.recipient.email, 'customer@test.invalid');
  assert.equal(body.invoice.number, '1400');
  assert.equal(body.artifact.filename, 'invoice-1400.pdf');
  assert.equal(Buffer.from(body.artifact.bodyBase64, 'base64').toString(), '%PDF-test');
  assert.equal(JSON.stringify(body).includes('secret-token'), false);
});

test('delivery adapter fails closed on insecure URL and invalid provider receipt', async () => {
  assert.throws(() => createWebhookBillingDeliveryAdapter({ url: 'http://provider.invalid/send' }), /delivery_webhook_https_required/);
  const adapter = createWebhookBillingDeliveryAdapter({
    url: 'https://delivery.test.invalid/invoices',
    fetchFn: async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  await assert.rejects(
    adapter.deliver({ invoice, artifact }),
    (error) => error?.code === 'delivery_provider_invalid_receipt',
  );
});

test('runtime env creates webhook adapter only when explicitly configured', () => {
  assert.equal(billingDeliveryAdapterFromEnv({}), null);
  const adapter = billingDeliveryAdapterFromEnv({
    AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_URL: 'https://delivery.test.invalid/invoices',
    AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_TOKEN: 'runtime-token',
  }, { fetchFn: async () => new Response('{}') });
  assert.equal(adapter.name, 'webhook');
});
