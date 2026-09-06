// V6.5 Venture OS — Workforce
// Invariants: verifier ≠ executor, no self-assign, frozen roster

export class Workforce {
  #roster = new Map();
  #assignments = [];
  #frozen = false;
  
  constructor({ id }) {
    if (!id) throw new Error('Workforce requires id');
    this.id = id;
    this.createdAt = new Date().toISOString();
  }
  
  addAgent({ id, role, name }) {
    if (this.#frozen) {
      throw new Error('Workforce roster is frozen');
    }
    if (!id) throw new Error('Agent requires id');
    
    this.#roster.set(id, { id, role, name });
    return id;
  }
  
  freeze() {
    this.#frozen = true;
  }
  
  get roster() {
    return Array.from(this.#roster.values());
  }
  
  get assignments() {
    return [...this.#assignments];
  }
  
  assign({ missionId, executorId, verifierId, selfAssigned = false }) {
    if (selfAssigned) {
      throw new Error('Agent self-assign is not allowed');
    }
    
    if (!this.#roster.has(executorId)) {
      throw new Error(`Executor ${executorId} not in roster`);
    }
    
    if (!this.#roster.has(verifierId)) {
      throw new Error(`Verifier ${verifierId} not in roster`);
    }
    
    if (executorId === verifierId) {
      throw new Error('Verifier must differ from executor');
    }
    
    const assignment = {
      missionId,
      executorId,
      verifierId,
      assignedAt: new Date().toISOString(),
      status: 'assigned'
    };
    
    this.#assignments.push(assignment);
    return assignment;
  }
}
