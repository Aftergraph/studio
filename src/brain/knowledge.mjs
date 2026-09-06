// V82-brain-01 — knowledge lifecycle: provenance, retention, confidence, promotion.
// ponytail: pure frozen records; human-check is a naming convention
// (non-`agent:` actor), real identity belongs to the institutional graph.
export const PROMOTION_CONFIDENCE_THRESHOLD = 0.5;

const isHuman = by => typeof by === 'string' && by.length > 0 && !by.startsWith('agent:');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function createKnowledgeEntry({
  id = null, scope, label, value, source, confidence = 0, retentionMs = null, createdBy = 'system',
} = {}) {
  if (!scope || typeof scope !== 'string') throw new TypeError('scope required');
  if (!label || typeof label !== 'string') throw new TypeError('label required');
  if (value === undefined) throw new TypeError('value required');
  if (!source || typeof source !== 'string') throw new TypeError('source required');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError('confidence must be a number in 0..1');
  }
  if (retentionMs !== null && (!Number.isFinite(retentionMs) || retentionMs <= 0)) {
    throw new RangeError('retentionMs must be a positive duration or null');
  }
  const createdAt = new Date().toISOString();
  return freeze({
    id: id ?? `kn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    scope, label, value: structuredClone(value), source, confidence,
    status: 'ephemeral',
    retention: retentionMs === null ? freeze({ expires: false }) : freeze({
      expires: true,
      expiresAt: new Date(Date.parse(createdAt) + retentionMs).toISOString(),
    }),
    provenance: { source, createdAt, createdBy, promotions: [] },
  });
}

export function isExpired(entry, nowIso = new Date().toISOString()) {
  if (!entry?.retention?.expires) return false;
  return Date.parse(nowIso) >= Date.parse(entry.retention.expiresAt);
}

export function isAuthoritative(entry, nowIso = new Date().toISOString()) {
  if (!entry || entry.status !== 'authoritative') return false;
  return !isExpired(entry, nowIso);
}

export function promoteKnowledge(entry, { by, evidence, override = false } = {}) {
  if (!entry || typeof entry !== 'object' || entry.status !== 'ephemeral') {
    throw new Error('only ephemeral entries can be promoted');
  }
  if (!isHuman(by)) { const error = new Error('promotion requires a human approver'); error.code = 'promotion_not_human'; throw error; }
  if (!evidence || typeof evidence !== 'string') { const error = new Error('promotion requires evidence'); error.code = 'promotion_evidence_required'; throw error; }
  if (entry.confidence < PROMOTION_CONFIDENCE_THRESHOLD && override !== true) {
    const error = new Error('low confidence promotion requires explicit override'); error.code = 'promotion_override_required'; throw error;
  }
  return freeze({
    ...structuredClone(entry),
    status: 'authoritative',
    provenance: freeze({
      ...structuredClone(entry.provenance),
      promotions: [...entry.provenance.promotions, {
        by, evidence, override: entry.confidence < PROMOTION_CONFIDENCE_THRESHOLD,
        at: new Date().toISOString(),
      }],
    }),
  });
}
