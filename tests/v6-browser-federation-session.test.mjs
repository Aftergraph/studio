import test from 'node:test';
import assert from 'node:assert/strict';
import { createFederationSession } from '../src/runtime/federation-session.mjs';
import { renderResearchSurface } from '../src/views/research-view.mjs';
import { renderCapabilitiesSurface } from '../src/views/capabilities-view.mjs';

function client(overrides={}){
  return {
    integrations:async()=>({integrations:[{manifest:{id:'isr'},state:'current',freshness:'current'}]}),
    objects:async()=>({objects:[{graphId:'isr:claim:C-017',type:'claim',canonicalOwner:'isr',sourceIntegration:'isr',freshness:'current',payload:{title:'Evidence gated runtime',status:'validated'}}]}),
    now:async()=>({now:{activeWork:[],needsYou:[],research:[{graphId:'isr:claim:C-017'}],incidents:[],outcomes:[],coverage:{complete:true,unavailable:[]}}}),
    capabilities:async()=>({capabilities:[{id:'research.inspect',sourceIntegration:'isr',granted:false,description:'Inspect research evidence'}]}),
    ...overrides,
  };
}

test('federation session loads one immutable current browser projection',async()=>{
  const session=createFederationSession({client:client()});
  const snapshot=await session.refresh();
  assert.equal(snapshot.phase,'current');
  assert.equal(snapshot.integrations.length,1);
  assert.equal(snapshot.objects[0].graphId,'isr:claim:C-017');
  assert.equal(snapshot.capabilities[0].granted,false);
  assert.equal(snapshot.now.coverage.complete,true);
  assert.equal(Object.isFrozen(snapshot),true);
});

test('federation session reports degraded coverage instead of synthesizing success when one read fails',async()=>{
  const session=createFederationSession({client:client({objects:async()=>{throw new Error('objects_offline')}})});
  const snapshot=await session.refresh();
  assert.equal(snapshot.phase,'degraded');
  assert.equal(snapshot.errors.some(error=>error.surface==='objects'),true);
  assert.deepEqual(snapshot.objects,[]);
  assert.equal(snapshot.complete,false);
});

test('research surface keeps scientific provenance and explicitly denies runtime authority',()=>{
  const html=renderResearchSurface({
    phase:'current',
    objects:[{graphId:'isr:claim:C-017',type:'claim',canonicalOwner:'isr',sourceIntegration:'isr',freshness:'stale',payload:{title:'Evidence gated runtime',status:'validated',evidenceMethod:'deterministic',limitations:['not a runtime grant']}}],
    now:{coverage:{complete:false,unavailable:['avc']}},
  });
  assert.match(html,/data-domain-surface="research"/);
  assert.match(html,/Evidence gated runtime/);
  assert.match(html,/stale/i);
  assert.match(html,/Runtime authority:\s*none/i);
  assert.match(html,/partial coverage/i);
});

test('capabilities surface renders discovered capability without presenting discovery as grant',()=>{
  const html=renderCapabilitiesSurface({phase:'current',capabilities:[{id:'research.inspect',sourceIntegration:'isr',granted:false,description:'Inspect research evidence'}]});
  assert.match(html,/data-domain-surface="capabilities"/);
  assert.match(html,/research\.inspect/);
  assert.match(html,/Not granted/);
  assert.doesNotMatch(html,/Granted<\/strong>/);
});
