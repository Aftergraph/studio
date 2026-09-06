const PATCH_SCOPES=new Set(['mission.progress','mission.runtime-status','attention.runtime','agents.presence','system.upstream-health','replay.cursor']);
const STRUCTURAL_VIEW_SCOPES=new Set(['conversation.messages','trust.structure','artifact.structure','space.structure','composer.structure','unknown.structural']);
const STRUCTURAL_SHELL_SCOPES=new Set(['navigation','shell.presentation']);

export const RENDER_SCOPE_MATRIX=Object.freeze({
  'missions[*].progress':{scope:'mission.progress',kind:'patch'},
  'runtimes[*].status':{scope:'mission.runtime-status',kind:'patch'},
  'runtimes[*].attention.type':{scope:'attention.runtime',kind:'patch'},
  'agents[*].status/progress/currentTask':{scope:'agents.presence',kind:'patch'},
  'upstreams[*].status/latency/checkedAt':{scope:'system.upstream-health',kind:'patch'},
  'replay.cursor/playing':{scope:'replay.cursor',kind:'patch'},
  'conversations[*].messages':{scope:'conversation.messages',kind:'structural-view'},
  'approvals/needsYou':{scope:'trust.structure',kind:'structural-view'},
  'artifacts':{scope:'artifact.structure',kind:'structural-view'},
  'spaces[*].regions/surfaces/layout':{scope:'space.structure',kind:'structural-view'},
  'activeDomain/primaryMode/activeConversationId/activeSpaceId':{scope:'navigation',kind:'structural-shell'},
  'composerMode/intentAttachments':{scope:'composer.structure',kind:'structural-view'},
  'theme/device':{scope:'shell.presentation',kind:'structural-shell'},
  '*':{scope:'unknown.structural',kind:'structural-view'},
});

const json=value=>JSON.stringify(value??null);
const pick=(obj,keys)=>Object.fromEntries(keys.map(k=>[k,obj?.[k]]));
const omit=(obj={},keys=[])=>Object.fromEntries(Object.entries(obj).filter(([k])=>!keys.includes(k)));
const missionStructural=items=>(items||[]).map(m=>omit(m,['progress']));
const agentStructural=items=>(items||[]).map(a=>omit(a,['status','progress','currentTask']));
const agentPatch=items=>(items||[]).map(a=>pick(a,['id','status','progress','currentTask']));
const UPSTREAM_HEALTH_KEYS=['status','latency','latencyMs','checkedAt','lastChecked','error'];
const stripUpstreamHealth=value=>omit(value||{},UPSTREAM_HEALTH_KEYS);
const projectUpstreamHealth=value=>pick(value||{},['id','name',...UPSTREAM_HEALTH_KEYS]);
function upstreamStructural(upstreams){
  if(Array.isArray(upstreams))return upstreams.map(stripUpstreamHealth);
  const source=upstreams&&typeof upstreams==='object'?upstreams:{};
  const services=Object.fromEntries(Object.entries(source.services||{}).map(([id,value])=>[id,stripUpstreamHealth(value)]));
  return {...omit(source,['syncedAt','services']),services};
}
function upstreamPatch(upstreams){
  if(Array.isArray(upstreams))return upstreams.map(projectUpstreamHealth);
  const source=upstreams&&typeof upstreams==='object'?upstreams:{};
  return {syncedAt:source.syncedAt??null,services:Object.fromEntries(Object.entries(source.services||{}).map(([id,value])=>[id,projectUpstreamHealth(value)]))};
}
const runtimeStatus=runtimes=>Object.fromEntries(Object.entries(runtimes||{}).map(([id,r])=>[id,r?.status??'idle']));
const runtimeAttention=runtimes=>Object.fromEntries(Object.entries(runtimes||{}).map(([id,r])=>[id,r?.attention?.type??r?.attention??null]));

const KNOWN_TOP_LEVEL=new Set([
  'user','activeDomain','primaryMode','activeConversationId','activeSpaceId','composerMode','theme',
  'missions','conversations','approvals','needsYou','artifacts','spaces','agents','upstreams','replay',
  'connections','events','memory','notifications','capabilities','policies','workItems','brain','system',
]);

function add(scopes,scope){if(scope&&!scopes.includes(scope))scopes.push(scope)}

export function classifyRenderChanges(previousState={},nextState={},previousRuntimes={},nextRuntimes={}){
  if(!previousState||!nextState)return ['unknown.structural'];
  const scopes=[];
  const prevKeys=new Set(Object.keys(previousState));
  const nextKeys=new Set(Object.keys(nextState));
  for(const key of new Set([...prevKeys,...nextKeys])){
    if(!KNOWN_TOP_LEVEL.has(key)&&json(previousState[key])!==json(nextState[key]))add(scopes,'unknown.structural');
  }
  if(json(pick(previousState,['activeDomain','primaryMode','activeConversationId','activeSpaceId']))!==json(pick(nextState,['activeDomain','primaryMode','activeConversationId','activeSpaceId'])))add(scopes,'navigation');
  if(json(pick(previousState,['theme']))!==json(pick(nextState,['theme'])))add(scopes,'shell.presentation');
  if(json(pick(previousState,['composerMode']))!==json(pick(nextState,['composerMode'])))add(scopes,'composer.structure');

  if(json(missionStructural(previousState.missions))!==json(missionStructural(nextState.missions)))add(scopes,'unknown.structural');
  else if(json((previousState.missions||[]).map(m=>[m.id,m.progress]))!==json((nextState.missions||[]).map(m=>[m.id,m.progress])))add(scopes,'mission.progress');

  if(json(previousState.conversations)!==json(nextState.conversations))add(scopes,'conversation.messages');
  if(json(previousState.approvals)!==json(nextState.approvals)||json(previousState.needsYou)!==json(nextState.needsYou))add(scopes,'trust.structure');
  if(json(previousState.artifacts)!==json(nextState.artifacts))add(scopes,'artifact.structure');
  if(json(previousState.spaces)!==json(nextState.spaces))add(scopes,'space.structure');

  if(json(agentStructural(previousState.agents))!==json(agentStructural(nextState.agents)))add(scopes,'unknown.structural');
  else if(json(agentPatch(previousState.agents))!==json(agentPatch(nextState.agents)))add(scopes,'agents.presence');

  if(json(upstreamStructural(previousState.upstreams))!==json(upstreamStructural(nextState.upstreams)))add(scopes,'unknown.structural');
  else if(json(upstreamPatch(previousState.upstreams))!==json(upstreamPatch(nextState.upstreams)))add(scopes,'system.upstream-health');

  if(json(previousState.replay)!==json(nextState.replay)){
    const p=omit(previousState.replay||{},['cursor','playing']);const n=omit(nextState.replay||{},['cursor','playing']);
    add(scopes,json(p)===json(n)?'replay.cursor':'unknown.structural');
  }

  if(json(runtimeStatus(previousRuntimes))!==json(runtimeStatus(nextRuntimes)))add(scopes,'mission.runtime-status');
  if(json(runtimeAttention(previousRuntimes))!==json(runtimeAttention(nextRuntimes)))add(scopes,'attention.runtime');

  for(const key of ['user','connections','events','memory','notifications','capabilities','policies','workItems','brain','system']){
    if(json(previousState[key])!==json(nextState[key]))add(scopes,'unknown.structural');
  }
  return scopes;
}

export function isStructuralScope(scopes=[]){
  return scopes.some(scope=>STRUCTURAL_VIEW_SCOPES.has(scope)||STRUCTURAL_SHELL_SCOPES.has(scope));
}

function focusKey(element){return element?.dataset?.focusKey||element?.getAttribute?.('data-focus-key')||null}

export function captureFocusSnapshot(root,{activeElement=globalThis.document?.activeElement??null}={}){
  if(!activeElement||!root?.contains?.(activeElement))return null;
  const key=focusKey(activeElement);if(!key)return null;
  const snapshot={key};
  if(Number.isInteger(activeElement.selectionStart)&&Number.isInteger(activeElement.selectionEnd)){
    snapshot.selectionStart=activeElement.selectionStart;snapshot.selectionEnd=activeElement.selectionEnd;snapshot.selectionDirection=activeElement.selectionDirection||'none';
  }
  return snapshot;
}

function renderEscapeAttr(value){return String(value).replaceAll('\\','\\\\').replaceAll('"','\\"')}
export function restoreFocusSnapshot(root,snapshot){
  if(!root||!snapshot?.key)return false;
  const target=root.querySelector?.(`[data-focus-key="${renderEscapeAttr(snapshot.key)}"]`);
  if(!target||target.disabled||target.hidden)return false;
  target.focus?.({preventScroll:true});
  if(Number.isInteger(snapshot.selectionStart)&&Number.isInteger(snapshot.selectionEnd)&&typeof target.setSelectionRange==='function'){
    try{target.setSelectionRange(snapshot.selectionStart,snapshot.selectionEnd,snapshot.selectionDirection||'none')}catch{}
  }
  return true;
}

export function createRenderScheduler({root,renderShell,renderView,patchers={},getState=()=>({}),getUIState=()=>({}),metrics=null}={}){
  let lastState=getState(),lastRuntimes={};
  const record=(key)=>{if(metrics)metrics[key]=(metrics[key]||0)+1};
  return {
    update(nextState,nextRuntimes={}){
      const scopes=classifyRenderChanges(lastState,nextState,lastRuntimes,nextRuntimes);
      const focus=captureFocusSnapshot(root);
      const shell=scopes.some(scope=>STRUCTURAL_SHELL_SCOPES.has(scope));
      const structural=isStructuralScope(scopes);
      if(shell){renderShell?.({state:nextState,ui:getUIState(),scopes});record('shellRenders')}
      if(structural){renderView?.({state:nextState,ui:getUIState(),scopes});record('viewRenders');restoreFocusSnapshot(root,focus)}
      else for(const scope of scopes){patchers[scope]?.({root,state:nextState,runtimes:nextRuntimes,scope});record(`patch:${scope}`)}
      lastState=nextState;lastRuntimes=nextRuntimes;
      return scopes;
    },
    reset(state=getState(),runtimes={}){lastState=state;lastRuntimes=runtimes},
  };
}
