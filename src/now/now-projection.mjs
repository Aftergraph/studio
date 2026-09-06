const TERMINAL_WORK = new Set(['VERIFIED', 'FAILED', 'CANCELLED', 'REVOKED', 'SUCCEEDED', 'CANCELED']);
const NEEDS = new Set(['pending', 'needs_input', 'needs-input', 'awaiting_approval', 'waiting_human']);
const RESEARCH_TYPES = new Set(['research_program', 'study', 'experiment', 'claim', 'paper']);

function item(o) {
  return Object.freeze({ ...o, current: o.freshness === 'current' });
}

export function createNowProjection({ objects = [], integrations = [] } = {}) {
  const mapped = objects.map(item);
  const unavailable = integrations
    .filter(x => !['current', 'stale', 'degraded', 'drifted'].includes(x.state))
    .map(x => x.manifest?.id ?? x.id)
    .filter(Boolean)
    .sort();

  return Object.freeze({
    activeWork: Object.freeze(mapped.filter(o => (o.type === 'work' || o.type === 'mission') && !TERMINAL_WORK.has(String(o.status).toUpperCase()))),
    needsYou: Object.freeze(mapped.filter(o => (o.type === 'approval' || o.type === 'need_you' || o.type === 'incident') && NEEDS.has(String(o.status).toLowerCase()))),
    research: Object.freeze(mapped.filter(o => RESEARCH_TYPES.has(o.type))),
    incidents: Object.freeze(mapped.filter(o => o.type === 'incident' && !['resolved', 'closed'].includes(String(o.status).toLowerCase()))),
    outcomes: Object.freeze(mapped.filter(o => o.type === 'outcome' || ((o.type === 'work' || o.type === 'mission') && ['VERIFIED', 'SUCCEEDED'].includes(String(o.status).toUpperCase())))),
    coverage: Object.freeze({ complete: unavailable.length === 0, unavailable: Object.freeze(unavailable) })
  });
}
