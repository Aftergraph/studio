// ponytail: lightweight frozen event envelope with standard schema validation
export function createEventEnvelope({
  id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  sourceIntegration,
  sourceRevision = 'pinned-head',
  type,
  occurredAt = new Date().toISOString(),
  sequence,
  objectRef = null,
  authorityDelta = null,
  evidenceRef = null,
  payload = {}
} = {}) {
  if (!sourceIntegration || typeof sourceIntegration !== 'string') {
    throw new TypeError('sourceIntegration required');
  }
  if (!type || typeof type !== 'string') {
    throw new TypeError('type required');
  }
  if (typeof sequence !== 'number' || !Number.isInteger(sequence)) {
    throw new TypeError('sequence integer required');
  }

  return Object.freeze({
    schema: 'aftergraph.event/v1',
    id: String(id),
    sourceIntegration: String(sourceIntegration),
    sourceRevision: String(sourceRevision),
    type: String(type),
    occurredAt: String(occurredAt),
    sequence,
    objectRef: objectRef ? String(objectRef) : null,
    authorityDelta: authorityDelta ? Object.freeze(structuredClone(authorityDelta)) : null,
    evidenceRef: evidenceRef ? String(evidenceRef) : null,
    payload: Object.freeze(structuredClone(payload))
  });
}

export function validateEventEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return false;
  return (
    envelope.schema === 'aftergraph.event/v1' &&
    typeof envelope.sourceIntegration === 'string' &&
    typeof envelope.type === 'string' &&
    Number.isInteger(envelope.sequence) &&
    typeof envelope.payload === 'object'
  );
}
