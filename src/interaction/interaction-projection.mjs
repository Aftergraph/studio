const ALLOWED=new Set([
  'tenantId','surfaceRef','threadRef','turnRefs','presenceRefs','assistantProfile','freshness',
]);
const FRESHNESS=new Set(['current','stale','degraded','unknown']);

function requiredString(value,name){
  if(typeof value!=='string'||value.trim()==='') throw new Error(`${name} is required`);
  return value;
}

function frozenRefs(value,name){
  if(!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return Object.freeze(value.map((entry,index)=>requiredString(entry,`${name}[${index}]`)));
}

function frozenAssistant(value,tenantId){
  if(!value||typeof value!=='object') throw new Error('assistantProfile is required');
  if(value.tenantId!==undefined&&value.tenantId!==tenantId) throw new Error('assistantProfile tenant mismatch');
  const id=requiredString(value.id,'assistantProfile.id');
  const label=requiredString(value.label,'assistantProfile.label');
  return Object.freeze({id,label,...(value.tenantId?{tenantId:value.tenantId}:{})});
}

export function createInteractionSurfaceProjection(input={}){
  if(!input||typeof input!=='object') throw new Error('interaction projection input required');
  for(const key of Object.keys(input)) {
    if(!ALLOWED.has(key)) throw new Error(`unsupported embedded interaction field: ${key}`);
  }
  const tenantId=requiredString(input.tenantId,'tenantId');
  const freshness=input.freshness??'unknown';
  if(!FRESHNESS.has(freshness)) throw new Error('freshness must be current, stale, degraded or unknown');
  return Object.freeze({
    schema:'aftergraph.interaction-surface-projection/1.0',
    canonicalOwner:'studio',
    authoritative:false,
    tenantId,
    surfaceRef:requiredString(input.surfaceRef,'surfaceRef'),
    threadRef:requiredString(input.threadRef,'threadRef'),
    turnRefs:frozenRefs(input.turnRefs??[],'turnRefs'),
    presenceRefs:frozenRefs(input.presenceRefs??[],'presenceRefs'),
    assistantProfile:frozenAssistant(input.assistantProfile,tenantId),
    freshness,
  });
}
