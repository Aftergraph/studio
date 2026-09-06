import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, resolveNeed, decideApproval, setTakeover, settleMission, conversationMissionId } from '../src/state.mjs';

test('resolving Needs You removes it from active attention queue', () => {
  const state = createInitialState();
  const id = state.needsYou[0].id;
  const next = resolveNeed(state, id);
  assert.equal(next.needsYou.some(x => x.id === id), false);
});

test('approval decision is durable and records actor', () => {
  const state = createInitialState();
  const id = state.approvals[0].id;
  const next = decideApproval(state, id, 'approved', 'demo-user');
  const approval = next.approvals.find(x => x.id === id);
  assert.equal(approval.state, 'approved');
  assert.equal(approval.decidedBy, 'demo-user');
});

test('takeover changes mission control mode without deleting progress', () => {
  const state = createInitialState();
  const missionId = state.missions[0].id;
  const progress = state.missions[0].progress;
  const next = setTakeover(state, missionId, true);
  const mission = next.missions.find(x => x.id === missionId);
  assert.equal(mission.controlMode, 'takeover');
  assert.equal(mission.progress, progress);
});

test('mission cannot be shown verified without evidence', () => {
  const state = createInitialState();
  const missionId = state.missions[0].id;
  assert.throws(() => settleMission(state, missionId, { verified:true, evidence:[] }), /evidence/i);
});


test('conversation mission identity is independent from globally selected work', () => {
  const state = createInitialState();
  assert.equal(conversationMissionId(state, 'conv_q4'), 'mission_q4');
  assert.equal(conversationMissionId(state, 'conv_deploy'), 'mission_release');
});
