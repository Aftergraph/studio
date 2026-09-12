import { readJson, sendJson } from './http-utils.mjs';

function integerParam(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function storeErrorStatus(code) {
  if (code === 'version_conflict' || code === 'idempotency_conflict') return 409;
  if (code === 'invalid_argument' || code === 'invalid_document') return 422;
  return 503;
}

async function tenantBinding(provider, req) {
  if (typeof provider !== 'function') return null;
  const binding = await provider(req);
  if (!binding || typeof binding.tenantId !== 'string' || binding.tenantId.trim() === '') return null;
  return binding;
}
export function createExperienceRouteHandler({ experienceStore = null, tenantBindingProvider = null } = {}) {
  const matches = pathname => pathname === '/api/v1/experience' || pathname === '/api/v1/experience/events';

  return async function handleExperienceRoute(req, res, url) {
    if (!matches(url.pathname)) return false;
    if (!experienceStore || typeof tenantBindingProvider !== 'function') {
      sendJson(res, 503, { error:'experience_unavailable' });
      return true;
    }
    const binding = await tenantBinding(tenantBindingProvider, req);
    if (!binding) {
      sendJson(res, 503, { error:'tenant_binding_unavailable' });
      return true;
    }
    const tenantId = binding.tenantId;

    try {
      if (url.pathname === '/api/v1/experience' && req.method === 'GET') {
        sendJson(res, 200, await experienceStore.read(tenantId));
        return true;
      }
      if (url.pathname === '/api/v1/experience' && req.method === 'PUT') {
        const body = await readJson(req);
        const key = req.headers['idempotency-key'] || body.idempotencyKey;
        if (!key) {
          sendJson(res, 422, { error:'idempotency_key_required' });
          return true;
        }
        const result = await experienceStore.write({
          tenantId,
          document:body.document,
          expectedVersion:body.expectedVersion,
          idempotencyKey:String(key),
        });
        sendJson(res, 200, result);
        return true;
      }

      if (url.pathname === '/api/v1/experience/events' && req.method === 'GET') {
        const after = integerParam(url.searchParams.get('after'), 0);
        const limit = integerParam(url.searchParams.get('limit'), 100);
        if (!Number.isInteger(after) || !Number.isInteger(limit)) {
          sendJson(res, 422, { error:'invalid_event_cursor' });
          return true;
        }
        sendJson(res, 200, await experienceStore.readEvents(tenantId,{after,limit}));
        return true;
      }
    } catch (error) {
      sendJson(res, storeErrorStatus(error?.code), {
        error:error?.code || 'experience_store_error',
        ...(error?.currentVersion !== undefined ? { currentVersion:error.currentVersion } : {}),
      });
      return true;
    }

    sendJson(res, 405, { error:'method_not_allowed' });
    return true;
  };
}
