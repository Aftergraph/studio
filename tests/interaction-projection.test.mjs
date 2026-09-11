import test from 'node:test';
import assert from 'node:assert/strict';
import {createInteractionSurfaceProjection} from '../src/interaction/interaction-projection.mjs';

const base=()=>({
  tenantId:'tenant:acme',
  surfaceRef:'studio:surface:chat:1',
  threadRef:'runtime:thread:1',
  turnRefs:['runtime:turn:1'],
  presenceRefs:['runtime:presence:a'],
  assistantProfile:{id:'friday',label:'Friday'},
  freshness:'current',
});

test('projection carries refs and presentation only',()=>{
  const p=createInteractionSurfaceProjection(base());
  assert.equal(p.threadRef,'runtime:thread:1');
  assert.equal(p.canonicalOwner,'studio');
  assert.equal(p.authoritative,false);
  assert.ok(Object.isFrozen(p));
  assert.ok(!('thread' in p));
  assert.ok(!('turns' in p));
  assert.ok(!('authority' in p));
});

test('projection rejects missing identity refs',()=>{
  for(const key of ['tenantId','surfaceRef','threadRef']) {
    const input=base();
    delete input[key];
    assert.throws(()=>createInteractionSurfaceProjection(input),new RegExp(key,'i'));
  }
});

test('projection rejects embedded upstream truth fields',()=>{
  for(const key of ['thread','turns','authority','execution','verification']) {
    const input={...base(),[key]:{owned:'elsewhere'}};
    assert.throws(()=>createInteractionSurfaceProjection(input),/unsupported|embedded/i);
  }
});

test('projection rejects a cross-tenant assistant profile',()=>{
  const input={...base(),assistantProfile:{id:'friday',label:'Friday',tenantId:'tenant:globex'}};
  assert.throws(()=>createInteractionSurfaceProjection(input),/tenant/i);
});

test('projection snapshots caller arrays and assistant profile immutably',()=>{
  const input=base();
  const p=createInteractionSurfaceProjection(input);
  input.turnRefs.push('runtime:turn:2');
  input.presenceRefs[0]='runtime:presence:changed';
  input.assistantProfile.label='Changed';
  assert.deepEqual(p.turnRefs,['runtime:turn:1']);
  assert.deepEqual(p.presenceRefs,['runtime:presence:a']);
  assert.equal(p.assistantProfile.label,'Friday');
  assert.ok(Object.isFrozen(p.turnRefs));
  assert.ok(Object.isFrozen(p.presenceRefs));
  assert.ok(Object.isFrozen(p.assistantProfile));
});
