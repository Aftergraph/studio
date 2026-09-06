import { validateIntegrationManifest } from './integration-manifest.mjs';
import { createTrustGatewayAdapter } from '../integrations/trust-gateway.mjs';
import { createWorksAdapter } from '../integrations/works.mjs';
import { createWorkIntelligenceAdapter } from '../integrations/work-intelligence.mjs';
import { createAieAdapter } from '../integrations/aie.mjs';
import { createGovernanceAdapter } from '../integrations/governance.mjs';
import { UPSTREAM_REVISIONS } from '../integrations/upstream-hub.mjs';

function manifest({id,repository,revision,roles,objects=[],relations=[],capabilities=[],surfaces=[],events=[],reads=[],writes=[],authority=[],evidence=[],health={kind:'contract'},degradedBehavior={reads:'stale',writes:'block'},compatibility={mode:'exact-or-declared',supported:['1.x']},serviceVersion}){
  return validateIntegrationManifest({schema:'aftergraph.integration/v1',id,repository,integrationVersion:'1.0.0',repositoryRevision:revision,serviceVersion,roles,objects,relations,capabilities,surfaces,events,reads,writes,authority,evidence,health,degradedBehavior,compatibility});
}
export function createCoreIntegrationManifests(){return Object.freeze({
  trustGateway:manifest({id:'trust-gateway',repository:UPSTREAM_REVISIONS.trustGateway.repo,revision:UPSTREAM_REVISIONS.trustGateway.sha,roles:['runtime-enforcement','control'],objects:['approval','action','audit'],capabilities:['approve','deny','action'],surfaces:['control','needs-you'],reads:['health','identity','approvals','audit'],writes:['approval.decide','action.execute'],authority:[{owner:'trust-gateway',operations:['approve','deny','execute-action']}],evidence:[{owner:'trust-gateway',class:'runtime-audit'}],health:{kind:'http',path:'/healthz'}}),
  works:manifest({id:'works',repository:UPSTREAM_REVISIONS.works.repo,revision:UPSTREAM_REVISIONS.works.sha,roles:['durable-execution'],objects:['work','mission','evidence','brain_object'],capabilities:['work.create','work.control','brain.read','brain.append'],surfaces:['work','brain'],reads:['works','events','evidence','brain'],writes:['work.create','work.suspend','work.resume','work.cancel','brain.append'],authority:[{owner:'works',operations:['create-work','suspend','resume','cancel','append-brain']}],evidence:[{owner:'works',class:'execution'}],health:{kind:'http',path:'/healthz'},serviceVersion:'0.3.5'}),
  workIntelligence:manifest({id:'work-intelligence',repository:UPSTREAM_REVISIONS.workIntelligence.repo,revision:UPSTREAM_REVISIONS.workIntelligence.sha,roles:['observation','proposal-only'],objects:['observation','work_item'],capabilities:['observe','review','promote-proposal'],surfaces:['connect','review-queue'],reads:['observations','work-items','evidence'],writes:['observation.ingest','review','promote'],authority:[{owner:'work-intelligence',operations:['observe','review','promote-proposal']}],evidence:[{owner:'work-intelligence',class:'proposal-provenance'}],health:{kind:'http',path:'/healthz'}}),
  aie:manifest({id:'aie',repository:UPSTREAM_REVISIONS.aie.repo,revision:UPSTREAM_REVISIONS.aie.sha,roles:['institutional-authority','delegation'],objects:['task','message','delegation'],capabilities:['message.send','task.cancel'],surfaces:['agents','authority'],reads:['tasks'],writes:['message.send','task.cancel'],authority:[{owner:'aie',operations:['delegate','send-message','cancel-task']}],evidence:[{owner:'aie',class:'conformance'}],health:{kind:'derived',path:'/tasks'}}),
  governance:manifest({id:'governance',repository:UPSTREAM_REVISIONS.governance.repo,revision:UPSTREAM_REVISIONS.governance.sha,roles:['canonical-contracts'],objects:['mission_state','policy_contract'],capabilities:['mission.transition.validate'],surfaces:['system'],reads:['contracts'],writes:[],authority:[{owner:'governance',operations:['validate-contract']}],evidence:[{owner:'governance',class:'contract-attestation'}],health:{kind:'local-contract'}}),
});}
function configured(c){return Boolean(c?.baseUrl)}
export function createManifestBackedCoreAdapters({config={},fetchImpl=globalThis.fetch}={}){const manifests=createCoreIntegrationManifests();const integrations={
  trustGateway:{manifest:manifests.trustGateway,adapter:configured(config.trustGateway)?createTrustGatewayAdapter({...config.trustGateway,fetchImpl}):null},
  works:{manifest:manifests.works,adapter:configured(config.works)?createWorksAdapter({...config.works,fetchImpl}):null},
  workIntelligence:{manifest:manifests.workIntelligence,adapter:configured(config.workIntelligence)?createWorkIntelligenceAdapter({...config.workIntelligence,fetchImpl}):null},
  aie:{manifest:manifests.aie,adapter:configured(config.aie)?createAieAdapter({...config.aie,fetchImpl}):null},
  governance:{manifest:manifests.governance,adapter:createGovernanceAdapter()},
};return Object.freeze({manifests,integrations:Object.freeze(integrations)});}
