function normalizeError(response, body) {
  const error = new Error(body?.error || `billing request failed (${response.status})`);
  error.code = body?.error || 'billing_request_failed';
  error.status = response.status;
  return error;
}

function requestKey(prefix = 'billing') {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function createBillingClient({
  actor = 'demo-user',
  token = null,
  fetchFn = globalThis.fetch?.bind(globalThis),
} = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetch implementation required');

  const headers = (extra = {}) => ({
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  });

  const read = async (path) => {
    const response = await fetchFn(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    const body = await response.json();
    if (!response.ok) throw normalizeError(response, body);
    return body;
  };

  const write = async (path, payload, prefix) => {
    const key = requestKey(prefix);
    const response = await fetchFn(path, {
      method: 'POST',
      headers: headers({ 'idempotency-key': key }),
      body: JSON.stringify({ actor, idempotencyKey: key, ...payload }),
    });
    const body = await response.json();
    if (!response.ok) throw normalizeError(response, body);
    return body;
  };

  return Object.freeze({
    load() {
      const suffix = actor ? `?actor=${encodeURIComponent(actor)}` : '';
      return read(`/api/v1/billing${suffix}`);
    },
    recordActuals({ visitId, actual }) {
      return write('/api/v1/billing/actuals', { visitId, actual }, 'billing-actuals');
    },
    createDraft({ customerId, visitIds, number, issueDate }) {
      return write('/api/v1/billing/invoices/draft', {
        customerId,
        visitIds,
        number,
        issueDate,
      }, 'billing-draft');
    },
    issueInvoice(invoiceId) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/issue`, {}, 'billing-issue');
    },
  });
}
