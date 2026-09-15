const fallbackReply=()=>({
  author:'Rendetalje Ops',
  type:'agent_run',
  text:'Rendetalje Ops er midlertidigt utilgængelig. Jeg har ikke udført eller godkendt nogen handling.',
  confidence:'unknown',
  contextRefs:[],
});

const compact=(value,keys)=>{
  if(!value||typeof value!=='object')return null;
  const out={};
  for(const key of keys){
    const item=value[key];
    if(typeof item==='string'||typeof item==='number'||typeof item==='boolean')out[key]=item;
  }
  return Object.keys(out).length?out:null;
};

function boundedContext(context={}){
  const conversation=compact(context.conversation,['id','title','missionId','status']);
  const mission=compact(context.mission,['id','title','objective','state','progress']);
  return {
    ...(conversation?{conversation}:{}),
    ...(mission?{mission}:{}),
  };
}
export function createRendetaljeOpsConversationAgent({baseUrl,token,fetchImpl=fetch,timeoutMs=5000}={}){
  if(!baseUrl||!token)throw new Error('rendetalje_ops_config_required');
  return async input=>{
    const payload={
      conversationId:input.conversationId,
      text:input.text,
      mode:input.mode,
      actor:input.actor,
      attachments:Array.isArray(input.attachments)?input.attachments:[],
      context:boundedContext(input.context),
    };
    try{
      const response=await fetchImpl(new URL('/v1/respond',baseUrl),{
        method:'POST',
        headers:{'content-type':'application/json',accept:'application/json',authorization:`Bearer ${token}`},
        body:JSON.stringify(payload),
        signal:AbortSignal.timeout(timeoutMs),
      });
      if(!response.ok)return fallbackReply();
      const body=await response.json();
      if(!body||typeof body!=='object'||typeof body.text!=='string'||!body.text.trim())return fallbackReply();
      return body;
    }catch{return fallbackReply()}
  };
}
export function rendetaljeOpsConversationAgentFromEnv(env=process.env,fetchImpl=fetch){
  const baseUrl=String(env.AFTERGRAPH_RENDETALJE_OPS_URL||'').trim();
  const token=String(env.AFTERGRAPH_RENDETALJE_OPS_TOKEN||'').trim();
  if(!baseUrl&&!token)return null;
  if(!baseUrl||!token)throw new Error('rendetalje_ops_config_incomplete');
  return createRendetaljeOpsConversationAgent({baseUrl,token,fetchImpl});
}
