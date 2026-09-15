function objectRef(type, object, freshness='current') {
  if (!object?.id) return null;
  return Object.freeze({
    type,
    id: object.id,
    label: object.title || object.name || object.id,
    freshness,
  });
}

function conversationMissionId(state, conversation) {
  if (!conversation) return null;
  if (conversation.missionId) return conversation.missionId;
  const linked=[...(conversation.messages || [])].reverse().find(message=>message.missionId);
  return linked?.missionId || null;
}

export function activeMissionId(state={}, ui={}) {
  const conversation=(state.conversations || []).find(item=>item.id===state.activeConversationId);
  const fromConversation=conversationMissionId(state,conversation);
  const selected=(state.missions || []).some(item=>item.id===ui.selectedMissionId)?ui.selectedMissionId:null;
  return state.primaryMode==='chat' ? (fromConversation || selected) : (selected || fromConversation);
}

export function conversationIdForMission(state={}, missionId=null) {
  if (!missionId) return state.activeConversationId || null;
  return (state.conversations || []).find(item=>conversationMissionId(state,item)===missionId)?.id || state.activeConversationId || null;
}
export function alignModeToActiveContext(state={}, ui={}, targetMode='chat') {
  const missionId=activeMissionId(state,ui);
  const artifacts=(state.artifacts || []).filter(item=>item.missionId===missionId);
  const artifactId=artifacts.some(item=>item.id===ui.selectedArtifactId)
    ? ui.selectedArtifactId
    : artifacts[0]?.id || ui.selectedArtifactId || null;
  return {
    ...ui,
    selectedMissionId:missionId || ui.selectedMissionId || null,
    selectedArtifactId:artifactId,
    activeContextMode:targetMode,
  };
}

export function deriveActiveContext(state={}, ui={}, backendPhase='offline') {
  const freshness=['current','resyncing','stale','degraded'].includes(backendPhase)?backendPhase:'offline';
  const missionId=activeMissionId(state,ui);
  const mission=(state.missions || []).find(item=>item.id===missionId) || null;
  const conversationId=state.primaryMode==='chat'
    ? state.activeConversationId
    : conversationIdForMission(state,missionId);
  const conversation=(state.conversations || []).find(item=>item.id===conversationId) || null;
  const artifacts=(state.artifacts || []).filter(item=>item.missionId===missionId);
  const agent=(state.agents || []).find(item=>item.name===mission?.agent) || null;
  const evidence=artifacts.filter(item=>item.verified || String(item.kind).toLowerCase()==='evidence');
  const selectedObjects=[mission,artifacts.find(item=>item.id===ui.selectedArtifactId),agent].filter(Boolean);
  return Object.freeze({
    contextId:`context:${missionId || conversationId || state.activeSpaceId || 'workspace'}`,
    conversation:objectRef('conversation',conversation,freshness),
    mission:objectRef('mission',mission,freshness),
    work:objectRef('work',mission,freshness),
    artifacts:Object.freeze(artifacts.map(item=>objectRef('artifact',item,freshness))),
    evidence:Object.freeze(evidence.map(item=>objectRef('evidence',item,freshness))),
    agents:Object.freeze(agent?[objectRef('agent',agent,freshness)]:[]),
    selectedObjects:Object.freeze(selectedObjects.map(item=>objectRef(
      item.role?'agent':item.kind?'artifact':'mission',item,freshness,
    ))),
    freshness:Object.freeze({
      state:freshness,
      current:freshness==='current',
      writable:freshness==='current',
    }),
    authorityHints:Object.freeze([...(state.user?.capabilities || [])]),
    updatedAt:state.upstreams?.syncedAt || null,
  });
}
