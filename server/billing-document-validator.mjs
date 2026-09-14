function validatorError(code, status = 503) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function validatorEndpoint(url) {
  let endpoint;
  try {
    endpoint = new URL(String(url || '').trim());
  } catch {
    throw validatorError('document_validator_url_invalid', 500);
  }
  if (endpoint.protocol !== 'https:') {
    throw validatorError('document_validator_https_required', 500);
  }
  if (endpoint.username || endpoint.password || endpoint.hash) {
    throw validatorError('document_validator_url_invalid', 500);
  }
  return endpoint;
}

function timeoutValue(value) {
  const timeout = Number(value);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 8000;
}

function normalizedErrors(errors) {
  if (!Array.isArray(errors)) return [];
  return errors
    .filter(error => typeof error === 'string' && error.trim())
    .map(error => error.trim().slice(0, 500))
    .slice(0, 50);
}

export function createBillingDocumentValidator({
  url,
  token = null,
  fetchFn = globalThis.fetch,
  timeoutMs = 8000,
} = {}) {
  const endpoint = validatorEndpoint(url);
  if (typeof fetchFn !== 'function') {
    throw validatorError('document_validator_fetch_unavailable', 500);
  }
  const bearer = typeof token === 'string' && token.trim() ? token.trim() : null;
  const timeout = timeoutValue(timeoutMs);

  return async function validateBillingDocument({ profile, document, xml } = {}) {
    const payload = {
      version: 'aftergraph.billing.validator.v1',
      profile,
      document,
      xml,
    };
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
    };
    if (bearer) headers.authorization = `Bearer ${bearer}`;

    let response;
    try {
      response = await fetchFn(endpoint.href, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: typeof AbortSignal?.timeout === 'function'
          ? AbortSignal.timeout(timeout)
          : undefined,
      });
    } catch {
      throw validatorError('document_validator_unavailable', 503);
    }
    if (!response?.ok) {
      throw validatorError('document_validator_unavailable', 503);
    }

    let body;
    try {
      body = await response.json();
    } catch {
      throw validatorError('document_validator_invalid_receipt', 503);
    }
    if (typeof body?.ok !== 'boolean') {
      throw validatorError('document_validator_invalid_receipt', 503);
    }

    return {
      ok: body.ok,
      errors: normalizedErrors(body.errors),
    };
  };
}

export function billingDocumentValidatorFromEnv(
  env = process.env,
  { fetchFn = globalThis.fetch } = {},
) {
  const url = String(env.AFTERGRAPH_BILLING_DOCUMENT_VALIDATOR_URL || '').trim();
  if (!url) return null;
  return createBillingDocumentValidator({
    url,
    token: String(env.AFTERGRAPH_BILLING_DOCUMENT_VALIDATOR_TOKEN || '').trim() || null,
    timeoutMs: Number(env.AFTERGRAPH_BILLING_DOCUMENT_VALIDATOR_TIMEOUT_MS || 8000),
    fetchFn,
  });
}
