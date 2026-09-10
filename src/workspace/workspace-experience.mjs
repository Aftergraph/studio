// Studio workspace experience bound to the immutable tenant binding.
// HUMAN-GOVERNANCE-V1: workspace scope/binding owned by trust-gateway;
// studio owns layout, presence, experience state. Experience renders and
// organizes ONLY: mints no grants, keeps no ledger, changes no binding,
// never crosses tenants except via governed export/filter/new-identity/import.
import { deriveWorkspaceLayout } from '../workspace-shell.mjs';
import { derivePresence } from '../../packages/presence/index.mjs';

function assertTenantId(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('tenant binding required: tenantId must be a non-empty string');
  }
  return value;
}

export function freezeTenantBinding(binding) {
  if (!binding || typeof binding !== 'object') {
    throw new Error('tenant binding required: binding object with tenantId');
  }
  const tenantId = assertTenantId(binding.tenantId);
  const copy = { ...binding, tenantId };
  return Object.freeze(copy);
}

function checkSameTenant(entryTenantId, bindingTenantId, what) {
  if (entryTenantId !== undefined && entryTenantId !== null && String(entryTenantId) !== bindingTenantId) {
    throw new Error(`cross-tenant ${what} rejected: entry tenant ${String(entryTenantId)} != ${bindingTenantId}`);
  }
}

function scopePresence(list, tenantId) {
  return Object.freeze(
    list.map((entry) => Object.freeze({ ...entry, tenantId })),
  );
}

function scopeSurfaces(surfaces, tenantId) {
  if (!Array.isArray(surfaces)) throw new Error('surfaces must be an array');
  return Object.freeze(
    surfaces.map((surface) => {
      if (!surface || typeof surface !== 'object') throw new Error('surface must be an object');
      if (typeof surface.kind !== 'string' || surface.kind.trim() === '') {
        throw new Error('surface kind required');
      }
      checkSameTenant(surface.tenantId, tenantId, 'surface');
      return Object.freeze({ ...surface, tenantId });
    }),
  );
}

function deriveScopedLayout(layoutInput, tenantId) {
  const derived = deriveWorkspaceLayout({ ...(layoutInput ?? {}) });
  return Object.freeze({ ...derived, tenantId });
}

function deriveScopedPresence({ user, agents, followedAgentId }, tenantId) {
  if (user && typeof user === 'object') checkSameTenant(user.tenantId, tenantId, 'presence user');
  const list = Array.isArray(agents) ? agents : [];
  for (const agent of list) {
    if (agent && typeof agent === 'object') checkSameTenant(agent.tenantId, tenantId, 'presence agent');
  }
  const derived = derivePresence({ user: user ?? null, agents: list, followedAgentId: followedAgentId ?? null });
  return scopePresence(derived, tenantId);
}

export function createWorkspaceExperience({
  tenantBinding,
  layout = {},
  user = null,
  agents = [],
  followedAgentId = null,
  surfaces = [],
} = {}) {
  if (!tenantBinding || typeof tenantBinding !== 'object') {
    throw new Error('tenant binding required: pass the trust-gateway tenant binding');
  }
  const binding = freezeTenantBinding(tenantBinding);
  const tenantId = binding.tenantId;
  const scopedLayout = deriveScopedLayout(layout, tenantId);
  const scopedPresence = deriveScopedPresence({ user, agents, followedAgentId }, tenantId);
  const scopedSurfaces = scopeSurfaces(surfaces, tenantId);
  return Object.freeze({
    tenantBinding: binding,
    layout: scopedLayout,
    presence: scopedPresence,
    surfaces: scopedSurfaces,
  });
}

function assertExperience(experience) {
  if (!experience || typeof experience !== 'object' || !experience.tenantBinding) {
    throw new Error('workspace experience required');
  }
  const tenantId = assertTenantId(experience.tenantBinding.tenantId);
  if (experience.layout && experience.layout.tenantId !== undefined && experience.layout.tenantId !== tenantId) {
    throw new Error('cross-tenant layout rejected');
  }
  for (const entry of experience.presence ?? []) {
    if (entry?.tenantId !== tenantId) throw new Error('cross-tenant presence rejected');
  }
  for (const surface of experience.surfaces ?? []) {
    if (surface?.tenantId !== tenantId) throw new Error('cross-tenant surface rejected');
  }
  return tenantId;
}

export function renderWorkspaceExperience(experience) {
  const tenantId = assertExperience(experience);
  return Object.freeze({
    tenantId,
    layout: experience.layout,
    presence: experience.presence,
    surfaces: experience.surfaces,
  });
}

export function updateWorkspaceExperience(experience, patch = {}) {
  const tenantId = assertExperience(experience);
  if (!patch || typeof patch !== 'object') return experience;
  if ('tenantBinding' in patch || 'binding' in patch || 'tenantId' in patch) {
    throw new Error('binding mutation rejected: experience never changes the tenant binding');
  }
  let layout = experience.layout;
  let presence = experience.presence;
  let surfaces = experience.surfaces;
  if (patch.layout !== undefined) {
    layout = deriveScopedLayout(patch.layout ?? {}, tenantId);
  }
  if (patch.user !== undefined || patch.agents !== undefined || patch.followedAgentId !== undefined || patch.presence !== undefined) {
    if (patch.presence !== undefined) {
      if (!Array.isArray(patch.presence)) throw new Error('presence must be an array');
      for (const entry of patch.presence) checkSameTenant(entry?.tenantId, tenantId, 'presence');
      presence = scopePresence(patch.presence.map((entry) => ({ ...entry })), tenantId);
    } else {
      // Re-derive only when the caller supplies fresh inputs; otherwise keep scope.
      // Caller-supplied user/agents are validated against the binding tenant.
      const user = patch.user !== undefined ? patch.user : null;
      const agents = patch.agents !== undefined ? patch.agents : [];
      const followedAgentId = patch.followedAgentId !== undefined ? patch.followedAgentId : null;
      if (patch.user !== undefined || patch.agents !== undefined || patch.followedAgentId !== undefined) {
        presence = deriveScopedPresence({ user, agents, followedAgentId }, tenantId);
      }
    }
  }
  if (patch.surfaces !== undefined) {
    surfaces = scopeSurfaces(patch.surfaces, tenantId);
  }
  return Object.freeze({
    tenantBinding: experience.tenantBinding,
    layout,
    presence,
    surfaces,
  });
}

export function exportWorkspaceSnapshot(experience, { filter, exportedBy = 'unknown' } = {}) {
  const tenantId = assertExperience(experience);
  if (typeof filter !== 'function') {
    throw new Error('governed export requires a filter function (fail closed)');
  }
  const presence = Object.freeze((experience.presence ?? []).filter((entry) => filter(entry)));
  const surfaces = Object.freeze((experience.surfaces ?? []).filter((entry) => filter(entry)));
  const exportedAt = new Date().toISOString();
  return Object.freeze({
    kind: 'workspace-snapshot',
    tenantId,
    exportedAt,
    exportedBy,
    provenance: Object.freeze({
      fromTenant: tenantId,
      exportedAt,
      exportedBy,
      filter: 'custom',
    }),
    layout: experience.layout,
    presence,
    surfaces,
  });
}

export function importWorkspaceSnapshot(snapshot, { tenantBinding, newIdPrefix, identityMap } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.provenance?.fromTenant) {
    throw new Error('governed import requires snapshot provenance (fail closed)');
  }
  if (!tenantBinding || typeof tenantBinding !== 'object') {
    throw new Error('governed import requires a new tenant binding');
  }
  const binding = freezeTenantBinding(tenantBinding);
  const useMap = typeof identityMap === 'function'
    ? identityMap
    : (typeof newIdPrefix === 'string' && newIdPrefix.length > 0
      ? ((oldId) => `${newIdPrefix}${oldId}`)
      : null);
  if (!useMap) {
    throw new Error('governed import requires a new identity (identityMap or newIdPrefix)');
  }
  const reidentify = (entry) => {
    const copy = { ...entry, tenantId: binding.tenantId };
    if (copy.id !== undefined && copy.id !== null) {
      const oldId = String(copy.id);
      const mapped = useMap(oldId, entry);
      if (typeof mapped !== 'string' || mapped === '') {
        throw new Error('governed import requires a new identity for every id');
      }
      if (mapped === oldId) {
        throw new Error('governed import requires a new identity (id must change)');
      }
      copy.id = mapped;
    }
    return Object.freeze(copy);
  };
  const importedAt = new Date().toISOString();
  const layout = Object.freeze({ ...(snapshot.layout ?? {}), tenantId: binding.tenantId });
  return Object.freeze({
    tenantBinding: binding,
    layout,
    presence: Object.freeze((snapshot.presence ?? []).map(reidentify)),
    surfaces: Object.freeze((snapshot.surfaces ?? []).map(reidentify)),
    provenance: Object.freeze({
      importedFrom: snapshot.provenance.fromTenant,
      importedAt,
      newTenant: binding.tenantId,
    }),
  });
}
// Seam is explicit: no grants, no ledger, no binding mutation helpers.
