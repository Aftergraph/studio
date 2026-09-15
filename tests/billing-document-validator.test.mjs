import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBillingDocumentValidator,
  billingDocumentValidatorFromEnv,
} from '../server/billing-document-validator.mjs';

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() { return body; },
  };
}

test('document validator adapter posts the versioned contract over HTTPS', async () => {
  const calls = [];
  const validate = createBillingDocumentValidator({
    url: 'https://validator.example.test/validate',
    token: 'validator-token',
    timeoutMs: 1200,
    fetchFn: async (url, options) => {
      calls.push({ url, options });
      return response({ ok: true, errors: [] });
    },
  });

  const result = await validate({
    profile: 'peppol-bis-3.0-2026-05',
    document: { id: 'invoice-1' },
    xml: '<Invoice/>',
  });

  assert.deepEqual(result, { ok: true, errors: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://validator.example.test/validate');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer validator-token');
  assert.equal(calls[0].options.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    version: 'aftergraph.billing.validator.v1',
    profile: 'peppol-bis-3.0-2026-05',
    document: { id: 'invoice-1' },
    xml: '<Invoice/>',
  });
});
test('document validator adapter rejects insecure or credential-bearing endpoints', () => {
  assert.throws(
    () => createBillingDocumentValidator({ url: 'http://validator.example.test/validate' }),
    error => error?.code === 'document_validator_https_required',
  );
  assert.throws(
    () => createBillingDocumentValidator({ url: 'https://user:pass@validator.example.test/validate' }),
    error => error?.code === 'document_validator_url_invalid',
  );
});

test('document validator adapter rejects malformed provider responses', async () => {
  const validate = createBillingDocumentValidator({
    url: 'https://validator.example.test/validate',
    fetchFn: async () => response({ result: 'yes' }),
  });

  await assert.rejects(
    () => validate({ profile: 'peppol-bis-3.0-2026-05', document: {}, xml: '<Invoice/>' }),
    error => error?.code === 'document_validator_invalid_receipt' && error.status === 503,
  );
});

test('document validator environment factory is inert until explicitly configured', () => {
  assert.equal(billingDocumentValidatorFromEnv({}), null);
  const validate = billingDocumentValidatorFromEnv({
    AFTERGRAPH_BILLING_DOCUMENT_VALIDATOR_URL: 'https://validator.example.test/validate',
    AFTERGRAPH_BILLING_DOCUMENT_VALIDATOR_TOKEN: 'token',
  }, { fetchFn: async () => response({ ok: true }) });
  assert.equal(typeof validate, 'function');
});
