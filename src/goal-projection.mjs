// src/goal-projection.mjs — canonical Goal projection (experience plane).
//
// Studio owns NO authority, execution, or verification truth. This module is
// a pure projection over upstream facts: it derives what the operator sees
// (Goal → Plan → Progress → Needs You → Artifact/Evidence → Verified Outcome)
// and guards lifecycle controls. Every control maps to a canonical upstream
// call, named in CONTROL_UPSSTREAM; Studio never invents truth here.
//
// Needs-You kinds (all 8 required by the operating surface):
//   clarification, approval, credential, budget,
//   policy_conflict, authority_revocation, external_blocker,
//   verification_failure
// Lifecycle: takeover, hand_back, pause, cancel, resume.
// Verification stages are four DISTINCT states; only `verified` (with an
// independent verifier ref) may render Verified Outcome.

export const NEEDS_YOU_KINDS = Object.freeze([
  'clarification',
  'approval',
  'credential',
  'budget',
  'policy_conflict',
  'authority_revocation',
  'external_blocker',
  'verification_failure',
]);

export const VERIFICATION_STAGES = Object.freeze([
  'declared',
  'execution_complete',
  'verification_pending',
  'verified',
]);

// Canonical upstream call behind each control. Studio invokes these; it does
// not decide authority, execution, or verification outcomes itself.
export const CONTROL_UPSTREAM = Object.freeze({
  takeover: 'runtime.worker.takeover',
  hand_back: 'runtime.worker.hand_back',
  pause: 'works-execution.work.pause',
  cancel: 'works-execution.work.cancel',
  resume: 'works-execution.work.resume',
});

const TERMINAL = new Set(['cancelled', 'verified', 'failed']);

export function createGoal({ goalId, missionId, causalId }) {
  if (!goalId || !missionId || !causalId) throw new Error('goal: missing identity binding');
  return Object.freeze({
    goalId, missionId, causalId,
    status: 'active',
    owner: 'agent',
    needsYou: null,
    verificationStage: 'declared',
    verifierRef: null,
    evidenceRoot: null,
    history: Object.freeze([]),
  });
}

function evolve(goal, event) {
  return Object.freeze({
    ...goal,
    ...event.patch,
    history: Object.freeze([...goal.history, { at: new Date().toISOString(), ...event.mark }]),
  });
}

export function raiseNeedsYou(goal, kind, detail = {}) {
  if (!NEEDS_YOU_KINDS.includes(kind)) throw new Error(`goal: unknown needs-you kind ${kind}`);
  if (TERMINAL.has(goal.status)) throw new Error('goal: terminal goal cannot raise needs-you');
  return evolve(goal, {
    patch: { needsYou: Object.freeze({ kind, ...detail }) },
    mark: { control: 'raise_needs_you', kind },
  });
}

export function clearNeedsYou(goal, resolution) {
  if (!goal.needsYou) throw new Error('goal: no needs-you to clear');
  if (!resolution) throw new Error('goal: resolution required');
  return evolve(goal, {
    patch: { needsYou: null },
    mark: { control: 'clear_needs_you', resolution },
  });
}

export function applyControl(goal, control) {
  if (!CONTROL_UPSTREAM[control]) throw new Error(`goal: unknown control ${control}`);
  if (TERMINAL.has(goal.status) && control !== 'takeover') {
    throw new Error(`goal: control ${control} refused on terminal goal`);
  }
  switch (control) {
    case 'takeover':
      if (goal.owner === 'human') throw new Error('goal: already under human control');
      return evolve(goal, {
        patch: { owner: 'human' },
        mark: { control, upstream: CONTROL_UPSTREAM[control] },
      });
    case 'hand_back':
      if (goal.owner !== 'human') throw new Error('goal: nothing to hand back');
      return evolve(goal, {
        patch: { owner: 'agent' },
        mark: { control, upstream: CONTROL_UPSTREAM[control] },
      });
    case 'pause':
      if (goal.status !== 'active') throw new Error('goal: only active goals pause');
      return evolve(goal, {
        patch: { status: 'paused' },
        mark: { control, upstream: CONTROL_UPSTREAM[control] },
      });
    case 'resume':
      if (goal.status !== 'paused') throw new Error('goal: only paused goals resume');
      return evolve(goal, {
        patch: { status: 'active' },
        mark: { control, upstream: CONTROL_UPSTREAM[control] },
      });
    case 'cancel':
      return evolve(goal, {
        patch: { status: 'cancelled', needsYou: null },
        mark: { control, upstream: CONTROL_UPSTREAM[control] },
      });
    default:
      throw new Error(`goal: unhandled control ${control}`);
  }
}

// Upstream facts projected in. Studio never sets verified itself: the
// `verified` stage requires an independent verifier ref; execution-complete
// without a verdict projects to verification_pending, never verified.
export function projectUpstream(goal, facts = {}) {
  let stage = 'declared';
  if (facts.executionComplete) stage = 'execution_complete';
  if (facts.executionComplete && facts.verdictSeen) stage = 'verification_pending';
  let verifierRef = null;
  if (
    facts.executionComplete && facts.verdictSeen &&
    facts.verifierRef && facts.verifierRef !== facts.executorRef
  ) {
    stage = 'verified';
    verifierRef = facts.verifierRef;
  }
  const patch = { verificationStage: stage, verifierRef };
  if (facts.executionComplete && !facts.verdictSeen && goal.status === 'active') {
    patch.status = 'active';
  }
  if (stage === 'verified') patch.status = 'verified';
  if (facts.evidenceRoot) patch.evidenceRoot = facts.evidenceRoot;
  return evolve(goal, { patch, mark: { control: 'project_upstream', stage } });
}

// Goal truth survives transport restarts: serialize the projection (never
// chat history) and rehydrate it byte-identically.
export function serializeGoal(goal) {
  return JSON.stringify(goal);
}

export function rehydrateGoal(serialized) {
  const goal = JSON.parse(serialized);
  if (!goal.goalId || !goal.missionId || !goal.causalId) {
    throw new Error('goal: capsule missing identity binding');
  }
  return Object.freeze({ ...goal, history: Object.freeze(goal.history || []) });
}
