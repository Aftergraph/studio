const text=value=>typeof value==='string'?value.trim():'';

export function buildTrustProposalFromActionIntent({conversationId,actor,contextRefs=[],actionIntent}={}){
  if(!actionIntent||typeof actionIntent!=='object')throw new Error('action_intent_required');
  if(actionIntent.authorityGranted!==false)throw new Error('action_intent_must_be_non_authoritative');
  if(actionIntent.status!=='proposed')throw new Error('action_intent_requires_proposed_status');
  const capability=text(actionIntent.semanticCapability);
  if(!capability)throw new Error('semantic_capability_required');
  const subject=text(actionIntent.subjectRef)||'business-subject';
  const tenant=text(actionIntent.tenantId)||'tenant:unknown';
  const objective=`Review ${capability} for ${subject}`;
  return {
    channel:'chat',
    objective,
    approval_requested:true,
    context:{
      source:'studio-conversation',conversation_id:text(conversationId),actor:text(actor),
      context_refs:Array.isArray(contextRefs)?contextRefs.filter(x=>typeof x==='string').slice(0,16):[],
      action_intent:{...actionIntent,authorityGranted:false,status:'proposed'},
    },
    proposed_mission:{
      objective,
      success_criteria:[
        `Execute ${capability} only under admitted authority for ${tenant}.`,
        'Capture provider receipt and read-back before completion.',
        'Do not claim verified outcome without evidence.',
      ],
    },
    reasoning:'A non-authoritative Business Ops ActionIntent requires governed human review before execution.',
    alternatives_considered:['No action; keep proposal pending for operator decision.'],
  };
}
