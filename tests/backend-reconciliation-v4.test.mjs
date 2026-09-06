import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { isRuntimePatchOnly } from '../src/backend-reconciliation.mjs';

const clone=v=>structuredClone(v);

test('progress and trajectory ticks are patch-only while runtime ownership is stable',()=>{
  const before=createInitialState();
  const after=clone(before);
  after.missions[0].progress=71;
  after.missions[0].steps[1].state='completed';
  after.missions[0].steps[2].state='running';
  const runtimes={mission_q4:{status:'running',tick:2}};
  assert.equal(isRuntimePatchOnly(before,after,runtimes,{mission_q4:{status:'running',tick:3}}),true);
});

test('message, approval, authority and outcome transitions require structural render',()=>{
  const before=createInitialState();
  const running={mission_q4:{status:'running',tick:2}};
  const message=clone(before);message.conversations[0].messages.push({id:'x',author:'user',text:'new'});
  assert.equal(isRuntimePatchOnly(before,message,running,running),false);
  const approval=clone(before);approval.approvals[0].state='approved';
  assert.equal(isRuntimePatchOnly(before,approval,running,running),false);
  const takeover=clone(before);takeover.missions[0].controlMode='takeover';
  assert.equal(isRuntimePatchOnly(before,takeover,running,running),false);
  const verified=clone(before);verified.missions[0].state='verified';verified.missions[0].verified=true;
  assert.equal(isRuntimePatchOnly(before,verified,running,running),false);
});

test('runtime status changes require a structural render so controls remain truthful',()=>{
  const before=createInitialState();const after=clone(before);after.missions[0].progress=67;
  assert.equal(isRuntimePatchOnly(before,after,{mission_q4:{status:'running',tick:2}},{mission_q4:{status:'paused',tick:2}}),false);
});
