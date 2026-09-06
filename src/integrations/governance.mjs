const MISSION_STATE_MACHINE=Object.freeze({
  DRAFT:['READY','CANCELLED'],
  READY:['AUTHORIZED','CANCELLED'],
  AUTHORIZED:['RUNNING','CANCELLED','REVOKED'],
  RUNNING:['PAUSED','VERIFYING','NEEDS_INPUT','CANCELLED','REVOKED'],
  PAUSED:['RUNNING','CANCELLED','REVOKED'],
  VERIFYING:['VERIFIED','RECOVERING','NEEDS_INPUT','FAILED'],
  RECOVERING:['RUNNING','NEEDS_INPUT','FAILED'],
  NEEDS_INPUT:['RUNNING','PAUSED','CANCELLED','FAILED'],
  VERIFIED:[],FAILED:[],CANCELLED:[],REVOKED:[],
});

const ALIASES=Object.freeze({
  draft:'DRAFT',ready:'READY',authorized:'AUTHORIZED',running:'RUNNING',paused:'PAUSED',
  verifying:'VERIFYING',verified:'VERIFIED',recovering:'RECOVERING',needs_input:'NEEDS_INPUT',
  awaiting_approval:'NEEDS_INPUT',waiting_human:'NEEDS_INPUT',suspended:'PAUSED',
  succeeded:'VERIFIED',failed:'FAILED',cancelled:'CANCELLED',canceled:'CANCELLED',revoked:'REVOKED',
});

export function normalizeMissionState(value){
  if(typeof value!=='string') return null;
  const upper=value.toUpperCase();
  if(Object.hasOwn(MISSION_STATE_MACHINE,upper)) return upper;
  return ALIASES[value.toLowerCase()]||null;
}

export function createGovernanceAdapter(){
  return Object.freeze({
    kind:'after-graph-governance',
    missionStates:Object.keys(MISSION_STATE_MACHINE),
    normalizeMissionState,
    canTransition(from,to){
      const a=normalizeMissionState(from),b=normalizeMissionState(to);
      return Boolean(a&&b&&MISSION_STATE_MACHINE[a]?.includes(b));
    },
    assertTransition({from,to,evidence=[]}={}){
      const a=normalizeMissionState(from),b=normalizeMissionState(to);
      if(!a||!b) throw new Error('unknown mission state');
      if(!MISSION_STATE_MACHINE[a].includes(b)) throw new Error(`illegal mission transition ${a} -> ${b}`);
      if(b==='VERIFIED'&&(!Array.isArray(evidence)||evidence.length===0)) throw new Error('VERIFIED mission requires evidence');
      return true;
    },
  });
}
