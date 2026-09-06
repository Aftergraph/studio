import { sendJson } from './http-utils.mjs';

// ponytail: search and cross-system context route handler
export function createSearchRouteHandler({ search, contextResolver = null }) {
  return function handleSearch(req, res, url) {
    if (url.pathname === '/api/v1/federation/context') {
      if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'method_not_allowed' });
        return true;
      }
      const focalId = url.searchParams.get('focalId');
      const tenantId = url.searchParams.get('tenantId') ?? null;
      if (!focalId) {
        sendJson(res, 400, { error: 'focalId_required' });
        return true;
      }
      if (!contextResolver?.resolveContext) {
        sendJson(res, 501, { error: 'context_resolver_not_configured' });
        return true;
      }
      contextResolver.resolveContext({ focalId, tenantId })
        .then(ctx => sendJson(res, 200, { context: ctx }))
        .catch(err => {
          const status = err.message.includes('tenant_isolation') ? 403 : err.message.includes('not_found') ? 404 : 500;
          sendJson(res, status, { error: err.message });
        });
      return true;
    }

    if (url.pathname !== '/api/v1/federation/search') return false;
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    const query = url.searchParams.get('q') ?? '';
    const tenantId = url.searchParams.get('tenantId') ?? null;
    sendJson(res, 200, { search: search(query, { tenantId }) });
    return true;
  };
}
