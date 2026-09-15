import test from 'node:test';
import assert from 'node:assert/strict';
import { createAftergraphGenerativeRegistry } from '../src/genui/aftergraph-registry.mjs';
import { createAftergraphGeneratedActionCatalog } from '../src/genui/action-catalog.mjs';
import { createGeneratedInteractionEnvelope, prepareGeneratedInteraction } from '../src/genui/interaction-envelope.mjs';

const registry=createAftergraphGenerativeRegistry();
const actions=createAftergraphGeneratedActionCatalog();
const currentContext={surface:'chat',contextId:'mission_q4',freshness:'current'};
const actorState={user:{id:'human:jonas',capabilities:['work.execute']}};

function proposal(){return {
  componentId:'ActionProposal',version:'1.0.0',instanceId:'gen-1',
  props:{title:'Prepare release',detail:'Prepare the verified release candidate.',action:'release.prepare',targetType:'mission',targetId:'mission_q4'},
};}

test('generated interaction envelope derives authority-sensitive metadata from trusted registries',()=>{
  const envelope=createGeneratedInteractionEnvelope({registry,actionCatalog:actions,node:proposal(),context:currentContext,actorId:'human:jonas',now:()=>new Date('2026-09-15T09:00:00Z')});
  assert.equal(envelope.action,'release.prepare');
  assert.equal(envelope.interactionClass,'command');
  assert.deepEqual(envelope.targetRefs,[{type:'mission',id:'mission_q4'}]);
  assert.deepEqual(envelope.requiredCapabilities,['work.execute']);
  assert.equal(envelope.createdAt,'2026-09-15T09:00:00.000Z');
  assert.equal(envelope.executed,false);
  assert.equal(envelope.endpoint,undefined);
});

test('generated action preparation fails closed before authority when freshness or capability is invalid',()=>{
  const stale=prepareGeneratedInteraction({registry,actionCatalog:actions,node:proposal(),context:{...currentContext,freshness:'stale'},actorState,actorId:'human:jonas'});
  assert.equal(stale.status,'blocked');
  assert.equal(stale.reason,'freshness_required');

  const missing=prepareGeneratedInteraction({registry,actionCatalog:actions,node:proposal(),context:currentContext,actorState:{user:{id:'human:jonas',capabilities:[]}},actorId:'human:jonas'});
  assert.equal(missing.status,'blocked');
  assert.equal(missing.reason,'capability_required');
  assert.deepEqual(missing.missingCapabilities,['work.execute']);
});

test('generated action preparation hands semantic command to authority resolver without executing it',()=>{
  const calls=[];
  const result=prepareGeneratedInteraction({registry,actionCatalog:actions,node:proposal(),context:currentContext,actorState,actorId:'human:jonas',resolveAuthority:request=>{calls.push(request);return {status:'resolved',owner:'works',operation:'release.prepare',requiresApproval:false}}});
  assert.equal(calls.length,1);
  assert.equal(calls[0].action,'release.prepare');
  assert.deepEqual(calls[0].targetRefs,[{type:'mission',id:'mission_q4'}]);
  assert.equal(result.status,'prepared');
  assert.equal(result.authority.owner,'works');
  assert.equal(result.executionAllowed,false);
  assert.equal(result.envelope.executed,false);
});

test('unknown semantic actions and endpoint-shaped values fail closed',()=>{
  const unknown=proposal();unknown.props={...unknown.props,action:'root.destroy'};
  assert.throws(()=>createGeneratedInteractionEnvelope({registry,actionCatalog:actions,node:unknown,context:currentContext,actorId:'human:jonas'}),/unknown generated action/i);
  assert.throws(()=>createGeneratedInteractionEnvelope({registry,actionCatalog:actions,node:proposal(),context:currentContext,actorId:'human:jonas',values:{endpoint:'/admin/release'}}),/generated interaction values/i);
});

import { normalizeGeneratedCommand } from '../packages/interaction/index.mjs';

test('interaction package normalizes generated semantic commands without transport authority',()=>{
  const command=normalizeGeneratedCommand({action:'release.prepare',targetRefs:[{type:'mission',id:'mission_q4'}],values:{note:'candidate'}});
  assert.equal(command.kind,'generated-command');
  assert.equal(command.action,'release.prepare');
  assert.deepEqual(command.targetRefs,[{type:'mission',id:'mission_q4'}]);
  assert.equal(command.endpoint,undefined);
  assert.ok(Object.isFrozen(command));
  assert.throws(()=>normalizeGeneratedCommand({action:'/admin/release',targetRefs:[]}),/semantic action/i);
});

test('command preparation may remain prepared while canonical authority resolution is pending',()=>{
  const result=prepareGeneratedInteraction({registry,actionCatalog:actions,node:proposal(),context:currentContext,actorState,actorId:'human:jonas',resolveAuthority:()=>({status:'pending'})});
  assert.equal(result.status,'prepared');
  assert.equal(result.authority.status,'pending');
  assert.equal(result.executionAllowed,false);
  assert.equal(result.envelope.executed,false);
});
