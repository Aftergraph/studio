// ponytail: team delegation as one class over the V6.5 Workforce idiom
// (roster + verifier≠executor), plus an ordered handoff chain.
// No new roster primitive — EXTEND, not INVENT. Upgrade path: persistence.
export const TEAM_ROLES = Object.freeze(['executor', 'verifier', 'coordinator']);
export const HANDOFF_KINDS = Object.freeze(['delegated', 'executed', 'verified']);

export function recordHandoff({ kind, from, to, missionId, evidenceRef = null, verdict = null }) {
  if (!HANDOFF_KINDS.includes(kind)) throw new TypeError(`unknown handoff kind: ${kind}`);
  if (!from) throw new TypeError('handoff from required');
  if (!to) throw new TypeError('handoff to required');
  if (!missionId) throw new TypeError('handoff missionId required');
  return Object.freeze({
    kind, from: String(from), to: String(to), missionId: String(missionId),
    evidenceRef, verdict, authority: 'none', at: new Date().toISOString(),
  });
}

export class AgentTeam {
  #members = new Map();
  #handoffs = [];

  constructor({ id, cellId, workforceId }) {
    if (!id) throw new Error('AgentTeam requires id');
    if (!cellId) throw new Error('AgentTeam requires cellId');
    this.id = id;
    this.cellId = cellId;
    this.workforceId = workforceId ?? null;
    this.createdAt = new Date().toISOString();
  }

  static fromWorkforce({ id, cellId, workforce }) {
    const t = new AgentTeam({ id, cellId, workforceId: workforce?.id });
    for (const a of workforce?.roster ?? []) t.addMember({ id: a.id, role: a.role });
    return t;
  }

  addMember({ id, role }) {
    if (!id) throw new Error('member requires id');
    if (!TEAM_ROLES.includes(role)) throw new TypeError(`unknown team role: ${role}`);
    if (this.#members.has(id)) throw new Error(`duplicate member ${id}`);
    this.#members.set(id, { id, role });
    return id;
  }

  get members() {
    return [...this.#members.values()];
  }

  #requireMember(id, what) {
    if (!this.#members.has(id)) throw new Error(`${what} ${id} not a team member`);
    return this.#members.get(id);
  }

  changeRole({ agentId, newRole, approvedBy }) {
    if (!TEAM_ROLES.includes(newRole)) throw new TypeError(`unknown team role: ${newRole}`);
    this.#requireMember(agentId, 'agent');
    const approver = this.#requireMember(approvedBy, 'approver');
    // INVARIANT: no self-promotion — a coordinator or human must approve
    if (approvedBy === agentId) throw new Error('role change requires coordinator or human approval, not self-approval');
    if (approver.role !== 'coordinator' && !String(approvedBy).startsWith('human:')) {
      throw new Error('role change requires coordinator or human approval');
    }
    this.#members.set(agentId, { id: agentId, role: newRole });
  }

  delegate({ missionId, from, executorId, verifierId }) {
    const origin = this.#requireMember(from, 'delegation origin');
    if (origin.role !== 'coordinator') throw new Error('delegation requires coordinator origin');
    this.#requireMember(executorId, 'executor');
    this.#requireMember(verifierId, 'verifier');
    if (executorId === verifierId) throw new Error('verifier must differ from executor');
    if (!missionId) throw new TypeError('missionId required');
    const h = recordHandoff({ kind: 'delegated', from, to: executorId, missionId });
    this.#handoffs.push({ ...h, verifierId });
    return { missionId, from, executorId, verifierId, status: 'delegated' };
  }

  #chain(missionId) {
    return this.#handoffs.filter((h) => h.missionId === missionId);
  }

  chainFor(missionId) {
    return Object.freeze(this.#chain(missionId).map((h) => Object.freeze({ ...h })));
  }

  recordExecution({ missionId, by, evidenceRef }) {
    const chain = this.#chain(missionId);
    if (!chain.some((h) => h.kind === 'delegated')) throw new Error('execution requires prior delegation');
    const delegation = chain.find((h) => h.kind === 'delegated');
    if (by !== delegation.to) throw new Error(`execution must come from delegated executor ${delegation.to}`);
    if (!evidenceRef) throw new TypeError('evidenceRef required');
    this.#handoffs.push(recordHandoff({ kind: 'executed', from: by, to: delegation.verifierId, missionId, evidenceRef }));
  }

  recordVerification({ missionId, by, verdict }) {
    const chain = this.#chain(missionId);
    if (!chain.some((h) => h.kind === 'executed')) throw new Error('verification requires prior execution, out of order');
    const delegation = chain.find((h) => h.kind === 'delegated');
    if (by !== delegation.verifierId) throw new Error(`verification must come from assigned verifier ${delegation.verifierId}`);
    this.#handoffs.push(recordHandoff({ kind: 'verified', from: by, to: delegation.from, missionId, verdict }));
  }

  approveMission({ missionId, approver }) {
    // INVARIANT: agents never approve — only humans (mirrors V6.5 cell rule)
    if (!String(approver ?? '').startsWith('human:')) {
      throw new Error(`mission approval requires human approver, got ${approver}`);
    }
    return { missionId, approver, status: 'approved' };
  }

  topology() {
    return Object.freeze({
      teamId: this.id,
      cellId: this.cellId,
      authority: 'none',
      members: Object.freeze(this.members.map((m) => Object.freeze({ ...m }))),
      chains: this.#handoffs.length,
    });
  }
}
