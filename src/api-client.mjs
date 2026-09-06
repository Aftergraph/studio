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
    async detect(){try{const body=await request('/healthz');return body?.status==='ok'}catch{return false}},
    state(){return request('/api/v1/state')},
    stateWithMeta(){return requestWithMeta('/api/v1/state')},
    needs(){return request('/api/v1/needs')},
    missions(){return request('/api/v1/missions')},
    agents(){return request('/api/v1/agents')},
    artifacts(){return request('/api/v1/artifacts')},
    connections(){return request('/api/v1/connections')},
    spaces(){return request('/api/v1/spaces')},
    system(){return request('/api/v1/system')},
    upstreams(){return request('/api/v1/upstreams')},
    syncUpstreams(){return request('/api/v1/upstreams/sync',{method:'POST'})},
    decideUpstreamApproval(id,decision){return request(`/api/v1/upstreams/trust-gateway/approvals/${encodeURIComponent(id)}/decision`,{method:'POST',body:JSON.stringify({decision})})},
    controlUpstreamWork(id,action,payload={}){return request(`/api/v1/upstreams/works/${encodeURIComponent(id)}/control`,{method:'POST',body:JSON.stringify({action,payload})})},
    reviewWorkIntelligence(id,{actor,decision}={}){return request(`/api/v1/upstreams/work-intelligence/${encodeURIComponent(id)}/review`,{method:'POST',body:JSON.stringify({actor,decision})})},
    promoteWorkIntelligence(id,{actor,confirmed=false}={}){return request(`/api/v1/upstreams/work-intelligence/${encodeURIComponent(id)}/promote`,{method:'POST',body:JSON.stringify({actor,confirmed})})},
    cancelAieTask(id){return request(`/api/v1/upstreams/aie/tasks/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'})},
    sendAieMessage(body){return request('/api/v1/upstreams/aie/messages',{method:'POST',body:JSON.stringify(body)})},
    createConversation({id,title='New conversation'}={}){return request('/api/v1/conversations',{method:'POST',body:JSON.stringify({id,title})})},
    resolveNeed(id){return request(`/api/v1/needs/${encodeURIComponent(id)}`,{method:'DELETE'})},
    context(conversationId){return request(`/api/v1/context?conversationId=${encodeURIComponent(conversationId)}`)},
    artifact(id){return request(`/api/v1/artifacts/${encodeURIComponent(id)}`)},
    sendMessage(id,{text,mode='Ask',actor='demo-user',reply=null,attachments=[]}={}){return request(`/api/v1/conversations/${encodeURIComponent(id)}/messages`,{method:'POST',body:JSON.stringify({text,mode,actor,reply,attachments})})},
    decideApproval(id,decision,actor='demo-user',idempotencyKey=`approval-${id}-${Date.now()}`){return request(`/api/v1/approvals/${encodeURIComponent(id)}/decision`,{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({decision,actor,idempotencyKey})})},
    setControl(id,mode,actor='demo-user',idempotencyKey=`control-${id}-${mode}-${Date.now()}`){return request(`/api/v1/missions/${encodeURIComponent(id)}/control`,{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({mode,actor,idempotencyKey})})},
    runtime(id,action){return request(`/api/v1/missions/${encodeURIComponent(id)}/runtime`,{method:'POST',body:JSON.stringify({action})})},
    deleteMemory(id,actor='demo-user',idempotencyKey=`memory-${id}-${Date.now()}`){return request(`/api/v1/memory/${encodeURIComponent(id)}`,{method:'DELETE',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,idempotencyKey})})},
    addMemory({scope,label,value,source,confidence=0,retentionMs=null,actor='demo-user',idempotencyKey=`memory-new-${Date.now()}`}={}){return request('/api/v1/memory',{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,label,value,source,confidence,retentionMs,idempotencyKey})})},
    promoteMemory(id,{actor='demo-user',evidence,override=false,idempotencyKey=`memory-promote-${id}-${Date.now()}`}={}){return request(`/api/v1/memory/${encodeURIComponent(id)}/promote`,{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,evidence,override,idempotencyKey})})},
    authoritativeMemory(){return request('/api/v1/memory/authoritative')},
    updateSpace(id,action){return request(`/api/v1/spaces/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({action})})},
    replay({cursor,playing,speed}={}){return request('/api/v1/replay',{method:'PATCH',body:JSON.stringify({cursor,playing,speed})})},
    reset(actor='demo-user',confirmationToken='RESET_WORKSPACE',idempotencyKey=`reset-${Date.now()}`){return request('/api/v1/reset',{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,confirmationToken,idempotencyKey})})},
    readKill(scope){return request(`/api/v1/autonomy/kill?scope=${encodeURIComponent(scope)}`)},
    engageKill(scope,{actor='demo-user',reason,idempotencyKey=`kill-${scope}-${Date.now()}`}={}){return request('/api/v1/autonomy/kill',{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,reason,idempotencyKey})})},
    releaseKill(scope,{actor='demo-user',idempotencyKey=`kill-release-${scope}-${Date.now()}`}={}){return request('/api/v1/autonomy/kill/release',{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,scope,idempotencyKey})})},
    submitSync({nodeId,events,actor='demo-user',idempotencyKey=`sync-${nodeId}-${Date.now()}`}={}){return request('/api/v1/sync/events',{method:'POST',headers:{'idempotency-key':idempotencyKey},body:JSON.stringify({actor,nodeId,events,idempotencyKey})})},
    readSync(){return request('/api/v1/sync/events')},
    subscribe(onMessage,onError=()=>{},{onOpen=()=>{}}={}){
      if(typeof EventSourceImpl!=='function') return ()=>{};
      const source=new EventSourceImpl(`${base}/api/v1/events`);
      const handler=event=>{try{onMessage(JSON.parse(event.data))}catch(error){onError(error)}};
      source.addEventListener?.('workspace',handler);
      source.onopen=()=>onOpen();
      source.onerror=onError;
      return ()=>{source.removeEventListener?.('workspace',handler);source.close?.()};
    },
  });
}
