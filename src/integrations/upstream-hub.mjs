import { createTrustGatewayAdapter } from './trust-gateway.mjs';
import { createWorksAdapter } from './works.mjs';
import { createAieAdapter } from './aie.mjs';
import { createWorkIntelligenceAdapter } from './work-intelligence.mjs';
import { createGovernanceAdapter } from './governance.mjs';

export const UPSTREAM_REVISIONS=Object.freeze({
  trustGateway:Object.freeze({repo:'Aftergraph/trust-gateway',branch:'main',sha:'515f8f744ff9b0a14df7398e38693fd3ac7ab667',role:'runtime-enforcement'}),
  works:Object.freeze({repo:'Aftergraph/works-execution',branch:'main',sha:'3ea1a80494c38f3e422339db6efbf5a7935a48be',role:'durable-execution'}),
  aie:Object.freeze({repo:'Aftergraph/aie',branch:'main',sha:'3432834afd80e60009f1252a1801f21feb551b9b',role:'normative-authority'}),
  workIntelligence:Object.freeze({repo:'Aftergraph/work-intelligence-v2',branch:'main',sha:'f5cd61ef02b858bcc31f2bb25a0bb792a3b46eeb',role:'detection/observation/proposal-only'}),
  governance:Object.freeze({repo:'Aftergraph/after-graph-governance',branch:'main',sha:'40226ebd03ef4c6f081229cce393b231009f0e18',role:'canonical-contracts'}),
  research:Object.freeze({repo:'Aftergraph/intelligence-systems-research',branch:'main',sha:'d67354385ea94f45e2dad7e8362621a9dee31b2f',role:'research'}),
});

function configured(config){return Boolean(config?.baseUrl)}
function serviceMeta(key,config){return {configured:configured(config),online:false,repo:UPSTREAM_REVISIONS[key].repo,branch:UPSTREAM_REVISIONS[key].branch,headSha:UPSTREAM_REVISIONS[key].sha,role:UPSTREAM_REVISIONS[key].role}}
function errorCode(error){return String(error?.code||error?.message||'upstream_error').slice(0,160)}

async function safeCall(fn){try{return {ok:true,value:await fn()}}catch(error){return {ok:false,error:errorCode(error)}}}

export function createUpstreamHub(config={}, {fetchImpl=globalThis.fetch}={}){
  const tg=configured(config.trustGateway)?createTrustGatewayAdapter({...config.trustGateway,fetchImpl}):null;
  const works=configured(config.works)?createWorksAdapter({...config.works,fetchImpl}):null;
  const aie=configured(config.aie)?createAieAdapter({...config.aie,fetchImpl}):null;
  const wi=configured(config.workIntelligence)?createWorkIntelligenceAdapter({...config.workIntelligence,fetchImpl}):null;
  const governance=createGovernanceAdapter();

  async function status(){
    const result={
      trustGateway:serviceMeta('trustGateway',config.trustGateway),
      works:serviceMeta('works',config.works),
      aie:serviceMeta('aie',config.aie),
      workIntelligence:serviceMeta('workIntelligence',config.workIntelligence),
      governance:{configured:true,online:true,mode:'contract-snapshot',...UPSTREAM_REVISIONS.governance},
      research:{configured:true,online:true,mode:'research-reference',...UPSTREAM_REVISIONS.research},
    };
    const probes=await Promise.all([
      tg?safeCall(()=>tg.health()):Promise.resolve(null),
      works?safeCall(()=>works.health()):Promise.resolve(null),
      aie?safeCall(()=>aie.tasks()):Promise.resolve(null),
      wi?safeCall(()=>wi.health()):Promise.resolve(null),
    ]);
    for(const [key,probe] of [['trustGateway',probes[0]],['works',probes[1]],['aie',probes[2]],['workIntelligence',probes[3]]]){
      if(!probe) continue;
      result[key].online=probe.ok;
      if(!probe.ok) result[key].error=probe.error;
    }
    return result;
  }

  async function sync(){
    const services=await status();
    const output={
      syncedAt:new Date().toISOString(),services,
      trustGateway:{identity:null,approvals:[],needsYou:[],audit:null},
      works:{works:[],brain:[]},
      aie:{tasks:[]},
      workIntelligence:{workItems:[]},
      governance:{missionStates:governance.missionStates},
    };
    const tasks=[];
    if(tg&&services.trustGateway.online){
      tasks.push((async()=>{
        const [identity,approvals,needsYou,audit]=await Promise.all([safeCall(()=>tg.identity()),safeCall(()=>tg.approvals()),safeCall(()=>tg.needsYou()),safeCall(()=>tg.verifyAudit())]);
        output.trustGateway.identity=identity.ok?identity.value:null;
        output.trustGateway.approvals=approvals.ok?(approvals.value.approvals||approvals.value.items||[]):[];
        output.trustGateway.needsYou=needsYou.ok?(needsYou.value.items||[]):[];
        output.trustGateway.audit=audit.ok?audit.value:{ok:false,error:audit.error};
      })());
    }
    if(works&&services.works.online){
      tasks.push((async()=>{
        const listed=await safeCall(()=>works.listWorks());
        output.works.works=listed.ok?(listed.value.works||listed.value.items||[]):[];
        if(config.works?.brainPrefix){const brain=await safeCall(()=>works.brainPrefix(config.works.brainPrefix));output.works.brain=brain.ok?(brain.value.objects||brain.value.items||[]):[];}
      })());
    }
    if(aie&&services.aie.online){tasks.push((async()=>{const listed=await safeCall(()=>aie.tasks());output.aie.tasks=listed.ok?(listed.value.tasks||listed.value.items||[]):[]})())}
    if(wi&&services.workIntelligence.online){tasks.push((async()=>{const listed=await safeCall(()=>wi.workItems());output.workIntelligence.workItems=listed.ok?(listed.value.items||listed.value.work_items||[]):[]})())}
    await Promise.all(tasks);
    return output;
  }

  function requireAdapter(adapter,name){if(!adapter) throw new Error(`${name} upstream is not configured`);return adapter}

  return Object.freeze({
    revisions:UPSTREAM_REVISIONS,
    governance,
    status,
    sync,
    decideTrustGatewayApproval:(id,decision)=>requireAdapter(tg,'trust-gateway').decideApproval(id,decision),
    async controlWork(id,action,body={}){
      const adapter=requireAdapter(works,'works-execution');
      if(action==='suspend') return adapter.suspend(id,body);
      if(action==='resume') return adapter.resume(id,body);
      if(action==='cancel') return adapter.cancel(id,body);
      throw new Error('unsupported WORKS control action');
    },
    cancelAieTask:id=>requireAdapter(aie,'aie').cancelTask(id),
    sendAieMessage:body=>requireAdapter(aie,'aie').sendMessage(body),
    reviewWorkIntelligence:(id,{decision,actor}={})=>requireAdapter(wi,'work-intelligence').review(id,{decision,actor}),
    async promoteWorkIntelligence(id,{actor,confirmed=false}={}){
      if(!confirmed||!actor) throw new Error('promotion requires explicit human actor and confirmation');
      return requireAdapter(wi,'work-intelligence').promote(id,{actor});
    },
  });
}
