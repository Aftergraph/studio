import { sendJson, readJson } from './http-utils.mjs';
import { createSearchRouteHandler } from './search-routes.mjs';
import { createNowRouteHandler } from './now-routes.mjs';
import { createResearchRouteHandler } from './research-routes.mjs';
import { createIntentRouteHandler } from './intent-routes.mjs';
import { createWorkspaceRouteHandler } from './workspace-routes.mjs';

const PREFIX = '/api/v1/federation';

export function createFederationApiHandler({
  kernel,
  search = () => ({ query: '', complete: false, unavailable: [], results: [] }),
  now = () => ({ coverage: { complete: false, unavailable: [] } }),
  contextResolver = null
} = {}) {
  if (!kernel) throw new TypeError('kernel required');

  const searchHandler = createSearchRouteHandler({ search, contextResolver: contextResolver || kernel._registries?.contextResolver });
  const nowHandler = createNowRouteHandler({ now });
  const researchHandler = createResearchRouteHandler({ kernel });
  const intentHandler = createIntentRouteHandler({ kernel });
  const workspaceHandler = createWorkspaceRouteHandler({ kernel });

  return function handle(req, res, url) {
    if (!url.pathname.startsWith(PREFIX)) return false;
    if (searchHandler(req, res, url)) return true;
    if (nowHandler(req, res, url)) return true;
    if (researchHandler(req, res, url)) return true;
    if (intentHandler(req, res, url)) return true;
    if (workspaceHandler(req, res, url)) return true;

    if (url.pathname === `${PREFIX}/live/health` && req.method === 'GET') {
      const health = (kernel.integrations ? kernel.integrations() : []).map(i => kernel.liveHealth?.(i.manifest?.id) ?? { integrationId: i.manifest?.id, state: i.state });
      sendJson(res, 200, { health });
      return true;
    }
    if (url.pathname.startsWith(`${PREFIX}/live/resync/`) && req.method === 'POST') {
      const id = decodeURIComponent(url.pathname.slice(`${PREFIX}/live/resync/`.length));
      if (!id) {
        sendJson(res, 400, { error: 'integration_id_required' });
        return true;
      }
      Promise.resolve(kernel.resync ? kernel.resync(id) : { integrationId: id })
        .then(outcome => sendJson(res, 200, { ok: true, outcome }))
        .catch(err => sendJson(res, 500, { ok: false, error: err.message }));
      return true;
    }

    if (url.pathname === `${PREFIX}/capabilities/execute` && req.method === 'POST') {
      readJson(req).then(async body => {
        if (!body?.capabilityId || !body?.subject) {
          sendJson(res, 400, { error: 'capabilityId_and_subject_required' });
          return;
        }
        if (!kernel.executeCapability) {
          sendJson(res, 501, { error: 'capability_execution_not_configured' });
          return;
        }
        try {
          const outcome = await kernel.executeCapability(body);
          sendJson(res, 200, { ok: true, outcome });
        } catch (err) {
          const status = err.message.includes('not_granted') ? 403 : err.message.includes('approval_required') ? 401 : err.message.includes('not_found') ? 404 : 400;
          sendJson(res, status, { ok: false, error: err.message });
        }
      }).catch(() => sendJson(res, 400, { error: 'invalid_json_body' }));
      return true;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    if (url.pathname === `${PREFIX}/integrations`) {
      sendJson(res, 200, { integrations: kernel.integrations() });
      return true;
    }
    if (url.pathname === `${PREFIX}/objects`) {
      sendJson(res, 200, { objects: kernel.objects() });
      return true;
    }
    if (url.pathname.startsWith(`${PREFIX}/objects/`)) {
      const id = decodeURIComponent(url.pathname.slice(`${PREFIX}/objects/`.length));
      const object = kernel.object(id);
      if (!object) {
        sendJson(res, 404, { error: 'object_not_found' });
        return true;
      }
      sendJson(res, 200, { object });
      return true;
    }
    if (url.pathname === `${PREFIX}/capabilities`) {
      const q = url.searchParams.get('q') ?? '';
      sendJson(res, 200, { capabilities: kernel.discoverCapabilities(q) });
      return true;
    }
    sendJson(res, 404, { error: 'federation_api_not_found' });
    return true;
  };
}
