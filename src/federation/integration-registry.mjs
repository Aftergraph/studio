const STATES=new Set(['current','stale','degraded','drifted','unavailable','incompatible']);
const READABLE=new Set(['current','stale','degraded','drifted']);
function snapshot(e){return Object.freeze({manifest:e.manifest,state:e.state,freshness:e.freshness,detail:e.detail==null?null:structuredClone(e.detail)})}
export function createIntegrationRegistry(){
  const entries=new Map();
  return Object.freeze({
    register(manifest){if(!manifest?.id)throw new TypeError('manifest.id required');if(entries.has(manifest.id))throw new Error(`integration ${manifest.id} already registered`);entries.set(manifest.id,{manifest,state:'stale',freshness:'stale',detail:null});return snapshot(entries.get(manifest.id))},
    setState(id,state,detail=null){if(!STATES.has(state))throw new TypeError(`invalid integration state ${state}`);const e=entries.get(id);if(!e)throw new Error(`unknown integration ${id}`);e.state=state;e.freshness=state==='current'?'current':state;e.detail=detail==null?null:structuredClone(detail);return snapshot(e)},
    get(id){const e=entries.get(id);return e?snapshot(e):null},
    list(){return [...entries.values()].map(snapshot)},
    canRead(id){return READABLE.has(entries.get(id)?.state)},
    canWrite(id){return entries.get(id)?.state==='current'},
  });
}
export const integrationStates=Object.freeze([...STATES]);
