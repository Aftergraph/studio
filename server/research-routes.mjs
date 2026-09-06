import { sendJson } from './http-utils.mjs';

export function createResearchRouteHandler({ kernel }) {
  return function handleResearch(req, res, url) {
    if (!url.pathname.startsWith('/api/v1/federation/research')) return false;
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    const objects = kernel ? kernel.objects().filter(o => o.sourceIntegration === 'isr' || o.type === 'claim' || o.type === 'research_program') : [];
    sendJson(res, 200, { research: objects });
    return true;
  };
}
