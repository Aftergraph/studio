// V7.2 Agent Society — Exit Gate Tests (node:test)
// Exit gate: multi-agent teams with delegation topology + role composition +
// handoff records + verifier separation.
// Invariant: an agent can NEVER expand its own authority (no self-assign,
// no self-approve, no self-verify, no role self-promotion).

import test from 'node:test';
import assert from 'node:assert/strict';
import { Workforce } from '../src/venture/workforce.mjs';
import {
  AgentTeam,
  recordHandoff,
  HANDOFF_KINDS,
} from '../src/society/agent-society.mjs';

function team() {
  const t = new AgentTeam({ id: 't1', cellId: 'c1', workforceId: 'w1' });
  t.addMember({ id: 'a-exec', role: 'executor' });
  t.addMember({ id: 'a-verify', role: 'verifier' });
  t.addMember({ id: 'a-coord', role: 'coordinator' });
  return t;
}

// ── Team composition ────────────────────────────────────────────────

test('Society: team requires id + cell binding', () => {
  assert.throws(() => new AgentTeam({}), /id/i);
  assert.throws(() => new AgentTeam({ id: 't1' }), /cell/i);
});

test('Society: members need known roles, duplicates rejected', () => {
  const t = team();
  assert.throws(() => t.addMember({ id: 'a-x', role: 'overlord' }), /role/i);
  assert.throws(() => t.addMember({ id: 'a-exec', role: 'executor' }), /duplicate|already/i);
  assert.equal(t.members.length, 3);
});

test('Society: role self-promotion blocked', () => {
  const t = team();
  assert.throws(
    () => t.changeRole({ agentId: 'a-exec', newRole: 'coordinator', approvedBy: 'a-exec' }),
    /approval|human|coordinator/i);
});

test('Society: coordinator-approved role change allowed', () => {
  const t = team();
  t.changeRole({ agentId: 'a-exec', newRole: 'verifier', approvedBy: 'a-coord' });
  assert.equal(t.members.find((m) => m.id === 'a-exec').role, 'verifier');
});

// ── Delegation topology ─────────────────────────────────────────────

test('Society: delegation requires coordinator origin, never peer-to-peer self-deal', () => {
  const t = team();
  const d = t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-verify' });
  assert.equal(d.missionId, 'm1');
  assert.equal(d.status, 'delegated');
  assert.throws(
    () => t.delegate({ missionId: 'm2', from: 'a-exec', executorId: 'a-exec', verifierId: 'a-verify' }),
    /coordinator/i);
});

test('Society: delegation enforces verifier ≠ executor', () => {
  const t = team();
  assert.throws(
    () => t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-exec' }),
    /verifier/i);
});

test('Society: delegation to non-members rejected', () => {
  const t = team();
  assert.throws(
    () => t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'ghost', verifierId: 'a-verify' }),
    /member|roster/i);
});

// ── Handoff records ─────────────────────────────────────────────────

test('Society: handoff kinds closed vocabulary', () => {
  assert.ok(HANDOFF_KINDS.includes('delegated'));
  assert.ok(HANDOFF_KINDS.includes('executed'));
  assert.ok(HANDOFF_KINDS.includes('verified'));
  assert.throws(() => recordHandoff({ kind: 'teleported', from: 'a', to: 'b', missionId: 'm' }), /kind/i);
});

test('Society: handoff requires from/to/mission, frozen', () => {
  assert.throws(() => recordHandoff({ kind: 'executed', to: 'b', missionId: 'm' }), /from/i);
  assert.throws(() => recordHandoff({ kind: 'executed', from: 'a', missionId: 'm' }), /to/i);
  const h = recordHandoff({ kind: 'executed', from: 'a-exec', to: 'a-verify', missionId: 'm1', evidenceRef: 'ev_1' });
  assert.ok(Object.isFrozen(h));
  assert.equal(h.evidenceRef, 'ev_1');
});

test('Society: full chain delegated→executed→verified recorded in order', () => {
  const t = team();
  t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-verify' });
  t.recordExecution({ missionId: 'm1', by: 'a-exec', evidenceRef: 'ev_1' });
  assert.throws(
    () => t.recordVerification({ missionId: 'm1', by: 'a-exec', verdict: 'pass' }),
    /verifier/i);
  t.recordVerification({ missionId: 'm1', by: 'a-verify', verdict: 'pass' });
  const chain = t.chainFor('m1');
  assert.deepEqual(chain.map((h) => h.kind), ['delegated', 'executed', 'verified']);
});

test('Society: verify-before-execute rejected', () => {
  const t = team();
  t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-verify' });
  assert.throws(
    () => t.recordVerification({ missionId: 'm1', by: 'a-verify', verdict: 'pass' }),
    /order|executed/i);
});

// ── Authority isolation ─────────────────────────────────────────────

test('Society: agent can never approve its own mission', () => {
  const t = team();
  t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-verify' });
  assert.throws(
    () => t.approveMission({ missionId: 'm1', approver: 'a-exec' }),
    /human|approver/i);
});

test('Society: team topology is inspectable, authority none', () => {
  const t = team();
  const topo = t.topology();
  assert.equal(topo.teamId, 't1');
  assert.equal(topo.authority, 'none');
  assert.ok(Object.isFrozen(topo));
});

// ── Workforce interop (EXTEND, not INVENT) ──────────────────────────

test('Society: team composes over V6.5 Workforce roster', () => {
  const w = new Workforce({ id: 'w1' });
  w.addAgent({ id: 'a-exec', role: 'executor', name: 'Ex' });
  w.addAgent({ id: 'a-verify', role: 'verifier', name: 'Ve' });
  w.addAgent({ id: 'a-coord', role: 'coordinator', name: 'Co' });
  const t = AgentTeam.fromWorkforce({ id: 't1', cellId: 'c1', workforce: w });
  assert.equal(t.members.length, 3);
  const d = t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-verify' });
  assert.equal(d.status, 'delegated');
});

// ── Exit gate: society + journey ────────────────────────────────────

test('V7.2 exit: delegation chain feeds journey evidence', async () => {
  const { createIntentJourney, advanceJourney } = await import('../src/intent/journey.mjs');
  const { resolveUniversalIntent } = await import('../src/composer/universal-resolver.mjs');
  const { createCapabilityRegistry } = await import('../src/federation/capability-registry.mjs');

  const t = team();
  t.delegate({ missionId: 'm1', from: 'a-coord', executorId: 'a-exec', verifierId: 'a-verify' });
  t.recordExecution({ missionId: 'm1', by: 'a-exec', evidenceRef: 'ev_soc_1' });
  t.recordVerification({ missionId: 'm1', by: 'a-verify', verdict: 'pass' });

  const reg = createCapabilityRegistry({ resolveGrant: () => true });
  reg.register({ id: 'agent:delegate', source: 'avc', discoverable: true });
  reg.register({ id: 'work:execute', source: 'avc', discoverable: true });
  const resolution = resolveUniversalIntent({
    text: 'delegate the build', mode: 'Delegate',
    subject: { id: 'human:1' }, capabilityRegistry: reg,
  });
  let j = createIntentJourney({ resolution, actor: 'human:1' });
  j = advanceJourney(j, 'contextualized', { context: ['avc:mission:m1'] });
  j = advanceJourney(j, 'approved', { approver: 'human:1' });
  j = advanceJourney(j, 'executing', { registry: reg, subject: 'human:1' });
  j = advanceJourney(j, 'evidenced', { evidenceRef: 'ev_soc_1' });
  j = advanceJourney(j, 'completed', {});
  assert.equal(j.stage, 'completed');
  assert.deepEqual(t.chainFor('m1').map((h) => h.kind), ['delegated', 'executed', 'verified']);
});
