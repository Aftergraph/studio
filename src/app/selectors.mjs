import { conversationMissionId } from '../state.mjs';
export const selectMission=(state,id)=>state.missions?.find(m=>m.id===id)||state.missions?.[0]||null;
export const selectConversation=(state,id)=>state.conversations?.find(c=>c.id===id)||state.conversations?.[0]||null;
export const selectArtifact=(state,id)=>state.artifacts?.find(a=>a.id===id)||state.artifacts?.[0]||null;
export const selectApproval=(state,id)=>state.approvals?.find(a=>a.id===id)||state.approvals?.[0]||null;
export const selectAgent=(state,id)=>state.agents?.find(a=>a.id===id)||state.agents?.[0]||null;
export const selectSpace=(state,id)=>state.spaces?.find(s=>s.id===id)||state.spaces?.[0]||null;
export function selectChatMission(state,selectedMissionId){const id=conversationMissionId(state,state.activeConversationId);return state.missions?.find(m=>m.id===id)||selectMission(state,selectedMissionId)}
