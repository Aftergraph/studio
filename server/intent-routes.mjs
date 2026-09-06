// ponytail: thin route over the src/intent journey machine — same shape as
// research-routes. Resolve + advance endpoints record only; grants still come
// from the registry, execution from the governed capability runtime.
import { sendJson, readJson } from './http-utils.mjs';
import { resolveUniversalIntent } from '../src/composer/universal-resolver.mjs';
import { createIntentJourney, advanceJourney } from '../src/intent/journey.mjs';

const PREFIX = '/api/v1/federation/intent';

export function createIntentRouteHandler({ kernel }) {
  if (!kernel) throw new TypeError('kernel required');
  return function handleIntent(req, res, url) {
    if (!url.pathname.startsWith(PREFIX)) return false;

    if (url.pathname === `${PREFIX}/resolve` && req.method === 'POST') {
      readJson(req).then((body) => {
        try {
          const subject = body?.subjectId ? { id: body.subjectId } : null;
          const journey = createIntentJourney({
            resolution: resolveUniversalIntent({
              text: body?.text ?? '',
              mode: body?.mode ?? 'Ask',
              context: body?.context ?? [],
              subject,
              capabilityRegistry: kernel._registries?.capabilities,
              requestedCapabilities: body?.requestedCapabilities ?? [],
            }),
            actor: body?.actor ?? body?.subjectId,
          });
          sendJson(res, 200, { ok: true, journey });
        } catch (err) {
          sendJson(res, 400, { ok: false, error: err.message });
        }
      }).catch(() => sendJson(res, 400, { error: 'invalid_json_body' }));
      return true;
    }

    if (url.pathname === `${PREFIX}/advance` && req.method === 'POST') {
      readJson(req).then((body) => {
        try {
          if (!body?.journey) throw new TypeError('journey required');
          const journey = advanceJourney(body.journey, body.stage, {
            ...body.meta,
            registry: body.stage === 'executing' ? kernel._registries?.capabilities : undefined,
          });
          sendJson(res, 200, { ok: true, journey });
        } catch (err) {
          const status = err instanceof RangeError ? 409 : err.message.includes('not granted') ? 403 : 400;
          sendJson(res, status, { ok: false, error: err.message });
        }
      }).catch(() => sendJson(res, 400, { error: 'invalid_json_body' }));
      return true;
    }

    return false;
  };
}
