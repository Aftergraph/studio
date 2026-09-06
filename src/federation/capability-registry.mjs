function freeze(v){if(!v||typeof v!=='object'||Object.isFrozen(v))return v;for(const child of Object.values(v))freeze(child);return Object.freeze(v)}
export function createCapabilityRegistry({resolveGrant=()=>false}={}){const caps=new Map();return Object.freeze({
  register(cap){if(!cap?.id||!cap?.source)throw new TypeError('capability id/source required');const frozen=freeze(structuredClone(cap));if(caps.has(cap.id)){const prior=caps.get(cap.id);if(prior.source!==frozen.source)throw new Error(`capability conflict ${cap.id}`);return prior}caps.set(cap.id,frozen);return frozen},
  discover(q=''){const s=String(q).toLowerCase();return [...caps.values()].filter(c=>c.discoverable!==false&&JSON.stringify(c).toLowerCase().includes(s))},
  get(id){return caps.get(id)??null},
  grantStatus(subject,id){const cap=caps.get(id);if(!cap)return 'not-granted';return resolveGrant(subject,cap)?'granted':'not-granted'},
  eligibleFor(subject,id){const cap=caps.get(id);return Boolean(cap)&&this.grantStatus(subject,id)==='granted'},
});}
