import { nextSemanticZoom } from '../spatial/index.mjs';
import { normalizeMissionState } from '../../src/integrations/governance.mjs';

const VIEW_KINDS = new Set(['status', 'summary', 'evidence', 'metric', 'notice']);
const CONSEQUENCES = new Set(['read', 'write', 'consequential']);
const OPENUI_COMPONENTS = Object.freeze(['Stack', 'Callout', 'TextContent', 'Buttons', 'Button']);
const SENSITIVE_KEY = /(token|secret|credential|password|api[-_]?key|authoritylease)/i;

function interactionDeepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) interactionDeepFreeze(child);
  return Object.freeze(value);
}

function interactionClone(value) {
  return structuredClone(value);
}

function assertNoSensitiveKeys(value, path = 'surface') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new Error(`sensitive renderer payload at ${path}.${key}`);
    assertNoSensitiveKeys(child, `${path}.${key}`);
  }
}
function normalizeViews(views = []) {
  if (!Array.isArray(views)) throw new TypeError('views must be an array');
  return views.map(view => {
    if (!view?.id || !VIEW_KINDS.has(view.kind)) throw new Error(`unsupported view kind ${view?.kind ?? 'missing'}`);
    return interactionClone(view);
  });
}

function normalizeActions(actions = []) {
  if (!Array.isArray(actions)) throw new TypeError('actions must be an array');
  const ids = new Set();
  return actions.map(action => {
    if (!action?.id || !action?.label || !action?.capability) throw new TypeError('interaction action incomplete');
    if (ids.has(action.id)) throw new Error(`duplicate interaction action ${action.id}`);
    if (!CONSEQUENCES.has(action.consequence)) throw new Error(`unsupported consequence ${action.consequence}`);
    ids.add(action.id);
    return {
      id: action.id,
      label: action.label,
      capability: action.capability,
      consequence: action.consequence,
      requiresConfirmation: Boolean(action.requiresConfirmation),
    };
  });
}

export function createInteractionSurface(input = {}) {
  const status = normalizeMissionState(input.status);
  if (!status) throw new Error(`unknown mission state ${input.status ?? 'missing'}`);
  const evidence = Array.isArray(input.evidence) ? interactionClone(input.evidence) : [];
  if (status === 'VERIFIED' && evidence.length === 0) throw new Error('VERIFIED interaction surface requires evidence');
  if (!input.id || !input.missionId) throw new TypeError('interaction surface id and missionId required');
  return interactionDeepFreeze({
    id: input.id,
    missionId: input.missionId,
    workId: input.workId ?? null,
    attemptId: input.attemptId ?? null,
    status,
    title: String(input.title ?? ''),
    summary: String(input.summary ?? ''),
    views: normalizeViews(input.views),
    actions: normalizeActions(input.actions),
    evidence,
    metrics: interactionClone(input.metrics ?? {}),
  });
}

function semanticActionIds(surface) {
  return surface.actions.map(action => action.id);
}

export function createNativeInteractionRenderer() {
  return Object.freeze({
    id: 'native',
    render(surface) {
      return interactionDeepFreeze({
        format: 'aftergraph-native',
        surface: interactionClone(surface),
        semanticActionIds: semanticActionIds(surface),
        complete: true,
      });
    },
    validate(result) {
      return Boolean(result?.format === 'aftergraph-native' && result?.surface?.id);
    },
  });
}
function statusVariant(status) {
  if (status === 'VERIFIED') return 'success';
  if (status === 'FAILED' || status === 'REVOKED') return 'error';
  if (status === 'NEEDS_INPUT' || status === 'RECOVERING') return 'warning';
  return 'info';
}

function openUIProgram(surface) {
  const lines = ['root = Stack([statusNotice, summaryText, detailStack, actionButtons])'];
  lines.push(`statusNotice = Callout(${JSON.stringify(statusVariant(surface.status))}, ${JSON.stringify(surface.title || surface.status)}, ${JSON.stringify(surface.status)})`);
  lines.push(`summaryText = TextContent(${JSON.stringify(surface.summary)}, "default")`);
  const detailRefs = [];
  surface.views.forEach((view, index) => {
    const ref = `detail${index}`;
    detailRefs.push(ref);
    lines.push(`${ref} = TextContent(${JSON.stringify([view.title, view.body].filter(Boolean).join(': '))}, "default")`);
  });
  surface.evidence.forEach((evidence, index) => {
    const ref = `evidence${index}`;
    detailRefs.push(ref);
    lines.push(`${ref} = TextContent(${JSON.stringify(`Evidence ${evidence.id} · ${evidence.freshness ?? 'unknown'}`)}, "small")`);
  });
  lines.push(`detailStack = Stack([${detailRefs.join(', ')}])`);
  const buttonRefs = surface.actions.map((action, index) => `action${index}`);
  lines.push(`actionButtons = Buttons([${buttonRefs.join(', ')}], "row")`);
  surface.actions.forEach((action, index) => {
    const variant = action.consequence === 'consequential' ? 'primary' : 'secondary';
    lines.push(`action${index} = Button(${JSON.stringify(action.label)}, ${JSON.stringify(`action:${action.id}`)}, ${JSON.stringify(variant)})`);
  });
  return lines.join('\n');
}
function stripQuotedStrings(value) {
  return value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

export function assertValidOpenUIProgram(value) {
  if (typeof value !== 'string' || !value.startsWith('root = Stack(')) {
    throw new Error('OpenUI program requires root = Stack(...)');
  }
  if (/<script|javascript:|data:text\/html/i.test(value)) throw new Error('unsafe OpenUI program');
  const source = stripQuotedStrings(value);
  for (const match of source.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\(/g)) {
    if (!OPENUI_COMPONENTS.includes(match[1])) throw new Error(`unknown OpenUI component ${match[1]}`);
  }
  return true;
}

function validateOpenUIShape(value) {
  try {
    return assertValidOpenUIProgram(value);
  } catch {
    return false;
  }
}

export function createOpenUIInteractionRenderer() {
  return Object.freeze({
    id: 'openui',
    render(surface, { complete = true } = {}) {
      assertNoSensitiveKeys(surface);
      const content = openUIProgram(surface);
      if (!validateOpenUIShape(content)) throw new Error('invalid OpenUI renderer output');
      const bindings = complete
        ? surface.actions.map(action => ({ event: `action:${action.id}`, actionId: action.id }))
        : [];
      return interactionDeepFreeze({
        format: 'openui-lang', content, components: [...OPENUI_COMPONENTS],
        semanticActionIds: semanticActionIds(surface), bindings, complete: Boolean(complete),
      });
    },
    validate(result) {
      return Boolean(result?.format === 'openui-lang' && validateOpenUIShape(result.content));
    },
  });
}
export function resolveInteractionAction({ surface, actionId, authorize } = {}) {
  const action = surface?.actions?.find(candidate => candidate.id === actionId);
  if (!action) throw new Error(`unknown interaction action ${actionId ?? 'missing'}`);
  if (typeof authorize !== 'function') throw new Error('authority resolver required');
  const decision = authorize({
    missionId: surface.missionId,
    surfaceId: surface.id,
    actionId: action.id,
    capability: action.capability,
    consequence: action.consequence,
  });
  if (!decision?.allowed || !decision?.authorityRef) {
    throw new Error(`authority unavailable for ${action.capability}`);
  }
  return interactionDeepFreeze({
    type: 'capability.request', missionId: surface.missionId, surfaceId: surface.id,
    actionId: action.id, capability: action.capability, consequence: action.consequence,
    requiresConfirmation: action.requiresConfirmation, authorityRef: decision.authorityRef,
  });
}

function serializedResult(result) {
  if (typeof result?.content === 'string') return result.content;
  return JSON.stringify(result);
}

export async function benchmarkInteractionRenderer({ renderer, surface, iterations = 1, countTokens = value => Math.ceil(value.length / 4) } = {}) {
  if (!renderer?.render || !renderer?.validate) throw new TypeError('renderer with render and validate required');
  const expected = semanticActionIds(surface);
  let totalLatency = 0;
  let totalTokens = 0;
  let parseFailures = 0;
  let semanticActionErrors = 0;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const result = await renderer.render(surface);
    totalLatency += performance.now() - started;
    const serialized = serializedResult(result);
    totalTokens += countTokens(serialized);
    if (!renderer.validate(result)) parseFailures += 1;
    if (JSON.stringify(result.semanticActionIds ?? []) !== JSON.stringify(expected)) semanticActionErrors += 1;
  }
  return interactionDeepFreeze({
    renderer: renderer.id ?? 'unknown', iterations, tokens: totalTokens,
    meanLatencyMs: totalLatency / iterations, parseFailures, semanticActionErrors,
  });
}

export function resolveInteraction({ command, surfaceId=null, regionId=null, level='mission', objectId=null }={}) {
  switch (command) {
    case 'focus-surface': return { type:'surface.focus', surfaceId };
    case 'close-surface': return { type:'surface.close', surfaceId };
    case 'move-surface': return { type:'surface.move', surfaceId, regionId };
    case 'zoom-in': return { type:'zoom.set', level:nextSemanticZoom(level,1), objectId };
    case 'zoom-out': return { type:'zoom.set', level:nextSemanticZoom(level,-1), objectId };
    case 'focus-space': return { type:'space.mode', mode:'focus' };
    case 'overview-space': return { type:'space.mode', mode:'overview' };
    default: return null;
  }
}
