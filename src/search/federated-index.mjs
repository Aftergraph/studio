// ponytail: universal federated search index covering 8 canonical object families with token ranking and incomplete coverage semantics
function freeze(v) {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  for (const child of Object.values(v)) freeze(child);
  return Object.freeze(v);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9_\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value) {
  return normalize(value).split(' ').filter(Boolean);
}

function searchable(o) {
  return `${o.type} ${o.canonicalId} ${JSON.stringify(o.payload ?? {})}`.toLowerCase();
}

function scoreItem(o, query) {
  const q = normalize(query);
  const qTokens = tokenize(q);
  const text = searchable(o);
  const textTokens = new Set(tokenize(text));

  let score = 0;
  if (text.includes(q)) score += 100;
  if (o.canonicalId.toLowerCase() === q) score += 50;

  for (const qt of qTokens) {
    if (textTokens.has(qt)) score += 20;
    else if ([...textTokens].some(tt => tt.startsWith(qt) || qt.startsWith(tt))) score += 8;
  }

  // Freshness weighting
  if (o.freshness === 'current') score += 50;
  else if (o.freshness === 'stale') score += 10;
  else if (o.freshness === 'degraded') score += 5;
  else if (o.freshness === 'drifted') score -= 10;

  return score;
}

export function createFederatedIndex() {
  const objects = new Map();
  const coverage = new Map();

  return Object.freeze({
    index(o) {
      if (!o?.graphId || !o?.sourceIntegration) {
        throw new TypeError('graph object required');
      }
      objects.set(o.graphId, o);
      return o;
    },

    remove(id) {
      return objects.delete(id);
    },

    setCoverage(id, state) {
      coverage.set(id, String(state));
    },

    search(query, { tenantId = null, limit = 50, types = null, sources = null } = {}) {
      const q = String(query ?? '').trim().toLowerCase();

      const unavailable = [...coverage]
        .filter(([, s]) => s === 'unavailable' || s === 'incompatible')
        .map(([id]) => id)
        .sort();

      const degraded = [...coverage]
        .filter(([, s]) => ['stale', 'degraded', 'drifted'].includes(s))
        .map(([id]) => id)
        .sort();

      const complete = unavailable.length === 0 && degraded.length === 0;
      const coverageObj = Object.fromEntries(coverage);

      if (!q) {
        return freeze({
          query: q,
          complete,
          unavailable,
          coverage: coverageObj,
          results: []
        });
      }

      const qTokens = tokenize(q);

      const scored = [];
      for (const o of objects.values()) {
        if (tenantId && o.tenantId && o.tenantId !== tenantId) continue;
        if (types && !types.includes(o.type)) continue;
        if (sources && !sources.includes(o.sourceIntegration)) continue;

        const hay = searchable(o);
        const matches = qTokens.length === 0 || qTokens.some(tok => hay.includes(tok));
        if (!matches) continue;

        const score = scoreItem(o, q);
        if (score > 0) {
          scored.push({
            graphId: o.graphId,
            canonicalId: o.canonicalId,
            type: o.type,
            sourceIntegration: o.sourceIntegration,
            canonicalOwner: o.canonicalOwner,
            freshness: o.freshness ?? 'stale',
            sourceRevision: o.sourceRevision ?? 'pinned-head',
            tenantId: o.tenantId ?? null,
            payload: o.payload,
            score
          });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, Math.max(0, limit)).map(r => freeze(r));

      return freeze({
        query: q,
        complete,
        unavailable,
        coverage: coverageObj,
        results
      });
    }
  });
}
