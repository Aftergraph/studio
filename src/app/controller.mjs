export async function runControllerAction(action,fn,{onError=()=>{},diagnostics=()=>{}}={}){
  try{return {ok:true,value:await fn()}}
  catch(error){
    const normalized=error instanceof Error?error:new Error(String(error));
    const event={type:'controller.error',action:String(action||'unknown'),message:normalized.message,ts:new Date().toISOString()};
    try{diagnostics(event)}catch{}
    try{onError(normalized,event)}catch{}
    return {ok:false,error:normalized};
  }
}

export function createController(deps={}){
  const {getState=()=>({}),setState=()=>{},api=null,diagnostics=()=>{},onError=()=>{}}=deps;
  const remote=(name,operation,apply)=>runControllerAction(name,async()=>{const payload=await operation();if(apply)apply(payload);return payload},{diagnostics,onError});
  return Object.freeze({
    navigate(nextState){setState(nextState);return {ok:true,value:nextState}},
    decideApproval(id,decision,actor='demo-user'){
      if(!api?.decideApproval)return Promise.resolve({ok:false,error:new Error('backend_unavailable')});
      return remote('approval.decide',()=>api.decideApproval(id,decision,actor),payload=>payload?.state&&setState(payload.state));
    },
    resolveNeed(id){
      if(!api?.resolveNeed)return Promise.resolve({ok:false,error:new Error('backend_unavailable')});
      return remote('need.resolve',()=>api.resolveNeed(id),payload=>payload?.state&&setState(payload.state));
    },
    syncUpstreams(){
      if(!api?.syncUpstreams)return Promise.resolve({ok:false,error:new Error('backend_unavailable')});
      return remote('upstreams.sync',()=>api.syncUpstreams(),payload=>payload?.state&&setState(payload.state));
    },
    state:getState,
  });
}
