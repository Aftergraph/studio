const PROJECT_FIELDS=new Set(['id','tenantId','name','description','pinned','refs','createdAt','updatedAt']);
const RECENT_FIELDS=new Set(['id','tenantId','label','kind','targetRef','projectId','updatedAt']);
const REF_FIELDS=new Set(['owner','type','id','ref','tenantId']);

function requiredString(value,name){
  if(typeof value!=='string'||value.trim()==='') throw new Error(`${name} is required`);
  return value;
}

function rejectUnknown(input,allowed){
  for(const key of Object.keys(input)) {
    if(!allowed.has(key)) throw new Error(`unsupported embedded field: ${key}`);
  }
}

function freezeRef(input,tenantId){
  if(!input||typeof input!=='object') throw new Error('canonical ref must be an object');
  rejectUnknown(input,REF_FIELDS);
  if(input.tenantId!==undefined&&input.tenantId!==tenantId) throw new Error('cross-tenant canonical ref rejected');
  return Object.freeze({
    owner:requiredString(input.owner,'ref.owner'),
    type:requiredString(input.type,'ref.type'),
    id:requiredString(input.id,'ref.id'),
    ref:requiredString(input.ref,'ref.ref'),
    ...(input.tenantId?{tenantId:input.tenantId}:{}),
  });
}

export function createProjectRecord(input={}){
  rejectUnknown(input,PROJECT_FIELDS);
  const tenantId=requiredString(input.tenantId,'tenantId');
  const now=new Date().toISOString();
  const refs=Object.freeze((Array.isArray(input.refs)?input.refs:[]).map(ref=>freezeRef(ref,tenantId)));
  return Object.freeze({
    schema:'aftergraph.project-experience/1.0',
    id:requiredString(input.id,'id'),
    tenantId,
    name:requiredString(input.name,'name'),
    ...(input.description?{description:String(input.description)}:{}),
    pinned:Boolean(input.pinned),
    refs,
    createdAt:input.createdAt||now,
    updatedAt:input.updatedAt||input.createdAt||now,
    owner:'studio',
  });
}

export function createRecentEntry(input={}){
  rejectUnknown(input,RECENT_FIELDS);
  const tenantId=requiredString(input.tenantId,'tenantId');
  return Object.freeze({
    schema:'aftergraph.recent-experience/1.0',
    id:requiredString(input.id,'id'),
    tenantId,
    label:requiredString(input.label,'label'),
    kind:requiredString(input.kind,'kind'),
    targetRef:freezeRef(input.targetRef,tenantId),
    ...(input.projectId?{projectId:String(input.projectId)}:{}),
    updatedAt:input.updatedAt||new Date().toISOString(),
    owner:'studio',
  });
}
