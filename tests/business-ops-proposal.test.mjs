import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrustProposalFromActionIntent } from '../server/business-ops-proposals.mjs';

test('ActionIntent becomes an approval-required Trust proposal, not authority',()=>{
  const body=buildTrustProposalFromActionIntent({
    conversationId:'conv_1', actor:'jonas', contextRefs:['legacy-renos:customer:c1'],
    actionIntent:{id:'ActionIntent:1',tenantId:'tenant:rendetalje',subjectRef:'legacy-renos:customer:c1',semanticCapability:'customer.communication.send',effectClass:'external_effect',riskClass:3,requiredAuthority:['customer.communication:send'],inputRef:'conversation:conv_1',expectedOutputRef:'provider-receipt:pending',verificationRequired:true,status:'proposed',authorityGranted:false},
  });
  assert.equal(body.channel,'chat');
  assert.equal(body.approval_requested,true);
  assert.equal(body.context.action_intent.authorityGranted,false);
  assert.equal(body.proposed_mission.success_criteria.length>=3,true);
});

test('proposal mapper rejects agent-claimed authority or non-proposed status',()=>{
  const base={id:'x',semanticCapability:'customer.communication.send',authorityGranted:false,status:'proposed'};
  assert.throws(()=>buildTrustProposalFromActionIntent({conversationId:'c',actor:'u',contextRefs:[],actionIntent:{...base,authorityGranted:true}}),/non_authoritative/);
  assert.throws(()=>buildTrustProposalFromActionIntent({conversationId:'c',actor:'u',contextRefs:[],actionIntent:{...base,status:'ready'}}),/proposed_status/);
});
