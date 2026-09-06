/**
 * Research OS — Promotion Pipeline (V6.4)
 *
 * Staged, human-gated promotion of research claims/evidence.
 * Stages: proposed → reviewed → approved → promoted
 *
 * Critical invariant: runtimeAuthority is ALWAYS 'none'.
 * The 'promoted' stage emits a capability-grant-REQUEST — not a grant.
 * The capability runtime (V6.3) is the only thing that can issue actual grants.
 *
 * ponytail: linear stage machine, no branching. Upgrade path: add 'rejected'
 * terminal stage + re-proposal flow when needed.
 */

export const PROMOTION_STAGES = ['proposed', 'reviewed', 'approved', 'promoted'];

function stageIndex(stage) {
  const i = PROMOTION_STAGES.indexOf(stage);
  if (i === -1) throw new TypeError(`unknown promotion stage: ${stage}`);
  return i;
}

/**
 * Create a new promotion pipeline at stage='proposed'.
 */
export function createPromotionPipeline({ claimId, target, actor, reason = '' }) {
  if (!claimId) throw new TypeError('claimId required');
  if (!target) throw new TypeError('target required');
  if (!actor) throw new TypeError('actor required');
  return Object.freeze({
    kind: 'research-promotion-pipeline',
    claimId: String(claimId),
    target: String(target),
    actor: String(actor),
    reason: String(reason),
    stage: 'proposed',
    runtimeAuthority: 'none',
    requiresHumanApproval: true,
    history: Object.freeze([{ stage: 'proposed', by: actor, at: new Date().toISOString() }]),
  });
}

/**
 * Advance the pipeline to the next stage.
 * Returns a new frozen pipeline record; original is unchanged.
 *
 * @param {object} pipeline - current pipeline snapshot
 * @param {string} nextStage - must be the immediate next stage
 * @param {object} meta - stage-specific metadata (reviewer, approver, etc.)
 */
export function advancePromotion(pipeline, nextStage, meta = {}) {
  const current = stageIndex(pipeline.stage);
  const next = stageIndex(nextStage);

  if (next !== current + 1) {
    throw new RangeError(
      `invalid transition: stage out of order (${pipeline.stage} → ${nextStage})`
    );
  }

  // Stage-specific validations
  if (nextStage === 'reviewed') {
    if (!meta.reviewer) throw new TypeError('reviewer required to advance to reviewed');
  }
  if (nextStage === 'approved') {
    if (!meta.approver) throw new TypeError('approver required to advance to approved');
  }

  const entry = { stage: nextStage, at: new Date().toISOString(), ...structuredClone(meta) };

  const base = {
    ...pipeline,
    stage: nextStage,
    runtimeAuthority: 'none',          // invariant: never changes
    history: Object.freeze([...pipeline.history, Object.freeze(entry)]),
  };

  // 'promoted' becomes a capability-grant-request record (still not a grant)
  if (nextStage === 'promoted') {
    return Object.freeze({
      ...base,
      kind: 'capability-grant-request',
      policy: pipeline.policy ?? meta.policy,
    });
  }

  // Copy policy if it arrived at approved stage
  if (nextStage === 'approved') {
    return Object.freeze({ ...base, policy: meta.policy });
  }

  return Object.freeze(base);
}
