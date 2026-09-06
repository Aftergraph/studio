import test from 'node:test';
import assert from 'node:assert/strict';
import { AGUpstreamServiceRow, AGExternalWorkRow, AGDetectionProposalRow, AGSourceTruthBadge, COMPONENTS } from '../packages/ui/index.mjs';

test('inhouse UI includes source-truth primitives for polyrepo runtime',()=>{
  assert.ok(COMPONENTS.includes('AGUpstreamServiceRow'));
  assert.ok(COMPONENTS.includes('AGExternalWorkRow'));
  assert.ok(COMPONENTS.includes('AGDetectionProposalRow'));
  assert.ok(COMPONENTS.includes('AGSourceTruthBadge'));
});

test('upstream service row exposes runtime state and exact-head provenance without credentials',()=>{
  const html=AGUpstreamServiceRow({id:'works',label:'WORKS',service:{configured:true,online:true,headSha:'3ea1a80494c38f3e422339db6efbf5a7935a48be',role:'durable-execution'}});
  assert.match(html,/data-upstream="works"/);
  assert.match(html,/online/);
  assert.match(html,/3ea1a804/);
  assert.match(html,/durable-execution/);
});

test('external work and WI proposal visually preserve execution authority boundary',()=>{
  const work=AGExternalWorkRow({work:{id:'wrk_1',state:'RUNNING',objective:'Ship release'}});
  const proposal=AGDetectionProposalRow({item:{id:'wi_1',status:'APPROVED',source:'github',title:'Investigate issue'}});
  assert.match(work,/Execution authority/);
  assert.match(proposal,/Proposal only/);
  assert.match(proposal,/Explicit promotion required/);
});

test('source truth badge identifies canonical owner rather than pretending V5 owns upstream semantics',()=>{
  const html=AGSourceTruthBadge({owner:'Trust Gateway',contract:'approval.decide',sha:'515f8f744ff9b0a14df7398e38693fd3ac7ab667'});
  assert.match(html,/Trust Gateway/);
  assert.match(html,/approval\.decide/);
  assert.match(html,/515f8f74/);
});
