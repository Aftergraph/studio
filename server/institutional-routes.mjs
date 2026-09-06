// ponytail: thin HTTP projection over the institutional graph.
// Mutations require a human actor; reads never create authority.
import { sendJson, readJson } from './http-utils.mjs';
import { InstitutionalGraph } from '../src/institution/institutional-graph.mjs';

const PREFIX = '/api/v1/federation/institutional';

export function createInstitutionalRouteHandler({ kernel }) {
  if (!kernel) throw new TypeError('kernel required');
  const graph = new InstitutionalGraph({ id: 'institutional-runtime' });
  const human = actor => String(actor || '').startsWith('human:');
  const body = (req, res, fn) => readJson(req).then(payload => {
    try { fn(payload); } catch (error) { sendJson(res, 400, { ok: false, error: error.message }); }
  }).catch(() => sendJson(res, 400, { ok: false, error: 'invalid_json_body' }));

  return function handleInstitutional(req, res, url) {
    if (!url.pathname.startsWith(PREFIX)) return false;
    if (url.pathname === `${PREFIX}/organization` && req.method === 'POST') {
      body(req, res, payload => {
        if (!human(payload.approvedBy)) throw new Error('organization creation requires human approval');
        const organization = graph.registerOrganization(payload);
        sendJson(res, 200, { ok: true, organization, authority: 'none' });
      });
      return true;
    }
    if (url.pathname === `${PREFIX}/membership` && req.method === 'POST') {
      body(req, res, payload => {
        if (!human(payload.approvedBy)) throw new Error('membership change requires human approval');
        const membership = graph.addMembership(payload);
        sendJson(res, 200, { ok: true, membership, authority: 'none' });
      });
      return true;
    }
    if (url.pathname === `${PREFIX}/policy` && req.method === 'POST') {
      body(req, res, payload => {
        const policy = graph.registerPolicy(payload);
        sendJson(res, 200, { ok: true, policy, authority: 'none' });
      });
      return true;
    }
    if (url.pathname === `${PREFIX}/projection` && req.method === 'GET') {
      try { sendJson(res, 200, { ok: true, projection: graph.project(url.searchParams.get('organizationId')), authority: 'none' }); }
      catch (error) { sendJson(res, 404, { ok: false, error: error.message }); }
      return true;
    }
    if (url.pathname === `${PREFIX}/authorize` && req.method === 'GET') {
      sendJson(res, 200, { ok: true, allowed: graph.authorize({ organizationId: url.searchParams.get('organizationId'), subjectId: url.searchParams.get('subjectId'), operation: url.searchParams.get('operation') }), authority: 'none' });
      return true;
    }
    return false;
  };
}
