const ALLOWED=new Set(['observed_from','suggests','promoted_to','fulfills','executes','assigned_to','requires','authorized_by','approved_by','produces','supported_by','derived_from','verifies','contradicts','supersedes','belongs_to','uses_capability','uses_skill','related_to']);
function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;for(const child of Object.values(v))freeze(child);return Object.freeze(v)}
export function validateRelation(r){if(!r||typeof r!=='object')throw new TypeError('relation object required');if(!ALLOWED.has(r.type))throw new TypeError(`unknown relation ${r.type}`);if(!r.sourceIntegration)throw new TypeError('relation sourceIntegration required');if(!r.from||!r.to)throw new TypeError('relation from/to required');return freeze(structuredClone(r))}
export function createObjectGraph(){const objects=new Map();const relations=[];return Object.freeze({
  upsert(envelope){if(!envelope?.graphId)throw new TypeError('envelope.graphId required');objects.set(envelope.graphId,envelope);return envelope},
  relate(input){
    const relation=validateRelation(input);
    const from=objects.get(relation.from),to=objects.get(relation.to);
    if(!from||!to)throw new Error('relation endpoints must exist');
    if((from.tenantId || to.tenantId) && from.tenantId !== to.tenantId)throw new Error('cross-tenant relation rejected');
    relations.push(relation);
    return relation;
  },
  get(id){return objects.get(id)??null},
  list(){return [...objects.values()]},
  relations(){return [...relations]},
  neighbors(id,type=null){const ids=[];for(const r of relations){if(type&&r.type!==type)continue;if(r.from===id)ids.push(r.to);else if(r.to===id)ids.push(r.from)}return [...new Set(ids)].map(x=>objects.get(x)).filter(Boolean)},
});}
export const relationVocabulary=Object.freeze([...ALLOWED]);
