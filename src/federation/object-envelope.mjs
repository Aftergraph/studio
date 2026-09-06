function seg(v){const s=String(v??'');if(!s.length||s.includes(':'))throw new TypeError('graph id segments must be non-empty and colon-free');return s}
function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;for(const child of Object.values(v))freeze(child);return Object.freeze(v)}
export function graphId(integration,type,canonicalId){return `${seg(integration)}:${seg(type)}:${seg(canonicalId)}`}
export function createEnvelope({sourceIntegration,type,canonicalId,canonicalOwner,tenantId=null,status,freshness='stale',payload,authority=[],evidence=[],relations=[],sourceRevision,observedAt=new Date().toISOString(),updatedAt=null}){
  for(const [v,label] of [[sourceIntegration,'sourceIntegration'],[type,'type'],[canonicalId,'canonicalId'],[canonicalOwner,'canonicalOwner'],[sourceRevision,'sourceRevision']])if(typeof v!=='string'||!v)throw new TypeError(`${label} required`);
  return freeze({graphId:graphId(sourceIntegration,type,canonicalId),type,canonicalId,canonicalOwner,sourceIntegration,tenantId,sourceRevision,status,freshness,authority:structuredClone(authority),evidence:structuredClone(evidence),relations:structuredClone(relations),observedAt,updatedAt,payload:structuredClone(payload??{})});
}
