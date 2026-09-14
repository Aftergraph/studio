/**
 * Customer routes: /api/v1/billing/customers/*
 */
import { API_VERSION, readJson, sendJson } from '../http-utils.mjs';
import { evaluateBilling } from '../../src/billing/readiness.mjs';
import { createBillingCustomer, updateBillingCustomer } from '../../src/billing/mutations.mjs';

function projectBillingState(billing) {
  return { ...billing, projection: evaluateBilling({ ...billing, now: new Date().toISOString() }) };
}

export function register(router, ctx) {
  const { resolveScope, begin, actionGuard, actorError } = ctx;

  router.add('POST', '/api/v1/billing/customers', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/customers', 'billing.manage');
    try {
      let customer;
      const next = await store.mutate((draft) => {
        const result = createBillingCustomer(draft.billing, {
          id: body.id, name: body.name, address: body.address, email: body.email,
          countryCode: body.countryCode, registrationId: body.registrationId,
          registrationScheme: body.registrationScheme, billing: body.billing, actor,
        });
        draft.billing = result.billing; customer = result.customer; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', customerId: customer.id });
      sendJson(res, 201, { version: API_VERSION, customer, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('PATCH', '/api/v1/billing/customers/:customerId', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const customerId = params.customerId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/customers/${customerId}`, 'billing.manage');
    try {
      let customer;
      const next = await store.mutate((draft) => {
        const result = updateBillingCustomer(draft.billing, {
          id: customerId, name: body.name, address: body.address, email: body.email,
          countryCode: body.countryCode, registrationId: body.registrationId,
          registrationScheme: body.registrationScheme, billing: body.billing, actor,
        });
        draft.billing = result.billing; customer = result.customer; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', customerId: customer.id });
      sendJson(res, 200, { version: API_VERSION, customer, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });
}
