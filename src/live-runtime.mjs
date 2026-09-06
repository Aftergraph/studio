import { settleMission } from './state.mjs';

const runtimeClone=s=>structuredClone(s);

export function createLiveRuntime(state,missionId) {
  const mission=state.missions.find(m=>m.id===missionId);
  if (!mission) throw new Error(`mission not found: ${missionId}`);
  return { state:runtimeClone(state), missionId, status:mission.state==='awaiting_approval'?'awaiting_approval':'running', attention:mission.state==='awaiting_approval'?{type:'approval'}:null, tick:0 };
}

export function stepMission(runtime) {
  if (runtime.status==='paused'||runtime.status==='awaiting_approval'||runtime.status==='verified') return runtimeClone(runtime);
  const next=runtimeClone(runtime);
  const mission=next.state.missions.find(m=>m.id===next.missionId);
  if (mission.state==='awaiting_approval'||mission.steps.some(s=>s.state==='blocked')) {
    next.status='awaiting_approval';
    next.attention={type:'approval',missionId:mission.id};
    return next;
  }
  next.tick += 1;
  mission.progress=Math.min(100, mission.progress + 7);
  const runningIndex=mission.steps.findIndex(s=>s.state==='running');
  if (runningIndex>=0 && (mission.progress >= 72 + runningIndex*6 || next.tick%2===0)) {
    mission.steps[runningIndex].state='completed';
    const nextPending=mission.steps.find(s=>s.state==='pending');
    if (nextPending) nextPending.state='running';
  }
  if (mission.progress>=100 || mission.steps.every(s=>s.state==='completed')) {
    const evidence=[...Array(Math.max(1,mission.evidenceCount||1))].map((_,i)=>`ev_${mission.id}_${i}`);
    next.state=settleMission(next.state,mission.id,{verified:true,evidence});
    next.status='verified';
    next.attention=null;
  } else {
    mission.state='running';
    next.status='running';
  }
  return next;
}

export function pauseMission(runtime) {
  const next=runtimeClone(runtime); next.status='paused'; return next;
}
export function resumeMission(runtime) {
  const next=runtimeClone(runtime); if(next.status==='paused') next.status='running'; return next;
}
