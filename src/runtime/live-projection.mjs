export function patchLiveProjection(root,{state={},runtimes={},scopes=[]}={}){
  if(!root)return;
  if(scopes.includes('mission.progress')){
    const mission=state.missions?.find(m=>m.id===state.activeMissionId)||state.missions?.[0];
    const progress=Math.max(0,Math.min(100,Number(mission?.progress)||0));
    root.querySelectorAll?.('[data-live-progress-fill],.ag-live-progress i,.ag-work-summary-progress i,.ag-pulse-progress i').forEach(el=>{el.style.width=`${progress}%`});
    root.querySelectorAll?.('[data-live-progress-label],.ag-live-strip>b').forEach(el=>{el.textContent=`${progress}%`});
  }
  if(scopes.includes('mission.runtime-status')){
    for(const [id,runtime] of Object.entries(runtimes||{}))root.querySelectorAll?.(`[data-runtime-mission="${id}"]`).forEach(el=>el.setAttribute('data-runtime-status',runtime?.status||'idle'));
  }
}
