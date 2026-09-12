export const INTENT_SCHEMA='aftergraph/intent-ir/v0.1';
export const ARTIFACT_KINDS=new Set(['task','policy','skill','workflow','agent','automation','handoff']);
export const PERSISTENCE=new Set(['ephemeral','session','workspace','durable']);

const strings=value=>Array.isArray(value)?[...new Set(value.map(v=>String(v).trim()).filter(Boolean))]:[];

export function normalizeIntentIR(input={}) {
  return {
    schema:INTENT_SCHEMA,
    source:{
      text:String(input.source?.text||''),
      surface:String(input.source?.surface||'compose-mobile'),
    },
    goal:{
      statement:String(input.goal?.statement||''),
      successCriteria:strings(input.goal?.successCriteria),
    },
    artifact:{
      kind:ARTIFACT_KINDS.has(input.artifact?.kind)?input.artifact.kind:'task',
      persistence:PERSISTENCE.has(input.artifact?.persistence)?input.artifact.persistence:'ephemeral',
    },
    scope:{includes:strings(input.scope?.includes),excludes:strings(input.scope?.excludes)},
    constraints:strings(input.constraints),
    authority:{
      read:strings(input.authority?.read),
      write:strings(input.authority?.write),
      execute:strings(input.authority?.execute),
      network:strings(input.authority?.network),
      requiresApproval:strings(input.authority?.requiresApproval),
    },
    capabilities:{required:strings(input.capabilities?.required),optional:strings(input.capabilities?.optional)},
    effects:Array.isArray(input.effects)?input.effects.map(effect=>({...effect})):[],
    verification:{
      required:input.verification?.required===true,
      obligations:strings(input.verification?.obligations),
      completionRule:String(input.verification?.completionRule||'model-output'),
    },
    output:{format:String(input.output?.format||'text'),contract:strings(input.output?.contract)},
    targetHints:strings(input.targetHints),
    ambiguities:strings(input.ambiguities),
  };
}

export function validateIntentIR(ir) {
  const findings=[];
  if(ir?.schema!==INTENT_SCHEMA)findings.push({code:'IR_INVALID',field:'schema'});
  if(!ir?.source?.text?.trim())findings.push({code:'IR_INVALID',field:'source.text'});
  if(!ir?.goal?.statement?.trim())findings.push({code:'IR_INVALID',field:'goal.statement'});
  return {ok:findings.length===0,findings};
}
