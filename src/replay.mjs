const clone = value => structuredClone(value);

export function buildReplayFrames(events=[]) {
  return [...events].reverse().map((event,index)=>({ index, event:clone(event), cursor:event.id || `event_${index}` }));
}

export function replayAt(frames=[], index=0) {
  if (!frames.length) return null;
  const safe=Math.max(0,Math.min(frames.length-1,Number(index)||0));
  return clone(frames[safe]);
}

export function appendReplayEvent(events=[], event) {
  if (!event) return [...events];
  return [clone(event), ...events];
}
