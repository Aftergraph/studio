import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { BILLING_SOURCE_SCHEMA } from '../src/billing/source-contract.mjs';

function codedError(code, status = 422) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function isLocalhost(url) {
  return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
}

export function sourcePushConfigFromEnv(env = process.env) {
  const baseUrl = String(env.AFTERGRAPH_BILLING_BASE_URL || '').trim();
  const actor = String(env.AFTERGRAPH_BILLING_SYNC_ACTOR || '').trim();
  const token = String(env.AFTERGRAPH_BILLING_SYNC_TOKEN || '').trim();
  if (!baseUrl || !actor || !token) throw codedError('billing_source_config_required');
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalhost(parsed))) {
    throw codedError('billing_source_https_required');
  }
  return { baseUrl: parsed.origin, actor, token };
}
export async function pushBillingSourceEnvelope(envelope, options = {}) {
  if (envelope?.schema !== BILLING_SOURCE_SCHEMA) throw codedError('unsupported_source_schema');
  const baseUrl = String(options.baseUrl || '').replace(/\/$/, '');
  const actor = String(options.actor || '').trim();
  const token = String(options.token || '').trim();
  const key = String(options.key || `${envelope.source?.id}:${envelope.source?.revision}`).trim();
  const fetchFn = options.fetchFn || globalThis.fetch;
  if (!baseUrl || !actor || !token || !key || typeof fetchFn !== 'function') {
    throw codedError('billing_source_config_required');
  }
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost(url))) {
    throw codedError('billing_source_https_required');
  }
  const response = await fetchFn(`${url.origin}/api/v1/billing/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'idempotency-key': key,
    },
    body: JSON.stringify({ actor, idempotencyKey: key, ...envelope }),
  });
  let body = null;
  try { body = await response.json(); } catch {}
  if (!response.ok) throw codedError(body?.error || 'billing_source_push_failed', response.status || 502);
  return body;
}
async function main() {
  const file = process.argv[2];
  if (!file) throw codedError('billing_source_file_required');
  const envelope = JSON.parse(await readFile(file, 'utf8'));
  const config = sourcePushConfigFromEnv();
  const result = await pushBillingSourceEnvelope(envelope, config);
  console.log(JSON.stringify({ sync: result.sync }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.code || error?.message || 'billing_source_push_failed');
    process.exitCode = 1;
  });
}