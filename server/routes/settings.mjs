/**
 * Settings routes: /api/v1/billing/settings
 */
import { API_VERSION, readJson, sendJson } from '../http-utils.mjs';
import { evaluateBilling } from '../../src/billing/readiness.mjs';
import { updateBillingSettings } from '../../src/billing/mutations.mjs';

function projectBillingState(billing) {
  return { ...billing, projection: evaluateBilling({ ...billing, now: new Date().toISOString() }) };
}

export function register(router, ctx) {
  const { resolveScope, begin, actionGuard, actorError } = ctx;

  router.add('POST', '/api/v1/billing/settings', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/settings', 'billing.manage');
    try {
      let settings;
      const next = await store.mutate((draft) => {
        const result = updateBillingSettings(draft.billing, {
          issuer: body.issuer,
          defaultServiceLabel: body.defaultServiceLabel,
          invoiceSequence: body.invoiceSequence,
          approvalPolicy: body.approvalPolicy,
        });
        draft.billing = result.billing;
        settings = result.settings;
        return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', settingsUpdated: true });
      sendJson(res, 200, { version: API_VERSION, settings, billing: projectBillingState(next.billing) });
    } catch (error) {
      actionGuard.fail(actionKey, error?.message || error);
      throw error;
    }
  });
}
