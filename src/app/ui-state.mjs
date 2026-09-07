export function createUIState(state={},device='desktop') {
  return {
    selectedMissionId:state.missions?.[0]?.id??null,
    selectedAgentId:state.agents?.[0]?.id??null,
    selectedArtifactId:state.artifacts?.[0]?.id??null,
    selectedApprovalId:state.approvals?.[0]?.id??null,
    artifactOpen:false,
    inspectorOpen:false,
    inspectorKind:'context',
    selectedConnectionId:state.connections?.[0]?.id??null,
    approvalOpen:false,
    approvalEvidenceOpen:false,
    paletteOpen:false,
    paletteQuery:'',
    paletteIndex:0,
    artifactTab:'preview',
    immersive:false,
    artifactWidth:42,
    pulseOpen:false,
    followLatest:true,
    forceFollowLatest:true,
    messageScrollTop:0,
    device,
    followedAgentId:null,
    presenceOpen:true,
    replayOpen:false,
    intentMode:'Ask',
    hiddenIntentContextKeys:[],
    intentAttachments:[],
    backendStatus:'offline',
    diagnostic:null,
    controlError:'',
    resyncMetric:null,
    auth:{ open:false, panel:'request', userId:'', token:'', error:'' },
  };
}

export function patchUIState(ui={},patch={}) {
  return {...ui,...patch};
}
