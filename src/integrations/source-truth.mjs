const POLICY_REQUIRED=Object.freeze(['token_id','work_id','org','scopes','purpose_bindings','budget_line','expiry']);

export function validateSourceTruthBundle({manifest={},missionState={},policyToken={},workIntelligenceBoundary={},revisions={}}={}){
  const errors=[];
  const manifestRepos=manifest?.repos||{};
  const manifestByFullName=new Map(Object.values(manifestRepos).map(entry=>[entry?.repo,entry]));
  const revisionEntries=Object.values(revisions||{});

  for(const revision of revisionEntries){
    const materialized=manifestByFullName.get(revision.repo);
    if(!materialized){errors.push(`${revision.repo}: missing materialized revision`);continue}
    if(materialized.head!==revision.sha) errors.push(`${materialized.repo}: head mismatch ${materialized.head||'missing'} != ${revision.sha}`);
    if(materialized.branch!==revision.branch) errors.push(`${materialized.repo}: branch mismatch`);
    if(materialized.role!==revision.role) errors.push(`${materialized.repo}: role mismatch`);
  }

  const missionStates=missionState?.properties?.state?.enum||[];
  if(missionStates.length!==12) errors.push(`mission-state: expected 12 canonical states, got ${missionStates.length}`);
  const machine=missionState?.mission_state_machine||{};
  for(const state of missionStates){if(!Object.prototype.hasOwnProperty.call(machine,state)) errors.push(`mission-state: ${state} missing transition definition`)}
  if(!Array.isArray(missionState?.mission_invariants)||!missionState.mission_invariants.some(value=>String(value).includes('VERIFIED requires evidence'))) errors.push('mission-state: evidence-gated VERIFIED invariant missing');

  const required=policyToken?.required||[];
  for(const field of POLICY_REQUIRED){if(!required.includes(field)) errors.push(`policy.token: required field ${field} missing`)}

  const authority=workIntelligenceBoundary?.properties?.work_intelligence_proposal?.properties?.authority_declaration?.properties||{};
  const executionAuthority=authority?.execution_authority?.const;
  const promotionRequired=authority?.promotion_required?.const;
  const humanReviewRequired=authority?.human_review_required?.const;
  if(executionAuthority!=='none') errors.push('work-intelligence-boundary: execution authority must be none');
  if(promotionRequired!==true) errors.push('work-intelligence-boundary: explicit promotion must be required');
  if(humanReviewRequired!==true) errors.push('work-intelligence-boundary: human review must be required');

  return Object.freeze({
    ok:errors.length===0,
    errors,
    repositories:revisionEntries.length,
    missionStates:missionStates.length,
    workIntelligenceExecutionAuthority:executionAuthority??null,
    workIntelligencePromotionRequired:promotionRequired===true,
    workIntelligenceHumanReviewRequired:humanReviewRequired===true,
  });
}
