import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { createUIState } from '../src/app/ui-state.mjs';
import { deriveActiveContext, alignModeToActiveContext } from '../src/workspace/active-context.mjs';

function fixture(mode='chat') {
  const state=createInitialState();
  state.primaryMode=mode;
  state.activeDomain=mode==='chat'?'chat':'work';
  state.activeConversationId='conv_deploy';
  const ui=createUIState(state,'desktop');
  ui.selectedMissionId='mission_q4';
  return {state,ui};
}

test('active context preserves canonical mission and artifact identity across Chat Work and Space',()=>{
  const ids=['chat','work','space'].map(mode=>{
    const {state,ui}=fixture('chat');
    const aligned=alignModeToActiveContext(state,ui,mode);
    state.primaryMode=mode;
    state.activeDomain=mode==='chat'?'chat':'work';
    const context=deriveActiveContext(state,aligned,'current');
    return {mission:context.mission?.id,artifacts:context.artifacts.map(x=>x.id)};
  });
  assert.deepEqual(ids.map(x=>x.mission),['mission_release','mission_release','mission_release']);
  assert.ok(ids.every(x=>x.artifacts.includes('art_release')));
});

test('active context marks projected objects stale without changing canonical ids',()=>{
  const {state,ui}=fixture('chat');
  const context=deriveActiveContext(state,alignModeToActiveContext(state,ui,'chat'),'stale');
  assert.equal(context.freshness.state,'stale');
  assert.equal(context.mission.id,'mission_release');
  assert.equal(context.mission.freshness,'stale');
  assert.equal(state.missions.find(x=>x.id==='mission_release').id,'mission_release');
});
