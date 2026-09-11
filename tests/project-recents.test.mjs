import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectRecord,createRecentEntry} from '../src/workspace/project-recents.mjs';

test('project stores experience metadata plus canonical refs only',()=>{
  const p=createProjectRecord({
    id:'project:relay',tenantId:'tenant:acme',name:'Relay',
    refs:[{owner:'runtime',type:'InteractionThread',id:'th_1',ref:'runtime:thread:th_1'}],
  });
  assert.equal(p.owner,'studio');
  assert.equal(p.refs[0].owner,'runtime');
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.refs));
  assert.ok(Object.isFrozen(p.refs[0]));
});

test('project rejects embedded canonical payload truth',()=>{
  assert.throws(()=>createProjectRecord({
    id:'p',tenantId:'tenant:acme',name:'x',refs:[],runtime:{status:'running'},
  }),/unsupported|embedded/i);
});

test('project rejects cross-tenant refs and caller mutation cannot alter refs',()=>{
  assert.throws(()=>createProjectRecord({
    id:'p',tenantId:'tenant:acme',name:'x',
    refs:[{owner:'runtime',type:'InteractionThread',id:'th_1',ref:'runtime:thread:th_1',tenantId:'tenant:globex'}],
  }),/tenant/i);
  const refs=[{owner:'runtime',type:'InteractionThread',id:'th_1',ref:'runtime:thread:th_1'}];
  const p=createProjectRecord({id:'p2',tenantId:'tenant:acme',name:'y',refs});
  refs[0].ref='runtime:thread:changed';
  assert.equal(p.refs[0].ref,'runtime:thread:th_1');
});

test('recent stores a target reference and rejects embedded truth',()=>{
  const r=createRecentEntry({
    id:'recent:1',tenantId:'tenant:acme',label:'Relay work',kind:'thread',
    targetRef:{owner:'runtime',type:'InteractionThread',id:'th_1',ref:'runtime:thread:th_1'},
    projectId:'project:relay',
  });
  assert.equal(r.owner,'studio');
  assert.equal(r.targetRef.owner,'runtime');
  assert.ok(Object.isFrozen(r.targetRef));
  assert.throws(()=>createRecentEntry({
    id:'recent:2',tenantId:'tenant:acme',label:'bad',kind:'thread',targetRef:r.targetRef,
    authority:{grant:'x'},
  }),/unsupported|embedded/i);
});

test('experience records reject canonical truth payload fields',()=>{
  const forbidden=['authority','execution','verification','thread','turns'];
  for(const key of forbidden){
    assert.throws(()=>createProjectRecord({id:'p',tenantId:'tenant:acme',name:'x',refs:[],[key]:{}}),/unsupported|embedded/i);
    assert.throws(()=>createRecentEntry({id:'r',tenantId:'tenant:acme',label:'x',kind:'thread',targetRef:{owner:'runtime',type:'InteractionThread',id:'th',ref:'runtime:thread:th'},[key]:{}}),/unsupported|embedded/i);
  }
});
