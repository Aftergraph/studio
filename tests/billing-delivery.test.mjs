import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { createBillingDraft, issueBillingInvoice, deliverBillingInvoice, beginBillingDelivery, failBillingDelivery } from '../src/billing/mutations.mjs';

function issuedState() {
  let billing = billingFixtureState();
  let result = createBillingDraft(billing, {
    customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'],
    number: '1370', issueDate: '2026-09-11', actor: 'operator-1',
  });
  result = issueBillingInvoice(result.billing, { invoiceId: result.invoice.id, actor: 'operator-1' });
  return result.billing;
}

test('delivery fails closed when no provider result is supplied', () => {
  const billing = issuedState();
  assert.throws(() => deliverBillingInvoice(billing, { invoiceId: 'invoice-1370', actor: 'operator-1' }), /delivery_confirmation_required/);
});

test('confirmed provider delivery marks an issued invoice emailed with immutable receipt metadata', () => {
  const billing = issuedState();
  const result = deliverBillingInvoice(billing, {
    invoiceId: 'invoice-1370', actor: 'operator-1',
    delivery: { provider: 'test-mail', messageId: 'msg-001', deliveredAt: '2026-09-11T15:00:00.000Z' },
  });
  assert.equal(result.invoice.status, 'emailed');
  assert.deepEqual(result.invoice.delivery, {
    provider: 'test-mail', messageId: 'msg-001', deliveredAt: '2026-09-11T15:00:00.000Z', deliveredBy: 'operator-1',
  });

  const replay = deliverBillingInvoice(result.billing, {
    invoiceId: 'invoice-1370', actor: 'operator-2',
    delivery: { provider: 'test-mail', messageId: 'msg-999', deliveredAt: '2026-09-11T16:00:00.000Z' },
  });
  assert.deepEqual(replay.invoice.delivery, result.invoice.delivery);
});


test('delivery attempt is persisted as pending before a provider side effect', () => {
  const billing = issuedState();
  const result = beginBillingDelivery(billing, {
    invoiceId: 'invoice-1370', actor: 'operator-1', provider: 'test-mail', requestedAt: '2026-09-11T14:59:00.000Z',
  });
  assert.equal(result.invoice.status, 'issued');
  assert.deepEqual(result.invoice.delivery, {
    state: 'pending', provider: 'test-mail', requestedAt: '2026-09-11T14:59:00.000Z', requestedBy: 'operator-1',
  });
});

test('provider failure leaves invoice issued and records a retryable safe failure', () => {
  const billing = beginBillingDelivery(issuedState(), {
    invoiceId: 'invoice-1370', actor: 'operator-1', provider: 'test-mail', requestedAt: '2026-09-11T14:59:00.000Z',
  }).billing;
  const result = failBillingDelivery(billing, {
    invoiceId: 'invoice-1370', errorCode: 'provider_unavailable', failedAt: '2026-09-11T15:00:00.000Z',
  });
  assert.equal(result.invoice.status, 'issued');
  assert.deepEqual(result.invoice.delivery, {
    state: 'failed', provider: 'test-mail', requestedAt: '2026-09-11T14:59:00.000Z', requestedBy: 'operator-1',
    errorCode: 'provider_unavailable', failedAt: '2026-09-11T15:00:00.000Z',
  });
});
