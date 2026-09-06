export function validateWorkspacePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('invalid workspace payload');
  const state=payload.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new TypeError('invalid workspace state');
  for (const key of ['missions','agents','conversations','approvals','needsYou','artifacts','memory','connections','events','spaces']) {
    if (!Array.isArray(state[key])) throw new TypeError(`workspace state ${key} must be an array`);
  }
  if (!state.replay || typeof state.replay !== 'object' || Array.isArray(state.replay)) throw new TypeError('workspace state replay must be an object');
  for (const [key,records] of Object.entries({missions:state.missions,agents:state.agents,conversations:state.conversations,approvals:state.approvals,artifacts:state.artifacts})) {
    for (const record of records) if (!record || typeof record !== 'object' || !record.id) throw new TypeError(`workspace ${key} record requires id`);
  }
  return payload;
}
function stableMission(mission={}) {
  return {
    id:mission.id,title:mission.title,state:mission.state,risk:mission.risk,controlMode:mission.controlMode,
    agent:mission.agent,verified:Boolean(mission.verified),evidenceCount:mission.evidenceCount,eta:mission.eta,objective:mission.objective,
    budget:mission.budget,
    steps:(mission.steps||[]).map(step=>({id:step.id,label:step.label})),
  };
}

function stableConversation(conversation={}) {
  return {
    id:conversation.id,missionId:conversation.missionId,title:conversation.title,status:conversation.status,
    messages:(conversation.messages||[]).map(message=>({
      id:message.id,type:message.type,author:message.author,text:message.text,time:message.time,
      missionId:message.missionId,agentId:message.agentId,state:message.state,mode:message.mode,
    })),
  };
}

function structuralProjection(state={}) {
  return {
    user:state.user,
    activeDomain:state.activeDomain,
    activeConversationId:state.activeConversationId,
    composerMode:state.composerMode,
    theme:state.theme,
    needsYou:state.needsYou,
    approvals:state.approvals,
    missions:(state.missions||[]).map(stableMission),
    agents:state.agents,
    conversations:(state.conversations||[]).map(stableConversation),
    artifacts:state.artifacts,
    memory:state.memory,
    connections:state.connections,
    events:state.events,
  };
}

function runtimeProjection(runtimes={}) {
  return Object.fromEntries(Object.entries(runtimes||{}).map(([id,runtime])=>[id,{status:runtime?.status||'idle',attention:runtime?.attention?.type||null}]));
}

export function isRuntimePatchOnly(previousState,nextState,previousRuntimes={},nextRuntimes={}) {
  if (!previousState || !nextState) return false;
  return JSON.stringify(structuralProjection(previousState))===JSON.stringify(structuralProjection(nextState))
    && JSON.stringify(runtimeProjection(previousRuntimes))===JSON.stringify(runtimeProjection(nextRuntimes));
}

export function reconcileUpstreamSync(localState={},payload={}) {
  if (!payload?.upstreams) return localState;
  return {
    ...localState,
    upstreams:payload.upstreams,
    events:Array.isArray(payload?.state?.events) ? payload.state.events : localState.events,
  };
}

function upstreamStableProjection(value={}) {
  const {
    upstreams:_upstreams,
    events:_events,
    activeDomain:_activeDomain,
    primaryMode:_primaryMode,
    activeConversationId:_activeConversationId,
    activeSpaceId:_activeSpaceId,
    ...rest
  }=value||{};
  return rest;
}

export function isUpstreamProjectionOnly(previousState,nextState) {
  if (!previousState || !nextState) return false;
  const previousUpstreams=JSON.stringify(previousState.upstreams??null);
  const nextUpstreams=JSON.stringify(nextState.upstreams??null);
  if (previousUpstreams===nextUpstreams) return false;
  return JSON.stringify(upstreamStableProjection(previousState))===JSON.stringify(upstreamStableProjection(nextState));
}

const CLIENT_VIEW_KEYS=Object.freeze([
  'activeDomain','primaryMode','activeConversationId','activeSpaceId','composerMode','theme',
]);

export function reconcileBackgroundState(localState={},serverState={}) {
  const next={...serverState};
  for(const key of CLIENT_VIEW_KEYS){
    if(Object.prototype.hasOwnProperty.call(localState,key)) next[key]=localState[key];
  }
  return next;
}
