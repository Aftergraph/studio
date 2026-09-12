import { API_VERSION, sendJson } from './http-utils.mjs';
import { renderInvoicePdf } from '../src/billing/artifact.mjs';
import {
  beginBillingDelivery,
  deliverBillingInvoice,
  failBillingDelivery,
} from '../src/billing/mutations.mjs';
import { evaluateBilling } from '../src/billing/readiness.mjs';

function projectBillingState(billing) {
  return {
    ...billing,
    projection: evaluateBilling({ ...billing, now: new Date().toISOString() }),
  };
}

function providerError(code = 'delivery_provider_failed', status = 502) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function deliveryAdapterError(code, status = 502) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

export function createWebhookBillingDeliveryAdapter({
  url,
  token = null,
  fetchFn = globalThis.fetch,
  timeoutMs = 8000,
} = {}) {
  if (!url) throw deliveryAdapterError('delivery_webhook_url_required', 500);
  let endpoint;
  try { endpoint = new URL(url); }
  catch { throw deliveryAdapterError('delivery_webhook_url_invalid', 500); }
  if (endpoint.protocol !== 'https:') throw deliveryAdapterError('delivery_webhook_https_required', 500);
  if (typeof fetchFn !== 'function') throw deliveryAdapterError('delivery_fetch_unavailable', 500);
  const timeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0 ? Number(timeoutMs) : 8000;

  return Object.freeze({
    name: 'webhook',
    async deliver({ invoice, artifact } = {}) {
      const recipientEmail = invoice?.customerSnapshot?.email;
      if (!recipientEmail) throw deliveryAdapterError('delivery_recipient_missing', 422);
      if (!artifact?.body || !artifact?.filename || !artifact?.contentType) {
        throw deliveryAdapterError('delivery_artifact_invalid', 500);
      }
      const payload = {
        version: 'aftergraph.billing.delivery.v1',
        event: 'invoice.delivery.requested',
        recipient: { name: invoice.customerSnapshot?.name || null, email: recipientEmail },
        invoice: {
          id: invoice.id, number: invoice.number, issueDate: invoice.issueDate,
          dueDate: invoice.dueDate, currency: invoice.currency,
          totalGrossMinor: invoice.totalGrossMinor,
        },
        artifact: {
          filename: artifact.filename,
          contentType: artifact.contentType,
          bodyBase64: Buffer.from(artifact.body).toString('base64'),
        },
      };
      const headers = { 'content-type': 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;
      let response;
      try {
        response = await fetchFn(endpoint.href, {
          method: 'POST', headers, body: JSON.stringify(payload),
          signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(timeout) : undefined,
        });
      } catch {
        throw deliveryAdapterError('delivery_provider_unavailable', 502);
      }
      if (!response?.ok) throw deliveryAdapterError('delivery_provider_http_error', 502);
      let receipt;
      try { receipt = await response.json(); }
      catch { throw deliveryAdapterError('delivery_provider_invalid_receipt', 502); }
      const deliveredAt = new Date(receipt?.deliveredAt || '');
      if (!receipt?.messageId || Number.isNaN(deliveredAt.getTime())) {
        throw deliveryAdapterError('delivery_provider_invalid_receipt', 502);
      }
      return { messageId: String(receipt.messageId), deliveredAt: deliveredAt.toISOString() };
    },
  });
}

export function billingDeliveryAdapterFromEnv(env = process.env, { fetchFn = globalThis.fetch } = {}) {
  const url = String(env.AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_URL || '').trim();
  if (!url) return null;
  return createWebhookBillingDeliveryAdapter({
    url,
    token: String(env.AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_TOKEN || '').trim() || null,
    timeoutMs: Number(env.AFTERGRAPH_BILLING_DELIVERY_TIMEOUT_MS || 8000),
    fetchFn,
  });
}

export async function handleBillingDelivery(options) {
  const { store, invoiceId, actor, adapter, actionKey, actionGuard, res } = options;
  let invoice;
  await store.mutate((draft) => {
    const result = beginBillingDelivery(draft.billing, {
      invoiceId,
      actor,
      provider: adapter.name,
      requestedAt: new Date().toISOString(),
    });
    draft.billing = result.billing;
    invoice = result.invoice;
    return draft;
  });
  if (invoice.status === 'emailed') {
    actionGuard.complete(actionKey, { status: 'accepted', invoiceId });
    sendJson(res, 200, { version: API_VERSION, invoice });
    return;
  }

  const snapshot = store.snapshot().billing;
  const customer = snapshot.customers.find((entry) => entry.id === invoice.customerId);
  const artifact = renderInvoicePdf({ billing: snapshot, invoiceId });
  try {
    const receipt = await adapter.deliver({ invoice, customer, artifact });
    const next = await store.mutate((draft) => {
      const result = deliverBillingInvoice(draft.billing, {
        invoiceId,
        actor,
        delivery: {
          provider: adapter.name,
          messageId: receipt?.messageId,
          deliveredAt: receipt?.deliveredAt,
        },
      });
      draft.billing = result.billing;
      invoice = result.invoice;
      return draft;
    });
    actionGuard.complete(actionKey, { status: 'accepted', invoiceId });
    sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    return;
  } catch (error) {
    await store.mutate((draft) => {
      const result = failBillingDelivery(draft.billing, {
        invoiceId,
        errorCode: error?.code || 'delivery_provider_failed',
        failedAt: new Date().toISOString(),
      });
      draft.billing = result.billing;
      invoice = result.invoice;
      return draft;
    });
    throw providerError(error?.code || 'delivery_provider_failed', Number.isInteger(error?.status) ? error.status : 502);
  }
}
