import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { createLiveRuntime, stepMission, pauseMission, resumeMission } from '../src/live-runtime.mjs';

test('live runtime advances the active step deterministically', () => {
  const state = createInitialState();
  const runtime = createLiveRuntime(state, 'mission_q4');
  const next = stepMission(runtime);
  assert.ok(next.state.missions.find(m=>m.id==='mission_q4').progress > 65);
  assert.equal(next.status, 'running');
});

test('runtime pauses on consequential approval and emits attention state', () => {
  const state = createInitialState();
  const runtime = createLiveRuntime(state, 'mission_release');
  const next = stepMission(runtime);
  assert.equal(next.status, 'awaiting_approval');
  assert.equal(next.attention.type, 'approval');
});

test('pause and resume preserve mission progress', () => {
  const runtime = createLiveRuntime(createInitialState(), 'mission_q4');
  const paused = pauseMission(runtime);
  assert.equal(paused.status, 'paused');
  const progress = paused.state.missions.find(m=>m.id==='mission_q4').progress;
  const resumed = resumeMission(paused);
  assert.equal(resumed.status, 'running');
  assert.equal(resumed.state.missions.find(m=>m.id==='mission_q4').progress, progress);
});


test('repeated live steps settle into a verified durable outcome', () => {
  let runtime=createLiveRuntime(createInitialState(),'mission_q4');
  for(let i=0;i<12 && runtime.status!=='verified';i++) runtime=stepMission(runtime);
  const mission=runtime.state.missions.find(m=>m.id==='mission_q4');
  assert.equal(runtime.status,'verified');
  assert.equal(mission.state,'verified');
  assert.equal(mission.progress,100);
  assert.ok(mission.evidenceCount>0);
  assert.ok(mission.steps.every(step=>step.state==='completed'));
});
