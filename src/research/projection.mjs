import { createEnvelope } from '../federation/object-envelope.mjs';
import { projectResearchSnapshot, createIsrManifest } from '../integrations/isr.mjs';

export { projectResearchSnapshot, createIsrManifest };

export function projectClaim(claim, { freshness = 'stale', revision = 'runtime' } = {}) {
  if (!claim || !claim.id) throw new TypeError('valid claim with id required');
  return createEnvelope({
    sourceIntegration: 'isr',
    type: 'claim',
    canonicalId: String(claim.id),
    canonicalOwner: 'isr',
    status: claim.status ?? 'unknown',
    freshness,
    payload: structuredClone(claim),
    sourceRevision: revision,
    authority: [],
    evidence: (claim.evidenceIds ?? claim.evidence ?? []).map(String)
  });
}
