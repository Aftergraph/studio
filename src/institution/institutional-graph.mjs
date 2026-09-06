// V8.0 Institutional Intelligence — tenant-scoped institutional graph.
// ponytail: one in-memory graph over Maps; persistence belongs to the canonical
// institutional owner when one is introduced. Projections never grant authority.

const ROLES = Object.freeze(['owner', 'operator', 'verifier', 'observer']);
const OPERATIONS = Object.freeze(['mission.execute', 'agent.assign', 'policy.read', 'evidence.read', 'organization.read']);
const EFFECTS = Object.freeze(['allow', 'deny']);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function clone(value) { return structuredClone(value); }

export class InstitutionalGraph {
  #organizations = new Map();
  #memberships = [];
  #policies = new Map();
  #relations = [];

  constructor({ id }) {
    if (!id) throw new TypeError('InstitutionalGraph requires id');
    this.id = String(id);
    this.createdAt = new Date().toISOString();
  }

  registerOrganization({ id, name, parentId = null }) {
    if (!id) throw new TypeError('organization requires id');
    if (!name) throw new TypeError('organization requires name');
    if (this.#organizations.has(id)) throw new Error(`duplicate organization: ${id}`);
    if (parentId && !this.#organizations.has(parentId)) throw new Error(`parent organization not found: ${parentId}`);
    this.#organizations.set(String(id), Object.freeze({ id: String(id), name: String(name), parentId: parentId ? String(parentId) : null }));
    return this.#organizations.get(String(id));
  }

  #organization(id) {
    const organization = this.#organizations.get(id);
    if (!organization) throw new Error(`organization not found: ${id}`);
    return organization;
  }

  addMembership({ organizationId, subjectId, role }) {
    this.#organization(organizationId);
    if (!subjectId) throw new TypeError('membership requires subjectId');
    if (!ROLES.includes(role)) throw new TypeError(`unknown membership role: ${role}`);
    if (this.#memberships.some(m => m.organizationId === organizationId && m.subjectId === subjectId)) {
      throw new Error(`duplicate membership: ${organizationId}/${subjectId}`);
    }
    const membership = Object.freeze({ organizationId: String(organizationId), subjectId: String(subjectId), role });
    this.#memberships.push(membership);
    return membership;
  }

  registerPolicy({ id, organizationId, operation, effect, approvedBy }) {
    this.#organization(organizationId);
    if (!id) throw new TypeError('policy requires id');
    if (!OPERATIONS.includes(operation)) throw new TypeError(`unknown policy operation: ${operation}`);
    if (!EFFECTS.includes(effect)) throw new TypeError(`unknown policy effect: ${effect}`);
    if (!String(approvedBy || '').startsWith('human:')) throw new Error('policy change requires human approval');
    if (this.#policies.has(id)) throw new Error(`duplicate policy: ${id}`);
    const policy = Object.freeze({ id: String(id), organizationId: String(organizationId), operation, effect, approvedBy: String(approvedBy), authority: 'none' });
    this.#policies.set(policy.id, policy);
    return policy;
  }

  authorize({ organizationId, subjectId, operation }) {
    if (!this.#organizations.has(organizationId) || !OPERATIONS.includes(operation)) return false;
    const member = this.#memberships.find(m => m.organizationId === organizationId && m.subjectId === subjectId);
    if (!member) return false;
    const policies = [...this.#policies.values()].filter(p => p.organizationId === organizationId && p.operation === operation);
    if (policies.some(p => p.effect === 'deny')) return false;
    return policies.some(p => p.effect === 'allow');
  }

  relate({ from, to, type }) {
    this.#organization(from);
    this.#organization(to);
    if (from !== to) throw new Error('cross-organization relation rejected');
    if (!type) throw new TypeError('relation requires type');
    const relation = Object.freeze({ from: String(from), to: String(to), type: String(type), authority: 'none' });
    this.#relations.push(relation);
    return relation;
  }

  membershipsFor(organizationId) {
    this.#organization(organizationId);
    return this.#memberships.filter(m => m.organizationId === organizationId).map(clone);
  }

  policiesFor(organizationId) {
    this.#organization(organizationId);
    return [...this.#policies.values()].filter(p => p.organizationId === organizationId).map(clone);
  }

  get relations() { return this.#relations.map(clone); }

  project(organizationId) {
    const organization = this.#organization(organizationId);
    return freeze({
      graphId: `${this.id}:organization:${organization.id}`,
      organization: clone(organization),
      memberships: this.membershipsFor(organizationId),
      policies: this.policiesFor(organizationId),
      relations: this.#relations.filter(r => r.from === organizationId && r.to === organizationId).map(clone),
      authority: 'none',
    });
  }
}

export { ROLES, OPERATIONS, EFFECTS };
