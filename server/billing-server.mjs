import { API_VERSION, readJson, sendJson } from './http-utils.mjs';
import { createActionGuard, assertActorCapability } from '../src/action-guard.mjs';
import { subjectFromAuthHeader, authSecretFromEnv } from '../src/auth/magic-link.mjs';
import { getUser, updateCapabilities } from '../src/user/user-store.mjs';
import { evaluateBilling } from '../src/billing/readiness.mjs';
import { recordBillingActual, createBillingDraft, issueBillingInvoice } from '../src/billing/mutations.mjs';

function apiError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 422;
  sendJson(res, status, { error: error?.code || 'billing_request_failed' });
}

function isBillingPath(pathname) {
  return pathname === '/api/v1/billing'
    || pathname === '/api/v1/billing/actuals'
    || pathname === '/api/v1/billing/invoices/draft'
    || /^\/api\/v1\/billing\/invoices\/[^/]+\/issue$/.test(pathname);
}

function ensureDemoBillingCapability() {
  const demo = getUser('demo-user');
  if (!demo || demo.capabilities.includes('billing.manage')) return;
  updateCapabilities('demo-user', [...demo.capabilities, 'billing.manage']);
}

function actorError(code, status, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Decorate the Studio HTTP server with an extraction-ready billing API without
 * forking the canonical workspace server. Non-billing requests are delegated
 * byte-for-byte to the original request listener.
 */
export function decorateBillingServer(server, {
  authSecret = null,
  requireAuth = process.env.AFTERGRAPH_REQUIRE_AUTH === 'true',
} = {}) {
  const originals = server.listeners('request');
  if (originals.length === 0) throw new Error('billing decorator requires a request listener');
  const secret = authSecret || authSecretFromEnv();
  const actionGuard = createActionGuard();
  const users = { getUser };

  ensureDemoBillingCapability();
  server.removeAllListeners('request');

  const resolveScope = async (req, url, claimedActor = undefined) => {
    let bearer = null;
    try { bearer = subjectFromAuthHeader(req, { secret }); }
    catch { throw actorError('authentication_required', 401); }
    if (requireAuth && !bearer) throw actorError('authentication_required', 401);

    const queryActor = url.searchParams.get('actor') || undefined;
    const claimed = claimedActor || queryActor;
    if (bearer && claimed && bearer !== claimed) throw actorError('forbidden', 403);
    const actor = bearer || claimed || 'demo-user';
    if (!getUser(actor)) throw actorError('forbidden', 403);

    const store = actor === 'demo-user'
      ? server.workspace.store
      : server.workspace.stores.get(actor);
    if (!store) throw actorError('workspace_not_initialized', 409);
    await store.readyP;
    return { actor, store };
  };

  const begin = (req, body, actor, store, path) => {
    assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.manage', users });
    const supplied = req.headers['idempotency-key'] || body?.idempotencyKey;
    if (!supplied) throw actorError('idempotency_key_required', 422);
    const key = `${actor}:${req.method}:${path}:${supplied}`;
    try { actionGuard.begin(key); }
    catch { throw actorError('idempotency_conflict', 409); }
    return key;
  };

  const handle = async (req, res, url) => {
    if (url.pathname === '/api/v1/billing' && req.method === 'GET') {
      const { store } = await resolveScope(req, url);
      const billing = store.snapshot().billing;
      const projection = evaluateBilling({ ...billing, now: new Date().toISOString() });
      sendJson(res, 200, { version: API_VERSION, billing: { ...billing, projection } });
      return;
    }

    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, url.pathname);

    try {
      if (url.pathname === '/api/v1/billing/actuals' && req.method === 'POST') {
        let visit;
        const next = await store.mutate((draft) => {
          const result = recordBillingActual(draft.billing, { visitId: body.visitId, actual: body.actual });
          draft.billing = result.billing;
          visit = result.visit;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', visitId: visit.id });
        sendJson(res, 200, { version: API_VERSION, visit, billing: next.billing });
        return;
      }

      if (url.pathname === '/api/v1/billing/invoices/draft' && req.method === 'POST') {
        let invoice;
        const next = await store.mutate((draft) => {
          const result = createBillingDraft(draft.billing, {
            customerId: body.customerId,
            visitIds: body.visitIds,
            number: body.number,
            issueDate: body.issueDate,
            actor,
          });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 201, { version: API_VERSION, invoice, billing: next.billing });
        return;
      }

      const issueMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/issue$/);
      if (issueMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(issueMatch[1]);
        let invoice;
        const next = await store.mutate((draft) => {
          const result = issueBillingInvoice(draft.billing, { invoiceId, actor });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 200, { version: API_VERSION, invoice, billing: next.billing });
        return;
      }

      actionGuard.fail(actionKey, 'billing api not found');
      sendJson(res, 404, { error: 'api_not_found' });
    } catch (error) {
      actionGuard.fail(actionKey, error?.message || error);
      throw error;
    }
  };

  server.on('request', async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (!isBillingPath(url.pathname)) {
      for (const listener of originals) listener.call(server, req, res);
      return;
    }
    try { await handle(req, res, url); }
    catch (error) { apiError(res, error); }
  });

  return server;
}
