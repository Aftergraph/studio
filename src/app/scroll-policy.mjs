export const FOLLOW_LATEST_THRESHOLD_PX=32;

export function isNearEnd(container,threshold=FOLLOW_LATEST_THRESHOLD_PX){
  if(!container)return true;
  const remaining=Math.max(0,(Number(container.scrollHeight)||0)-(Number(container.clientHeight)||0)-(Number(container.scrollTop)||0));
  return remaining<threshold;
}

export function captureScrollIntent(container,{followLatest=false,forceFollowLatest=false}={}){
  return {
    scrollTop:Number(container?.scrollTop)||0,
    followLatest:Boolean(forceFollowLatest||followLatest||isNearEnd(container)),
    forceFollowLatest:Boolean(forceFollowLatest),
  };
}

export function restoreScrollIntent(container,snapshot={}, {forceFollowLatest=false}={}){
  if(!container)return false;
  const follow=Boolean(forceFollowLatest||snapshot.forceFollowLatest||snapshot.followLatest);
  if(follow){
    container.scrollTop=Math.max(0,(Number(container.scrollHeight)||0)-(Number(container.clientHeight)||0));
  }else{
    container.scrollTop=Math.max(0,Number(snapshot.scrollTop)||0);
  }
  return true;
}
