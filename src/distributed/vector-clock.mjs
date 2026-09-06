// V81-distributed-01 — vector clocks for offline event ordering.
// ponytail: plain counters + component-wise max merge; CRDT semantics grow here when needed.
export function createVectorClock(initial = {}) {
  const counters = { ...initial };
  return Object.freeze({
    get(nodeId) {
      return counters[nodeId] ?? 0;
    },
    increment(nodeId) {
      counters[nodeId] = (counters[nodeId] ?? 0) + 1;
      return counters[nodeId];
    },
    merge(remote = {}) {
      for (const [nodeId, value] of Object.entries(remote)) {
        counters[nodeId] = Math.max(counters[nodeId] ?? 0, value);
      }
      return { ...counters };
    },
    snapshot() {
      return Object.freeze({ ...counters });
    },
  });
}

export function mergeVectorClocks(a = {}, b = {}) {
  const merged = { ...a };
  for (const [nodeId, value] of Object.entries(b)) {
    merged[nodeId] = Math.max(merged[nodeId] ?? 0, value);
  }
  return Object.freeze(merged);
}
