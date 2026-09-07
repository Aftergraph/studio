import { apiAgents, apiAieMessages, apiAieTaskCancel, apiApprovalDecision, apiArtifact, apiArtifacts, apiAuthoritativeMemory, apiAutonomyKillEngage, apiAutonomyKillRead, apiAutonomyKillRelease, apiConnections, apiContext, apiConversationMessages, apiConversations, apiEvents, apiHealthz, apiMemory, apiMemoryPromote, apiMissionControl, apiMissionRuntime, apiMissions, apiNeed, apiNeeds, apiReplay, apiReset, apiSpace, apiSpaces, apiState, apiSyncEventsRead, apiSyncEventsSubmit, apiSystem, apiAuthMagicLink, apiAuthMe, apiUser, apiUserCapabilities, apiUsers, apiUpstreamApprovalDecision, apiUpstreamWorkControl, apiUpstreams, apiUpstreamsSync, apiWorkIntelligencePromote, apiWorkIntelligenceReview } from './api-routes.mjs';

function normalizeBase(baseUrl='') {
  if (!baseUrl) return '';
  return String(baseUrl).replace(/\/$/,'');
}


async function readBodyWithMeta(response) {
  const type=response.headers.get('content-type')||'';
  const text=await response.text();
  const bytes=new TextEncoder().encode(text).byteLength;
  let body={};
  if(text){
    if(type.includes('application/json')) body=JSON.parse(text);
    else body={message:text};
  }
  return {body,bytes};
}

async function readBody(response) {
  const type=response.headers.get('content-type')||'';
  if (type.includes('application/json')) return response.json();
  const text=await response.text();
  return text?{message:text}:{};
}

export function createApiClient({ baseUrl='', fetchImpl=globalThis.fetch, EventSourceImpl=globalThis.EventSource }={}) {
  const base=normalizeBase(baseUrl);
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation required');

  const request=async(path,options={})=>{
    const headers={...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})};
    let response;
    try { response=await fetchImpl(`${base}${path}`,{...options,headers}); }
    catch (cause) {
      const error=new Error('backend_unavailable');error.code='backend_unavailable';error.cause=cause;throw error;
    }
    const body=await readBody(response);
    if(!response.ok){const error=new Error(body?.error||`http_${response.status}`);error.code=body?.error||`http_${response.status}`;error.status=response.status;throw error}
    return body;
  };

  const requestWithMeta=async(path,options={})=>{
    const headers={...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})};
    let response;
    try { response=await fetchImpl(`${base}${path}`,{...options,headers}); }
    catch (cause) { const error=new Error('backend_unavailable');error.code='backend_unavailable';error.cause=cause;throw error; }
    const {body,bytes}=await readBodyWithMeta(response);
    if(!response.ok){const error=new Error(body?.error||`http_${response.status}`);error.code=body?.error||`http_${response.status}`;error.status=response.status;throw error}
    return {payload:body,bytes};
  };

  return Object.freeze({
    async detect(){try{const body=await request(apiHealthz());return body?.status==='ok'}catch{return false}},
    state(){return request(apiState())},
    stateWithMeta(){return requestWithMeta(apiState())},
    needs(){return request(apiNeeds())},
    missions(){return request(apiMissions())},
    agents(){return request(apiAgents())},
    artifacts(){return request(apiArtifacts())},
    connections(){return request(apiConnections())},
    spaces(){return request(apiSpaces())},
    system(){return request(apiSystem())},
    upstreams(){return request(apiUpstreams())},
    syncUpstreams(){return request(apiUpstreamsSync(),{method:'POST'})},
    decideUpstreamApproval(id,decision){return request(apiUpstreamApprovalDecision(id),{method:'POST',body:JSON.stringify({decision})})},
    controlUpstreamWork(id,action,payload={}){return request(apiUpstreamWorkControl(id),{method:'POST',body:JSON.stringify({action,payload})})},
    reviewWorkIntelligence(id,{actor,decision}={}){return request(apiWorkIntelligenceReview(id),{method:'POST',body:JSON.stringify({actor,decision})})},
    promoteWorkIntelligence(id,{actor,confirmed=false}={}){return request(apiWorkIntelligencePromote(id),{method:'POST',body:JSON.stringify({actor,confirmed})})},
    cancelAieTask(id){return request(apiAieTaskCancel(id),{method:'POST',body:'{}'})},
    sendAieMessage(body){return request(apiAieMessages(),{method:'POST',body:JSON.stringify(body)})},
    createConversation({id,title='New conversation'}={}){return request(apiConversations(),{method:'POST',body:JSON.stringify({id,title})})},
    resolveNeed(id){return request(apiNeed(id),{method:'DELETE'})},
    context(conversationId){return request(apiContext(conversationId))},
    artifact(id){return request(apiArtifact(id))},
    sendMessage(id,{text,mode='Ask',actor='demo-user',reply=null,attachments=[]}={}){return request(apiConversationMessages(id),{method:'POST',body:JSON.stringify({text,mode,actor,reply,attachments})})},
    decideApproval(id,decision,actor='demo-user',idempotencyKey=`approval-${id}-${Date.now()}`){return request(apiApprovalDecision(id),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({decision,actor,idempotencyKey})})},
    setControl(id,mode,actor='demo-user',idempotencyKey=`control-${id}-${mode}-${Date.now()}`){return request(apiMissionControl(id),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({mode,actor,idempotencyKey})})},
    runtime(id,action){return request(apiMissionRuntime(id),{method:'POST',body:JSON.stringify({action})})},
    deleteMemory(id,actor='demo-user',idempotencyKey=`memory-${id}-${Date.now()}`){return request(apiMemory(id),{method:'DELETE',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,idempotencyKey})})},
    addMemory({scope,label,value,source,confidence=0,retentionMs=null,actor='demo-user',idempotencyKey=`memory-new-${Date.now()}`}={}){return request(apiMemory(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,label,value,source,confidence,retentionMs,idempotencyKey})})},
    promoteMemory(id,{actor='demo-user',evidence,override=false,idempotencyKey=`memory-promote-${id}-${Date.now()}`}={}){return request(apiMemoryPromote(id),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,evidence,override,idempotencyKey})})},
    authoritativeMemory(){return request(apiAuthoritativeMemory())},
    updateSpace(id,action){return request(apiSpace(id),{method:'PATCH',body:JSON.stringify({action})})},
    replay({cursor,playing,speed}={}){return request(apiReplay(),{method:'PATCH',body:JSON.stringify({cursor,playing,speed})})},
    reset(actor='demo-user',confirmationToken='RESET_WORKSPACE',idempotencyKey=`reset-${Date.now()}`){return request(apiReset(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,confirmationToken,idempotencyKey})})},
    readKill(scope){return request(apiAutonomyKillRead(scope))},
    createUser({id,name,role,capabilities,actor='demo-user',idempotencyKey=`user-${id}-${Date.now()}`}={}){return request(apiUsers(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,id,name,role,capabilities,idempotencyKey})})},
    readUser(id){return request(apiUser(id))},
    grantCapabilities(id,{actor='demo-user',capabilities,idempotencyKey=`user-grant-${id}-${Date.now()}`}={}){return request(apiUserCapabilities(id),{method:'PATCH',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,capabilities,idempotencyKey})})},
    issueMagicToken({userId,actor='demo-user',idempotencyKey=`magic-${userId}-${Date.now()}`}={}){return request(apiAuthMagicLink(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,userId})})},
    authMe({token}={}){return request(apiAuthMe(),{headers:token?{authorization:`Bearer ${token}`}:undefined})},
    engageKill(scope,{actor='demo-user',reason,idempotencyKey=`kill-${scope}-${Date.now()}`}={}){return request(apiAutonomyKillEngage(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,reason,idempotencyKey})})},
    releaseKill(scope,{actor='demo-user',idempotencyKey=`kill-release-${scope}-${Date.now()}`}={}){return request(apiAutonomyKillRelease(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,idempotencyKey})})},
    submitSync({nodeId,events,actor='demo-user',idempotencyKey=`sync-${nodeId}-${Date.now()}`}={}){return request(apiSyncEventsSubmit(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,nodeId,events,idempotencyKey})})},
    readSync(){return request(apiSyncEventsRead())},
    subscribe(onMessage,onError=()=>{},{onOpen=()=>{}}={}){
      if(typeof EventSourceImpl!=='function') return ()=>{};
      const source=new EventSourceImpl(`${base}${apiEvents()}`);
      const handler=event=>{try{onMessage(JSON.parse(event.data))}catch(error){onError(error)}};
      source.addEventListener?.('workspace',handler);
      source.onopen=()=>onOpen();
      source.onerror=onError;
      return ()=>{source.removeEventListener?.('workspace',handler);source.close?.()};
    },
  });
}
