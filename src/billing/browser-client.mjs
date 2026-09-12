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
  actor = null,
  token = null,
  fetchFn = globalThis.fetch?.bind(globalThis),
} = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetch implementation required');

  let currentActor = actor || null;
  let currentToken = token || null;

  const authHeaders = () => (currentToken ? { authorization: `Bearer ${currentToken}` } : {});
  const headers = (extra = {}) => ({
    'content-type': 'application/json',
    ...authHeaders(),
    ...extra,
  });

  const read = async (path) => {
    const response = await fetchFn(path, { headers: authHeaders() });
    const body = await response.json();
    if (!response.ok) throw normalizeError(response, body);
    return body;
  };

  const readBlob = async (path) => {
    const response = await fetchFn(path, { headers: authHeaders() });
    if (!response.ok) {
      let body = null;
      try { body = await response.json(); } catch {}
      throw normalizeError(response, body);
    }
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename=\"?([^\";]+)\"?/i)?.[1] || 'invoice.pdf';
    return { blob: await response.blob(), contentType: response.headers.get('content-type') || 'application/octet-stream', filename };
  };

  const write = async (path, payload, prefix) => {
    if (!currentActor) {
      const error = new Error('billing session actor required');
      error.code = 'authentication_required';
      throw error;
    }
    const key = requestKey(prefix);
    const response = await fetchFn(path, {
      method: 'POST',
      headers: headers({ 'idempotency-key': key }),
      body: JSON.stringify({ actor: currentActor, idempotencyKey: key, ...payload }),
    });
    const body = await response.json();
    if (!response.ok) throw normalizeError(response, body);
    return body;
  };

  return Object.freeze({
    setSession({ actor: nextActor = currentActor, token: nextToken = currentToken } = {}) {
      currentActor = nextActor || null;
      currentToken = nextToken || null;
      return Object.freeze({ actor: currentActor, authenticated: Boolean(currentToken) });
    },
    authMe() {
      return read('/api/v1/auth/me');
    },
    load() {
      const suffix = currentActor ? `?actor=${encodeURIComponent(currentActor)}` : '';
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
    downloadArtifact(invoiceId) {
      const suffix = currentActor ? `?actor=${encodeURIComponent(currentActor)}` : '';
      return readBlob(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/artifact${suffix}`);
    },
    deliverInvoice(invoiceId) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/deliver`, {}, 'billing-deliver');
    },
    updateSettings(settings) {
      return write('/api/v1/billing/settings', settings, 'billing-settings');
    },
    getDocument(invoiceId) {
      const suffix = currentActor ? `?actor=${encodeURIComponent(currentActor)}` : '';
      return read(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/document${suffix}`);
    },
    downloadPeppol(invoiceId) {
      const suffix = currentActor ? `?actor=${encodeURIComponent(currentActor)}` : '';
      return readBlob(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/peppol-bis3${suffix}`);
    },
  });
}
