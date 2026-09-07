import * as R from './api-routes.mjs';

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
    async detect(){try{const body=await request(R.healthz());return body?.status==='ok'}catch{return false}},
    state(){return request(R.state())},
    stateWithMeta(){return requestWithMeta(R.state())},
    needs(){return request(R.needs())},
    missions(){return request(R.missions())},
    agents(){return request(R.agents())},
    artifacts(){return request(R.artifacts())},
    connections(){return request(R.connections())},
    spaces(){return request(R.spaces())},
    system(){return request(R.system())},
    upstreams(){return request(R.upstreams())},
    syncUpstreams(){return request(R.upstreamsSync(),{method:'POST'})},
    decideUpstreamApproval(id,decision){return request(R.upstreamApprovalDecision(id),{method:'POST',body:JSON.stringify({decision})})},
    controlUpstreamWork(id,action,payload={}){return request(R.upstreamWorkControl(id),{method:'POST',body:JSON.stringify({action,payload})})},
    reviewWorkIntelligence(id,{actor,decision}={}){return request(R.workIntelligenceReview(id),{method:'POST',body:JSON.stringify({actor,decision})})},
    promoteWorkIntelligence(id,{actor,confirmed=false}={}){return request(R.workIntelligencePromote(id),{method:'POST',body:JSON.stringify({actor,confirmed})})},
    cancelAieTask(id){return request(R.aieTaskCancel(id),{method:'POST',body:'{}'})},
    sendAieMessage(body){return request(R.aieMessages(),{method:'POST',body:JSON.stringify(body)})},
    createConversation({id,title='New conversation'}={}){return request(R.conversations(),{method:'POST',body:JSON.stringify({id,title})})},
    resolveNeed(id){return request(R.need(id),{method:'DELETE'})},
    context(conversationId){return request(R.context(conversationId))},
    artifact(id){return request(R.artifact(id))},
    sendMessage(id,{text,mode='Ask',actor='demo-user',reply=null,attachments=[]}={}){return request(R.conversationMessages(id),{method:'POST',body:JSON.stringify({text,mode,actor,reply,attachments})})},
    decideApproval(id,decision,actor='demo-user',idempotencyKey=`approval-${id}-${Date.now()}`){return request(R.approvalDecision(id),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({decision,actor,idempotencyKey})})},
    setControl(id,mode,actor='demo-user',idempotencyKey=`control-${id}-${mode}-${Date.now()}`){return request(R.missionControl(id),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({mode,actor,idempotencyKey})})},
    runtime(id,action){return request(R.missionRuntime(id),{method:'POST',body:JSON.stringify({action})})},
    deleteMemory(id,actor='demo-user',idempotencyKey=`memory-${id}-${Date.now()}`){return request(R.memory(id),{method:'DELETE',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,idempotencyKey})})},
    addMemory({scope,label,value,source,confidence=0,retentionMs=null,actor='demo-user',idempotencyKey=`memory-new-${Date.now()}`}={}){return request(R.memory(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,label,value,source,confidence,retentionMs,idempotencyKey})})},
    promoteMemory(id,{actor='demo-user',evidence,override=false,idempotencyKey=`memory-promote-${id}-${Date.now()}`}={}){return request(R.memoryPromote(id),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,evidence,override,idempotencyKey})})},
    authoritativeMemory(){return request(R.authoritativeMemory())},
    updateSpace(id,action){return request(R.space(id),{method:'PATCH',body:JSON.stringify({action})})},
    replay({cursor,playing,speed}={}){return request(R.replay(),{method:'PATCH',body:JSON.stringify({cursor,playing,speed})})},
    reset(actor='demo-user',confirmationToken='RESET_WORKSPACE',idempotencyKey=`reset-${Date.now()}`){return request(R.reset(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,confirmationToken,idempotencyKey})})},
    readKill(scope){return request(R.autonomyKillRead(scope))},
    engageKill(scope,{actor='demo-user',reason,idempotencyKey=`kill-${scope}-${Date.now()}`}={}){return request(R.autonomyKillEngage(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,reason,idempotencyKey})})},
    releaseKill(scope,{actor='demo-user',idempotencyKey=`kill-release-${scope}-${Date.now()}`}={}){return request(R.autonomyKillRelease(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,idempotencyKey})})},
    submitSync({nodeId,events,actor='demo-user',idempotencyKey=`sync-${nodeId}-${Date.now()}`}={}){return request(R.syncEventsSubmit(),{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,nodeId,events,idempotencyKey})})},
    readSync(){return request(R.syncEventsRead())},
    subscribe(onMessage,onError=()=>{},{onOpen=()=>{}}={}){
      if(typeof EventSourceImpl!=='function') return ()=>{};
      const source=new EventSourceImpl(`${base}${R.events()}`);
      const handler=event=>{try{onMessage(JSON.parse(event.data))}catch(error){onError(error)}};
      source.addEventListener?.('workspace',handler);
      source.onopen=()=>onOpen();
      source.onerror=onError;
      return ()=>{source.removeEventListener?.('workspace',handler);source.close?.()};
    },
  });
}
