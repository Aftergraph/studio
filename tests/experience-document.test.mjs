import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperienceDocument } from '../src/persistence/experience-document.mjs';

function project(tenantId='tenant:acme') {
  return {id:'project:relay',tenantId,name:'Relay',refs:[{owner:'runtime',type:'InteractionThread',id:'th1',ref:'runtime:thread:th1',tenantId}]};
}
function recent(tenantId='tenant:acme') {
  return {id:'recent:relay',tenantId,label:'Relay work',kind:'thread',targetRef:{owner:'runtime',type:'InteractionThread',id:'th1',ref:'runtime:thread:th1',tenantId}};
}

test('experience document stores Studio-owned state and canonical refs only',()=>{
  const doc=createExperienceDocument({tenantId:'tenant:acme',projects:[project()],recents:[recent()],layout:{mode:'chat'},preferences:{density:'calm'}});
  assert.equal(doc.schema,'aftergraph.studio-experience/1.0');
  assert.equal(doc.owner,'studio');
  assert.equal(doc.projects[0].refs[0].owner,'runtime');
  assert.ok(Object.isFrozen(doc));
  assert.ok(Object.isFrozen(doc.projects));
});

test('experience document rejects canonical truth fields at any depth',()=>{
  for(const [key,value] of [
    ['conversations',[]],['missions',[]],['approvals',[]],['agents',[]],['memory',[]],
    ['authority',{}],['execution',{}],['verification',{}],['threads',[]],['turns',[]],['credentials',{}],
  ]) assert.throws(()=>createExperienceDocument({tenantId:'tenant:acme',[key]:value}),/unsupported|canonical|forbidden/i,key);
  assert.throws(()=>createExperienceDocument({tenantId:'tenant:acme',preferences:{panel:{execution:{status:'running'}}}}),/execution|forbidden/i);
});

test('experience document rejects cross-tenant project and recent refs',()=>{
  assert.throws(()=>createExperienceDocument({tenantId:'tenant:acme',projects:[project('tenant:globex')]}),/tenant/i);
  assert.throws(()=>createExperienceDocument({tenantId:'tenant:acme',recents:[recent('tenant:globex')]}),/tenant/i);
});

test('experience document snapshots caller state immutably',()=>{
  const input={tenantId:'tenant:acme',projects:[project()],recents:[recent()],layout:{mode:'chat'},surfaces:[{id:'surface:1',kind:'conversation',presentation:{split:false}}]};
  const doc=createExperienceDocument(input);
  input.projects[0].name='mutated'; input.layout.mode='work'; input.surfaces[0].presentation.split=true;
  assert.equal(doc.projects[0].name,'Relay');
  assert.equal(doc.layout.mode,'chat');
  assert.equal(doc.surfaces[0].presentation.split,false);
  assert.ok(Object.isFrozen(doc.surfaces[0].presentation));
});
