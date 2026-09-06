// ponytail: context resolver traversing object graph & evidence with strict tenant isolation and authority=none
export function createContextResolver({
  objects,
  evidence,
  registry
} = {}) {
  if (!objects) throw new TypeError('objects graph required');

  return Object.freeze({
    async resolveContext({ focalId, tenantId = null } = {}) {
      if (!focalId) throw new TypeError('focalId required');

      const focal = objects.get(focalId);
      if (!focal) {
        throw new Error(`focal_object_not_found: ${focalId}`);
      }

      // Tenant isolation: fail closed if tenant mismatch
      if (tenantId && focal.tenantId && focal.tenantId !== tenantId) {
        throw new Error(`tenant_isolation_violation: object tenant ${focal.tenantId} != query tenant ${tenantId}`);
      }

      // Graph neighborhood (1st degree)
      const rawNeighbors = objects.neighbors ? objects.neighbors(focalId) : [];
      const neighbors = [];

      for (const n of rawNeighbors) {
        // Enforce tenant containment on neighbors
        if (tenantId && n.tenantId && n.tenantId !== tenantId) {
          throw new Error(`tenant_isolation_violation: neighbor tenant ${n.tenantId} != query tenant ${tenantId}`);
        }
        neighbors.push(n);
      }

      // Associated evidence
      const linkedEvidence = evidence?.evidenceFor ? evidence.evidenceFor(focalId) : [];

      // Check source coverage
      const involvedSources = new Set([
        focal.sourceIntegration,
        ...neighbors.map(n => n.sourceIntegration)
      ]);

      const coverage = {};
      let isComplete = true;

      for (const src of involvedSources) {
        const state = registry?.get?.(src)?.state || 'current';
        coverage[src] = state;
        if (state !== 'current') {
          isComplete = false;
        }
      }

      return Object.freeze({
        focal,
        neighbors: Object.freeze(neighbors),
        evidence: Object.freeze(linkedEvidence),
        decisions: Object.freeze([]),
        tenantId: tenantId || focal.tenantId || null,
        complete: isComplete,
        coverage: Object.freeze(coverage),
        // INVARIANT: Context resolution NEVER grants authority
        authority: 'none'
      });
    }
  });
}
