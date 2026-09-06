// V81-distributed-02 — deterministic convergence over offline event logs.
// ponytail: pure function over event arrays; reuses offline-event-log's
// first-writer-wins semantics by dedup on id (first seen wins).

function clockSum(vc) {
  let s = 0;
  for (const v of Object.values(vc ?? {})) s += Number(v) || 0;
  return s;
}

function totalOrder(a, b) {
  const sa = clockSum(a.vectorClock);
  const sb = clockSum(b.vectorClock);
  if (sa !== sb) return sa - sb;
  const ta = a.appendedAt ?? '';
  const tb = b.appendedAt ?? '';
  if (ta !== tb) return ta < tb ? -1 : 1;
  const ia = a.id ?? '';
  const ib = b.id ?? '';
  return ia < ib ? -1 : ia > ib ? 1 : 0;
}

export function converge(eventsA = [], eventsB = []) {
  if (!Array.isArray(eventsA) || !Array.isArray(eventsB)) {
    throw new TypeError('converge expects two arrays');
  }
  const seen = new Map();
  for (const e of eventsA) {
    if (e && typeof e === 'object' && e.id && !seen.has(e.id)) seen.set(e.id, e);
  }
  for (const e of eventsB) {
    if (e && typeof e === 'object' && e.id && !seen.has(e.id)) seen.set(e.id, e);
  }
  return Object.freeze([...seen.values()].sort(totalOrder));
}
