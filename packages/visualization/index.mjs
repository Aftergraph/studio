const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const attr = esc;

function nodeStateClass(state='pending') { return `is-${String(state).replace(/[^a-z0-9_-]/gi,'-').toLowerCase()}`; }

export function AGTrajectoryGraph({ mission }={}) {
  const steps = mission?.steps?.length ? mission.steps : [{id:'goal',label:mission?.title||'Mission',state:mission?.state||'idle'}];
  const width = 760;
  const height = 190;
  const pad = 54;
  const gap = steps.length > 1 ? (width - pad*2)/(steps.length-1) : 0;
  const y = 88;
  const edges = steps.slice(0,-1).map((step,i)=>`<line x1="${pad+i*gap}" y1="${y}" x2="${pad+(i+1)*gap}" y2="${y}" class="ag-viz-edge"/>`).join('');
  const nodes = steps.map((step,i)=>{
    const x=pad+i*gap;
    return `<g class="ag-viz-node ${nodeStateClass(step.state)}" data-trajectory-node="${attr(step.id)}" data-viz-action="inspect-node" tabindex="0" role="button" aria-label="${attr(step.label)}: ${attr(step.state||'pending')}"><circle cx="${x}" cy="${y}" r="17"/><circle class="ag-viz-node-core" cx="${x}" cy="${y}" r="6"/><text x="${x}" y="${y+43}" text-anchor="middle">${esc(step.label)}</text><text class="ag-viz-node-state" x="${x}" y="${y+60}" text-anchor="middle">${esc(step.state||'pending')}</text></g>`;
  }).join('');
  return `<figure class="ag-trajectory-graph" data-ag-component="trajectory-graph" data-mission="${attr(mission?.id||'mission')}" aria-label="Mission trajectory"><svg viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="trajectory-title"><title id="trajectory-title">${esc(mission?.title||'Mission')} trajectory</title><g role="img" aria-label="Trajectory connections">${edges}</g>${nodes}</svg></figure>`;
}

export function AGEvidenceGraph({ missionId='mission', evidenceCount=0, verified=false }={}) {
  const count=Math.max(0,Number(evidenceCount)||0);
  const dots=Array.from({length:Math.min(count,12)},(_,i)=>`<i style="--i:${i}" aria-hidden="true"></i>`).join('');
  return `<section class="ag-evidence-graph" data-ag-component="evidence-graph" data-mission="${attr(missionId)}" data-verified="${verified?'true':'false'}"><div class="ag-evidence-orbit">${dots}<span>${count}</span></div><div><strong>${count} evidence</strong><small>${verified?'verification complete':'verification pending'}</small></div></section>`;
}

export function AGReplayTimeline({ frames=[], activeIndex=0, playing=false }={}) {
  const max=Math.max(0,frames.length-1);
  const safe=Math.max(0,Math.min(max,Number(activeIndex)||0));
  return `<section class="ag-replay-timeline" data-ag-component="replay-timeline"><header><span><small>Time</small><strong>Mission replay</strong></span><span class="ag-replay-controls"><output>${frames[safe]?.event?.time||'now'}</output><button type="button" data-replay-action="${playing?'pause':'play'}" aria-label="${playing?'Pause':'Play'} replay">${playing?'Ⅱ':'▶'}</button></span></header><input type="range" min="0" max="${max}" value="${safe}" step="1" data-replay-action="scrub" aria-label="Replay timeline"/><div class="ag-replay-events">${frames.map((frame,i)=>`<button type="button" class="${i===safe?'active':''}" data-replay-index="${i}" aria-label="Frame ${i+1}: ${esc(frame.event?.type||'event')}"><i></i><span>${esc(frame.event?.type||'event')}</span></button>`).join('')}</div></section>`;
}
