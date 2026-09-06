// ponytail: thin in-memory society store behind one GET + four POSTs.
// Same shape as intent-routes: no persistence, no authority — teams live in
// the handler closure, grants stay in the registry.
import { sendJson, readJson } from './http-utils.mjs';
import { AgentTeam, HANDOFF_KINDS } from '../src/society/agent-society.mjs';

const PREFIX = '/api/v1/federation/society';

export function createSocietyRouteHandler({ kernel }) {
  if (!kernel) throw new TypeError('kernel required');
  const teams = new Map();

  const withBody = (req, res, fn) => {
    readJson(req).then((body = {}) => {
      try {
        fn(body);
      } catch (e) {
        sendJson(res, 400, { ok: false, error: e.message });
      }
    }).catch(() => sendJson(res, 400, { ok: false, error: 'invalid_json_body' }));
  };

  const teamOf = (body) => {
    const t = teams.get(body.teamId);
    if (!t) throw new Error(`unknown team ${body.teamId}`);
    return t;
  };

  return function handleSociety(req, res, url) {
    if (!url.pathname.startsWith(PREFIX)) return false;

    if (url.pathname === `${PREFIX}/team` && req.method === 'POST') {
      withBody(req, res, (body) => {
        const t = AgentTeam.fromWorkforce({
          id: body.id ?? `t_${Date.now()}`,
          cellId: body.cellId,
          workforce: { id: body.workforceId, roster: body.members ?? [] },
        });
        teams.set(t.id, t);
        sendJson(res, 200, { ok: true, topology: t.topology() });
      });
      return true;
    }

    if (url.pathname === `${PREFIX}/delegate` && req.method === 'POST') {
      withBody(req, res, (body) => {
        const t = teamOf(body);
        const d = t.delegate(body);
        sendJson(res, 200, { ok: true, delegation: d, chain: t.chainFor(body.missionId) });
      });
      return true;
    }

    if (url.pathname === `${PREFIX}/execute` && req.method === 'POST') {
      withBody(req, res, (body) => {
        const t = teamOf(body);
        t.recordExecution(body);
        sendJson(res, 200, { ok: true, chain: t.chainFor(body.missionId) });
      });
      return true;
    }

    if (url.pathname === `${PREFIX}/verify` && req.method === 'POST') {
      withBody(req, res, (body) => {
        const t = teamOf(body);
        t.recordVerification(body);
        sendJson(res, 200, { ok: true, chain: t.chainFor(body.missionId) });
      });
      return true;
    }

    if (url.pathname === `${PREFIX}/chain` && req.method === 'GET') {
      const t = teams.get(url.searchParams.get('teamId'));
      if (!t) {
        sendJson(res, 404, { ok: false, error: 'unknown team' });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        topology: t.topology(),
        chain: t.chainFor(url.searchParams.get('missionId')),
        kinds: [...HANDOFF_KINDS],
      });
      return true;
    }

    return false;
  };
}
