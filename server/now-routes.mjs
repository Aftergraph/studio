import { sendJson } from './http-utils.mjs';

export function createNowRouteHandler({ now }) {
  return function handleNow(req, res, url) {
    if (url.pathname !== '/api/v1/federation/now') return false;
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' });
      return true;
    }
    sendJson(res, 200, { now: now() });
    return true;
  };
}
