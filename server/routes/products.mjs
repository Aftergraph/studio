/**
 * Product routes: /api/v1/billing/products/*
 */
import { API_VERSION, readJson, sendJson } from '../http-utils.mjs';
import { evaluateBilling } from '../../src/billing/readiness.mjs';
import { assertActorCapability } from '../../src/action-guard.mjs';
import { createBillingProduct, updateBillingProduct } from '../../src/billing/mutations.mjs';

function projectBillingState(billing) {
  return { ...billing, projection: evaluateBilling({ ...billing, now: new Date().toISOString() }) };
}

export function register(router, ctx) {
  const { resolveScope, begin, actionGuard, actorError, users } = ctx;

  router.add('GET', '/api/v1/billing/products', async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const billing = store.snapshot().billing || {};
    sendJson(res, 200, { version: API_VERSION, products: billing.products || [] });
  });

  router.add('POST', '/api/v1/billing/products', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/products', 'billing.manage');
    try {
      let product;
      const next = await store.mutate((draft) => {
        const result = createBillingProduct(draft.billing, {
          id: body.id, name: body.name, description: body.description,
          unitPriceMinor: body.unitPriceMinor, vatRateBps: body.vatRateBps,
          category: body.category, sku: body.sku, active: body.active, actor,
        });
        draft.billing = result.billing; product = result.product; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', productId: product.id });
      sendJson(res, 201, { version: API_VERSION, product, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('PATCH', '/api/v1/billing/products/:productId', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const productId = params.productId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/products/${productId}`, 'billing.manage');
    try {
      let product;
      const next = await store.mutate((draft) => {
        const result = updateBillingProduct(draft.billing, {
          id: productId, name: body.name, description: body.description,
          unitPriceMinor: body.unitPriceMinor, vatRateBps: body.vatRateBps,
          category: body.category, sku: body.sku, active: body.active, actor,
        });
        draft.billing = result.billing; product = result.product; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', productId: product.id });
      sendJson(res, 200, { version: API_VERSION, product, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });
}
