// ponytail: intent APIs stay side-effect free. The federation journey records
// resolution/progression while the Compose compiler produces a portable
// artifact only; neither route grants authority or executes work.
import { sendJson, readJson } from './http-utils.mjs';
import { resolveUniversalIntent } from '../src/composer/universal-resolver.mjs';
import { createIntentJourney, advanceJourney } from '../src/intent/journey.mjs';
import {
  createIntentIR,
  validateIntentIR,
  classifyTarget,
  renderIntent,
  refineIntent,
  TARGETS,
} from '../packages/intent-compiler/index.mjs';

const PREFIX = '/api/v1/federation/intent';
const COMPILE_PATH = '/api/v1/intent/compile';

function resolveTarget(ir, requested) {
  const target = String(requested || 'auto').trim();
  if (target === 'auto') return classifyTarget(ir);
  if (!TARGETS.has(target)) return null;
  return { target, confidence: 1, reasonCodes: ['manual-target-override'], alternatives: [] };
}

function compileFindings(ir, validation) {
  return [
    ...(validation.findings || []),
    ...(ir.ambiguities || []).map(message => ({ code: 'AMBIGUITY', message })),
  ];
}

export function createIntentCompileHandler({ provider } = {}) {
  return async function handleIntentCompile(req, res, url) {
    if (url.pathname !== COMPILE_PATH || req.method !== 'POST') return false;
    const body = await readJson(req);
    const source = String(body?.source || '').trim();
    if (!source) {
      sendJson(res, 422, { error: 'source_required' });
      return true;
    }
    if (!provider || typeof provider.analyze !== 'function') {
      sendJson(res, 502, { error: 'provider_unconfigured' });
      return true;
    }
    try {
      const candidate = await provider.analyze({ source });
      const ir = createIntentIR({
        ...candidate,
        source: { ...(candidate?.source || {}), text: source },
      });
      const validation = validateIntentIR(ir);
      if (!validation.ok) {
        sendJson(res, 422, { error: 'ir_invalid', findings: validation.findings });
        return true;
      }
      const target = resolveTarget(ir, body?.target);
      if (!target) {
        sendJson(res, 422, { error: 'unsupported_target' });
        return true;
      }
      let artifact = renderIntent(ir, target.target);
      if (body?.refinement) {
        const refined=refineIntent(ir,String(body.refinement),target.target);
        if (refined.error) {
          sendJson(res,422,{error:refined.error.toLowerCase()});
          return true;
        }
        artifact=refined.artifact;
      }
      sendJson(res, 200, {
        ir,
        target,
        artifact,
        findings: compileFindings(ir, validation),
      });
    } catch (error) {
      sendJson(res, 502, { error: error?.code || 'provider_request_failed' });
    }
    return true;
  };
}

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
