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
