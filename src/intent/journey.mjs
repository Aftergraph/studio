// ponytail: intent→outcome thread as an immutable stage machine (same idiom as
// promotion-pipeline). The journey grants nothing — grants come from the
// capability registry (fed by TG); the journey only records + enforces order.
// Upgrade path: add 'cancelled' terminal stage when needed.
export const JOURNEY_STAGES = ['resolved', 'contextualized', 'approved', 'executing', 'evidenced', 'completed'];

function stageIndex(stage) {
  const i = JOURNEY_STAGES.indexOf(stage);
  if (i === -1) throw new TypeError(`unknown journey stage: ${stage}`);
  return i;
}

/**
 * Open a journey thread from a resolver output.
 * The resolution carries capabilities with grant statuses — the journey
 * preserves them but never changes them.
 */
export function createIntentJourney({ resolution, actor }) {
  if (!resolution?.text || !Array.isArray(resolution?.capabilities)) throw new TypeError('resolution required');
  if (!actor) throw new TypeError('actor required');
  return Object.freeze({
    kind: 'intent-journey',
    text: resolution.text,
    mode: resolution.mode,
    actor: String(actor),
    subjectId: resolution.subjectId,
    context: Object.freeze([...(resolution.context ?? [])]),
    capabilities: Object.freeze(resolution.capabilities.map((c) => Object.freeze({ ...c }))),
    stage: 'resolved',
    authority: 'none',
    approver: null,
    evidenceRef: null,
    executed: false,
    history: Object.freeze([{ stage: 'resolved', by: actor, authority: 'none', at: new Date().toISOString() }]),
  });
}

/**
 * Advance one stage. Returns a new frozen record; original unchanged.
 */
export function advanceJourney(journey, nextStage, meta = {}) {
  const current = stageIndex(journey.stage);
  const next = stageIndex(nextStage);
  if (next !== current + 1) {
    throw new RangeError(`invalid transition: stage out of order (${journey.stage} → ${nextStage})`);
  }

  let patch = {};
  if (nextStage === 'contextualized') {
    const ctx = meta.context;
    if (!Array.isArray(ctx) || ctx.length === 0) throw new TypeError('context required to contextualize');
    patch = { context: Object.freeze(ctx.map(String)) };
  }
  if (nextStage === 'approved') {
    if (!meta.approver) throw new TypeError('approver required to approve');
    patch = { approver: String(meta.approver) };
  }
  if (nextStage === 'executing') {
    // INVARIANT: journey executes nothing itself; it only records that every
    // capability in the resolution is granted in the live registry.
    if (!meta.registry) throw new TypeError('registry required to execute');
    if (!meta.subject) throw new TypeError('subject required to execute');
    for (const c of journey.capabilities) {
      if (meta.registry.grantStatus(meta.subject, c.id) !== 'granted') {
        throw new Error(`capability not granted: ${c.id}`);
      }
    }
  }
  if (nextStage === 'evidenced') {
    if (!meta.evidenceRef) throw new TypeError('evidenceRef required to seal evidence');
    patch = { evidenceRef: String(meta.evidenceRef) };
  }
  if (nextStage === 'completed' && !journey.evidenceRef && !meta.evidenceRef) {
    // completed carries the sealed ref; allow meta override for symmetry
    patch = {};
  }

  const entry = Object.freeze({ stage: nextStage, by: meta.by ?? journey.actor, authority: 'none', at: new Date().toISOString() });
  return Object.freeze({
    ...journey,
    ...patch,
    stage: nextStage,
    authority: 'none',
    history: Object.freeze([...journey.history, entry]),
  });
}
