function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;for(const child of Object.values(v))freeze(child);return Object.freeze(v)}
function canonical(v){return JSON.stringify(v,Object.keys(v??{}).sort())}
export function createEvidenceGraph(){const evidence=new Map(),links=new Map();return Object.freeze({
  registerEvidence(ref){if(!ref?.id||!ref?.owner||!ref?.class||!ref?.method)throw new TypeError('evidence provenance incomplete');const frozen=freeze(structuredClone(ref));if(evidence.has(ref.id)){const prior=evidence.get(ref.id);if(canonical(prior)!==canonical(frozen))throw new Error(`evidence provenance conflict ${ref.id}`);return prior}evidence.set(ref.id,frozen);return frozen},
  linkEvidence(graphId,evidenceId){if(!evidence.has(evidenceId))throw new Error(`unknown evidence ${evidenceId}`);const set=links.get(graphId)??new Set();set.add(evidenceId);links.set(graphId,set)},
  getEvidence(id){return evidence.get(id)??null},
  evidenceFor(graphId){return [...(links.get(graphId)??[])].map(id=>evidence.get(id))},
  isFreshVerified(id){const e=evidence.get(id);return Boolean(e?.verified)&&e?.freshness==='current'},
});}
