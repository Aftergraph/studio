import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_SCOPE_MATRIX, classifyRenderChanges, isStructuralScope } from '../src/app/render-scheduler.mjs';

const base=()=>({
  activeDomain:'chat',primaryMode:'chat',activeConversationId:'c1',activeSpaceId:'s1',composerMode:'Ask',theme:'dark',
  missions:[{id:'m1',progress:10,state:'RUNNING'}],
  conversations:[{id:'c1',messages:[{id:'msg1',text:'hello'}]}],approvals:[],needsYou:[],artifacts:[],
  spaces:[{id:'s1',regions:[]}],agents:[{id:'a1',status:'working',progress:10,currentTask:'x'}],upstreams:[],
  replay:{cursor:0,playing:false},connections:[],events:[],memory:[],user:{id:'u1'},
});

test('progress-only mission tick is machine-classified as a patch scope',()=>{
  const prev=base(); const next=structuredClone(prev); next.missions[0].progress=11;
  const scopes=classifyRenderChanges(prev,next,{},{});
  assert.deepEqual(scopes,['mission.progress']);
  assert.equal(isStructuralScope(scopes),false);
  assert.equal(RENDER_SCOPE_MATRIX['missions[*].progress'].kind,'patch');
});

test('conversation message membership is structural-view',()=>{
  const prev=base(); const next=structuredClone(prev); next.conversations[0].messages.push({id:'msg2',text:'new'});
  const scopes=classifyRenderChanges(prev,next,{},{});
  assert.ok(scopes.includes('conversation.messages'));
  assert.equal(isStructuralScope(scopes),true);
});

test('unknown top-level canonical state change fails safe to structural render',()=>{
  const prev=base(); const next={...structuredClone(prev),newCanonicalField:{x:1}};
  assert.deepEqual(classifyRenderChanges(prev,next,{},{}),['unknown.structural']);
});

test('runtime status changes are patch-only',()=>{
  const prev=base(); const next=structuredClone(prev);
  const scopes=classifyRenderChanges(prev,next,{m1:{status:'running',attention:null}},{m1:{status:'paused',attention:null}});
  assert.deepEqual(scopes,['mission.runtime-status']);
  assert.equal(isStructuralScope(scopes),false);
});

test('progress-only tick supports canonical object-shaped upstream state without widening render scope',()=>{
  const prev=base();
  prev.upstreams={syncedAt:'2026-09-06T05:00:00Z',services:{trustGateway:{id:'trustGateway',status:'online',latencyMs:20,checkedAt:'2026-09-06T05:00:00Z'}},trustGateway:{approvals:[]}};
  const next=structuredClone(prev);next.missions[0].progress=11;
  assert.deepEqual(classifyRenderChanges(prev,next,{},{}),['mission.progress']);
});

test('object-shaped upstream service health changes remain patch-only',()=>{
  const prev=base();
  prev.upstreams={syncedAt:'a',services:{works:{id:'works',status:'online',latencyMs:20,checkedAt:'a'}},works:{works:[],brain:[]}};
  const next=structuredClone(prev);next.upstreams.syncedAt='b';next.upstreams.services.works.latencyMs=31;next.upstreams.services.works.checkedAt='b';
  assert.deepEqual(classifyRenderChanges(prev,next,{},{}),['system.upstream-health']);
});
