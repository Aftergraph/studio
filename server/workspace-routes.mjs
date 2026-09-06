// ponytail: thin route over the adaptive composer — same shape as
// intent-routes. Composition is read-only: typed descriptors, never markup,
// never authority.
import { sendJson } from './http-utils.mjs';
import { composeAdaptive } from '../src/workspace/adaptive-composer.mjs';

const PREFIX = '/api/v1/federation/workspace';

export function createWorkspaceRouteHandler({ kernel }) {
  if (!kernel) throw new TypeError('kernel required');
  return function handleWorkspace(req, res, url) {
    if (!url.pathname.startsWith(PREFIX)) return false;

    if (url.pathname === `${PREFIX}/compose` && req.method === 'GET') {
      try {
        const q = url.searchParams;
        const plan = composeAdaptive({
          registry: kernel._registries?.surfaces,
          objectType: q.get('objectType') ?? '',
          journeyStage: q.get('journeyStage') ?? 'resolved',
          context: q.getAll('context'),
          intent: q.get('intent') ?? 'inspect',
          granted: q.getAll('granted'),
          evidenceRef: q.get('evidenceRef'),
          device: q.get('device') ?? 'desktop',
        });
        sendJson(res, 200, { ok: true, plan });
      } catch (err) {
        sendJson(res, 400, { ok: false, error: err.message });
      }
      return true;
    }

    return false;
  };
}
