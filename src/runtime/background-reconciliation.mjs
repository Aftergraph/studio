const CLIENT_VIEW_KEYS=Object.freeze(['activeDomain','primaryMode','activeConversationId','activeSpaceId','composerMode','theme']);
export function reconcileAuthoritativeState(localState={},serverState={}){
  const next={...serverState};
  for(const key of CLIENT_VIEW_KEYS){if(Object.prototype.hasOwnProperty.call(localState,key))next[key]=localState[key]}
  return next;
}
export { CLIENT_VIEW_KEYS };
