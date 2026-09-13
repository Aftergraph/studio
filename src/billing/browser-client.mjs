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

  const withTimeout = (signal) => {
    if (typeof AbortController === 'undefined') return signal;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const combined = controller.signal;
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    // Note: caller must clear timeout on completion; simplified here by relying on abort
    return combined;
  };

  const read = async (path) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 30000) : null;
    try {
      const response = await fetchFn(path, { headers: authHeaders(), signal: controller?.signal });
      const body = await response.json();
      if (!response.ok) throw normalizeError(response, body);
      return body;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('billing request timeout');
        timeoutErr.code = 'billing_request_timeout';
        throw timeoutErr;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const readBlob = async (path) => {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 30000) : null;
    try {
      const response = await fetchFn(path, { headers: authHeaders(), signal: controller?.signal });
      if (!response.ok) {
        let body = null;
        try { body = await response.json(); } catch {}
        throw normalizeError(response, body);
      }
      const disposition = response.headers.get('content-disposition') || '';
      const filename = disposition.match(/filename=\"?([^\";]+)\"?/i)?.[1] || 'invoice.pdf';
      return { blob: await response.blob(), contentType: response.headers.get('content-type') || 'application/octet-stream', filename };
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('billing request timeout');
        timeoutErr.code = 'billing_request_timeout';
        throw timeoutErr;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const write = async (path, payload, prefix, method = 'POST') => {
    if (!currentActor) {
      const error = new Error('billing session actor required');
      error.code = 'authentication_required';
      throw error;
    }
    const key = requestKey(prefix);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 30000) : null;
    try {
      const response = await fetchFn(path, {
        method,
        headers: headers({ 'idempotency-key': key }),
        body: JSON.stringify({ actor: currentActor, idempotencyKey: key, ...payload }),
        signal: controller?.signal,
      });
      const body = await response.json();
      if (!response.ok) throw normalizeError(response, body);
      return body;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error('billing request timeout');
        timeoutErr.code = 'billing_request_timeout';
        throw timeoutErr;
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
    }
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
    correctActuals({ visitId, actual, reason, correctedAt }) {
      return write('/api/v1/billing/actuals/correct', { visitId, actual, reason, correctedAt }, 'billing-actuals-correction');
    },
    createDraft({ customerId, visitIds, number, issueDate }) {
      return write('/api/v1/billing/invoices/draft', {
        customerId,
        visitIds,
        number,
        issueDate,
      }, 'billing-draft');
    },
    createManualDraft({ customerId, lines, number, issueDate }) {
      return write('/api/v1/billing/invoices/manual-draft', {
        customerId,
        lines,
        number,
        issueDate,
      }, 'billing-manual-draft');
    },
    updateDraft(invoiceId, { lines, issueDate }) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}`, {
        lines,
        issueDate,
      }, 'billing-draft-update', 'PATCH');
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
    previewInvoiceEmail(invoiceId) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/email-preview`, {}, 'billing-email-preview');
    },
    sendInvoiceEmail(invoiceId) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/send-email`, {}, 'billing-send-email');
    },
    createCustomer({ id, name, address, email, countryCode, registrationId, registrationScheme, billing }) {
      return write('/api/v1/billing/customers', {
        id,
        name,
        address,
        email,
        countryCode,
        registrationId,
        registrationScheme,
        billing,
      }, 'billing-customer');
    },
    updateCustomer(customerId, updates) {
      return write(`/api/v1/billing/customers/${encodeURIComponent(customerId)}`, updates, 'billing-customer-update', 'PATCH');
    },
    voidInvoice(invoiceId, reason) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/void`, { reason }, 'billing-void');
    },
    recordPayment(invoiceId, { amountMinor, method, reference, paidAt }) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/payment`, {
        amountMinor,
        method,
        reference,
        paidAt,
      }, 'billing-payment');
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
    logAudit(payload) {
      return write('/api/v1/billing/audit', payload, 'billing-audit');
    },
    remindInvoice(invoiceId) {
      return write(`/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/remind`, {}, 'billing-remind');
    },
    listProducts() {
      const suffix = currentActor ? `?actor=${encodeURIComponent(currentActor)}` : '';
      return read(`/api/v1/billing/products${suffix}`);
    },
    createProduct({ id, name, description, unitPriceMinor, vatRateBps, category, sku, active }) {
      return write('/api/v1/billing/products', {
        id, name, description, unitPriceMinor, vatRateBps, category, sku, active,
      }, 'billing-product');
    },
    updateProduct(productId, updates) {
      return write(`/api/v1/billing/products/${encodeURIComponent(productId)}`, updates, 'billing-product-update', 'PATCH');
    },
    listRecurring() {
      const suffix = currentActor ? `?actor=${encodeURIComponent(currentActor)}` : '';
      return read(`/api/v1/billing/recurring${suffix}`);
    },
    createRecurring({ customerId, productLines, schedule }) {
      return write('/api/v1/billing/recurring', { customerId, productLines, schedule }, 'billing-recurring');
    },
    updateRecurring(recurringId, updates) {
      return write(`/api/v1/billing/recurring/${encodeURIComponent(recurringId)}`, updates, 'billing-recurring-update', 'PATCH');
    },
    deleteRecurring(recurringId) {
      return write(`/api/v1/billing/recurring/${encodeURIComponent(recurringId)}`, {}, 'billing-recurring-delete', 'DELETE');
    },
    tickRecurring(now) {
      return write('/api/v1/billing/recurring/tick', { now }, 'billing-recurring-tick');
    },
    queryBilling(params = {}) {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '') qs.set(key, String(value));
      }
      const suffix = currentActor ? `&actor=${encodeURIComponent(currentActor)}` : '';
      return read(`/api/v1/billing/query?${qs.toString()}${suffix}`);
    },
  });
}
