import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEEDS_YOU_KINDS,
  VERIFICATION_STAGES,
  CONTROL_UPSTREAM,
  createGoal,
  raiseNeedsYou,
  clearNeedsYou,
  applyControl,
  projectUpstream,
  serializeGoal,
  rehydrateGoal,
} from '../src/goal-projection.mjs';

const base = () => createGoal({ goalId: 'goal/1', missionId: 'mission/1', causalId: 'causal/1' });

test('needs-you covers all eight required kinds', () => {
  assert.deepEqual([...NEEDS_YOU_KINDS].sort(), [
    'approval', 'authority_revocation', 'budget', 'clarification',
    'credential', 'external_blocker', 'policy_conflict', 'verification_failure',
  ].sort());
  for (const kind of NEEDS_YOU_KINDS) {
    const g = raiseNeedsYou(base(), kind);
    assert.equal(g.needsYou.kind, kind);
    const cleared = clearNeedsYou(g, 'operator resolved');
    assert.equal(cleared.needsYou, null);
  }
});

test('unknown needs-you kind is rejected', () => {
  assert.throws(() => raiseNeedsYou(base(), 'vibes'), /unknown needs-you kind/);
});

test('lifecycle: takeover, hand-back, pause, resume, cancel', () => {
  let g = base();
  g = applyControl(g, 'takeover');
  assert.equal(g.owner, 'human');
  assert.equal(g.history.at(-1).upstream, 'runtime.worker.takeover');
  g = applyControl(g, 'hand_back');
  assert.equal(g.owner, 'agent');
  g = applyControl(g, 'pause');
  assert.equal(g.status, 'paused');
  assert.throws(() => applyControl(g, 'pause'), /only active goals pause/);
  g = applyControl(g, 'resume');
  assert.equal(g.status, 'active');
  g = applyControl(g, 'cancel');
  assert.equal(g.status, 'cancelled');
  assert.throws(() => applyControl(g, 'resume'), /terminal goal/);
});

test('every control names a canonical upstream call', () => {
  assert.deepEqual(Object.keys(CONTROL_UPSTREAM).sort(), ['cancel', 'hand_back', 'pause', 'resume', 'takeover'].sort());
  for (const g of [base()]) {
    void g;
  }
});

test('four verification stages stay distinct; verified needs independent verifier', () => {
  assert.deepEqual([...VERIFICATION_STAGES], ['declared', 'execution_complete', 'verification_pending', 'verified']);
  let g = projectUpstream(base(), { executionComplete: true });
  assert.equal(g.verificationStage, 'execution_complete');
  assert.notEqual(g.verificationStage, 'verified');
  g = projectUpstream(g, { executionComplete: true, verdictSeen: true });
  assert.equal(g.verificationStage, 'verification_pending');
  // executor verdict does not verify
  g = projectUpstream(g, { executionComplete: true, verdictSeen: true, verifierRef: 'rdisp/1', executorRef: 'rdisp/1' });
  assert.equal(g.verificationStage, 'verification_pending');
  g = projectUpstream(g, {
    executionComplete: true, verdictSeen: true,
    verifierRef: 'verifier/independent-1', executorRef: 'rdisp/1',
    evidenceRoot: 'evidence/1',
  });
  assert.equal(g.verificationStage, 'verified');
  assert.equal(g.status, 'verified');
  assert.equal(g.evidenceRoot, 'evidence/1');
});

test('goal survives serialize/rehydrate with identity intact', () => {
  let g = applyControl(base(), 'takeover');
  g = raiseNeedsYou(g, 'budget');
  const revived = rehydrateGoal(serializeGoal(g));
  assert.equal(revived.goalId, 'goal/1');
  assert.equal(revived.causalId, 'causal/1');
  assert.equal(revived.owner, 'human');
  assert.equal(revived.needsYou.kind, 'budget');
  assert.throws(() => rehydrateGoal('{"goalId":"x"}'), /missing identity binding/);
});
