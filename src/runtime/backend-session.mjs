export const DEFAULT_RESYNC_POLICY=Object.freeze({
  timeoutMs:8000,
  latencyBudgetMs:2000,
  maxPayloadBytes:1024*1024,
});

const byteLength=value=>new TextEncoder().encode(JSON.stringify(value??null)).byteLength;
const timeoutError=()=>{const error=new Error('state_resync_timeout');error.code='state_resync_timeout';return error};

function withTimeout(promise,timeoutMs){
  let timer;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError()),timeoutMs)}),
  ]).finally(()=>clearTimeout(timer));
}

export function createBackendSession({
  api,onState=()=>{},onStatus=()=>{},onRuntime=()=>{},onError=()=>{},onMetric=()=>{},
  resyncPolicy=DEFAULT_RESYNC_POLICY,now=()=>globalThis.performance?.now?.()??Date.now(),validatePayload=value=>value,
}={}){
  if(!api)throw new Error('api required');
  const policy={...DEFAULT_RESYNC_POLICY,...resyncPolicy};
  let phase='offline',unsubscribe=()=>{},generation=0,started=false;
  const setPhase=value=>{phase=value;onStatus(value)};
  const fetchAuthoritative=async()=>{
    if(typeof api.stateWithMeta==='function')return api.stateWithMeta();
    const payload=await api.state();return {payload,bytes:byteLength(payload)};
  };
  const resync=async()=>{
    const token=++generation;setPhase('resyncing');const startedAt=now();
    try{
      const result=await withTimeout(Promise.resolve().then(fetchAuthoritative),policy.timeoutMs);
      const latencyMs=Math.max(0,now()-startedAt);
      const payload=result?.payload??result;
      const payloadBytes=Number.isFinite(result?.bytes)?result.bytes:byteLength(payload);
      onMetric({name:'state-resync',payloadBytes,latencyMs,latencyBudgetMs:policy.latencyBudgetMs,latencyBudgetExceeded:latencyMs>policy.latencyBudgetMs,maxPayloadBytes:policy.maxPayloadBytes});
      if(payloadBytes>policy.maxPayloadBytes){const error=new Error('state_payload_too_large');error.code='state_payload_too_large';throw error}
      validatePayload(payload);
      if(token!==generation||!started)return false;
      onState(payload);if(payload?.runtimes)onRuntime(payload.runtimes);setPhase('current');return true;
    }catch(error){
      if(token===generation&&started){
        const degraded=error?.code==='state_resync_timeout'||error?.code==='state_payload_too_large';
        setPhase(degraded?'degraded':'stale');onError(error);
      }
      return false;
    }
  };
  const handleMessage=payload=>{
    if(phase!=='current')return;
    onState(payload);if(payload?.runtimes)onRuntime(payload.runtimes);
  };
  const handleError=error=>{if(!started)return;setPhase('stale');onError(error)};
  return Object.freeze({
    start(){if(started)return;started=true;unsubscribe=api.subscribe(handleMessage,handleError,{onOpen:resync})||(()=>{})},
    stop(){started=false;generation++;try{unsubscribe()}catch{};unsubscribe=()=>{};setPhase('offline')},
    status(){return phase},
    resync,
    policy:Object.freeze({...policy}),
  });
}
