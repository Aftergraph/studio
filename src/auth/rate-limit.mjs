// ponytail: fixed-window per-key counter. Single-process scope (matches the
// V8.1 single-process ceiling); a distributed deployment needs a shared store.
export function createRateLimiter({ maxHits = 10, windowMs = 60 * 60 * 1000, now = Date.now } = {}) {
  const hits = new Map();
  const prune = (key, at) => {
    const times = (hits.get(key) || []).filter(t => at - t < windowMs);
    if (times.length) hits.set(key, times);
    else hits.delete(key);
    return times;
  };
  return {
    hit(key) {
      const at = now();
      const times = prune(key, at);
      if (times.length >= maxHits) {
        const retryAfterSec = Math.ceil((times[0] + windowMs - at) / 1000);
        return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
      }
      times.push(at);
      hits.set(key, times);
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}
