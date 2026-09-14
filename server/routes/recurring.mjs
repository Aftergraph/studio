/**
 * Recurring routes: /api/v1/billing/recurring/*
 */
import { API_VERSION, readJson, sendJson } from '../http-utils.mjs';
import { evaluateBilling } from '../../src/billing/readiness.mjs';
import { assertActorCapability } from '../../src/action-guard.mjs';
import {
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  tickRecurringScheduler,
} from '../../src/billing/recurring.mjs';

function projectBillingState(billing) {
  return { ...billing, projection: evaluateBilling({ ...billing, now: new Date().toISOString() }) };
}

export function register(router, ctx) {
  const { resolveScope, begin, actionGuard, actorError, users } = ctx;

  router.add('GET', '/api/v1/billing/recurring', async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const billing = store.snapshot().billing || {};
    sendJson(res, 200, { version: API_VERSION, recurringInvoices: billing.recurringInvoices || [] });
  });

  router.add('POST', '/api/v1/billing/recurring', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/recurring', 'billing.manage');
    try {
      let recurring;
      const next = await store.mutate((draft) => {
        const result = createRecurringInvoice(draft.billing, {
          customerId: body.customerId, productLines: body.productLines, schedule: body.schedule, actor,
        });
        draft.billing = result.billing; recurring = result.recurring; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', recurringId: recurring.id });
      sendJson(res, 201, { version: API_VERSION, recurring, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('PATCH', '/api/v1/billing/recurring/:recurringId', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const recurringId = params.recurringId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/recurring/${recurringId}`, 'billing.manage');
    try {
      let recurring;
      const next = await store.mutate((draft) => {
        const result = updateRecurringInvoice(draft.billing, {
          id: recurringId, productLines: body.productLines, schedule: body.schedule, active: body.active, actor,
        });
        draft.billing = result.billing; recurring = result.recurring; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', recurringId: recurring.id });
      sendJson(res, 200, { version: API_VERSION, recurring, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('DELETE', '/api/v1/billing/recurring/:recurringId', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const recurringId = params.recurringId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/recurring/${recurringId}`, 'billing.manage');
    try {
      const next = await store.mutate((draft) => {
        const result = deleteRecurringInvoice(draft.billing, { id: recurringId, actor });
        draft.billing = result.billing; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', recurringId });
      sendJson(res, 200, { version: API_VERSION, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/recurring/tick', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/recurring/tick', 'billing.manage');
    try {
      let generated;
      const next = await store.mutate((draft) => {
        const result = tickRecurringScheduler(draft.billing, { now: body.now, actor });
        draft.billing = result.billing; generated = result.generated; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', generatedCount: generated.length });
      sendJson(res, 200, { version: API_VERSION, generated, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });
}
