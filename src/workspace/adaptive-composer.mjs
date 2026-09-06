// ponytail: adaptive workspace composition — typed surface descriptors only,
// never markup. Same capability-gating idiom as compose-engine; stage/context
// inputs come from the V7.0 intent journey. Upgrade path: per-user prefs.
export const ADAPTIVE_SURFACE_KINDS = Object.freeze([
  'mission-detail', 'context-inspector', 'approval-gate', 'evidence-panel',
  'needs-you', 'action-bar', 'fallback-feed',
]);

const STAGE_PIN = Object.freeze({
  approved: 'approval-gate',
  awaiting: 'needs-you',
});

function hasGrant(granted, required) {
  if (!required) return true;
  return granted.includes('*') || granted.includes(required);
}

export function composeAdaptive({
  registry,
  objectType = '',
  journeyStage = 'resolved',
  context = [],
  intent = 'inspect',
  granted = [],
  evidenceRef = null,
  device = 'desktop',
} = {}) {
  if (!registry?.forObjectType) throw new TypeError('registry required');
  const type = String(objectType).toLowerCase();
  const stage = String(journeyStage).toLowerCase();
  const mobile = String(device).toLowerCase() === 'mobile';
  const density = mobile ? 'summary' : 'detail';

  const registered = new Set(registry.list().map((s) => s.id));
  const kind = (id) => (registered.has(id) ? id : null);
  const surfaces = [];
  const omitted = [];

  // 1. stage-pinned surface first (approval needs you before anything else)
  const pin = STAGE_PIN[stage];
  if (pin && kind(pin)) surfaces.push({ kind: pin, priority: 0, density, reason: 'stage' });

  // 2. evidenced claim binds its sealed evidence
  if (stage === 'evidenced' && evidenceRef && kind('evidence-panel')) {
    surfaces.push({ kind: 'evidence-panel', priority: surfaces.length, density, reason: 'evidence', ref: String(evidenceRef) });
  }

  // 3. object-type surfaces from the registry (typed, never invented)
  for (const s of registry.forObjectType(type)) {
    if (!ADAPTIVE_SURFACE_KINDS.includes(s.id)) continue;
    if (surfaces.some((x) => x.kind === s.id)) continue;
    surfaces.push({ kind: s.id, priority: surfaces.length, density, reason: 'object' });
  }

  // 4. memory/brain context pulls in the inspector
  if (context.some((c) => /^(brain|memory|context):/i.test(String(c))) && kind('context-inspector')) {
    if (!surfaces.some((x) => x.kind === 'context-inspector')) {
      surfaces.push({ kind: 'context-inspector', priority: surfaces.length, density, reason: 'context' });
    }
  }

  // 5. execute intent → capability-gated action bar
  if (['execute', 'command', 'delegate'].includes(String(intent).toLowerCase())) {
    if (hasGrant(granted, 'work.execute') && kind('action-bar')) {
      surfaces.push({ kind: 'action-bar', priority: surfaces.length, density: 'compact', reason: 'intent' });
    } else {
      omitted.push({ kind: 'action-bar', reason: 'capability', required: 'work.execute' });
    }
  }

  // 6. fallback — typed, never arbitrary
  if (surfaces.length === 0) {
    surfaces.push({ kind: kind('fallback-feed') ?? [...registered].find((id) => ADAPTIVE_SURFACE_KINDS.includes(id)) ?? 'fallback-feed', priority: 0, density, reason: 'fallback' });
  }

  return Object.freeze({
    objectType: type,
    journeyStage: stage,
    device: mobile ? 'mobile' : 'desktop',
    density,
    surfaces: Object.freeze(surfaces.map((s) => Object.freeze({ ...s }))),
    omitted: Object.freeze(omitted.map((o) => Object.freeze({ ...o }))),
  });
}
