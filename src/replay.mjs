/**
 * Replay utilities with minimal cloning
 * Uses shallow copies where possible to avoid deep clone overhead
 */

export function buildReplayFrames(events=[]) {
  return [...events].reverse().map((event,index)=>({ 
    index, 
    event: { ...event }, 
    cursor: event.id || `event_${index}` 
  }));
}

export function replayAt(frames=[], index=0) {
  if (!frames.length) return null;
  const safe=Math.max(0,Math.min(frames.length-1,Number(index)||0));
  return { ...frames[safe] };
}

export function appendReplayEvent(events=[], event) {
  if (!event) return [...events];
  return [{ ...event }, ...events];
}
