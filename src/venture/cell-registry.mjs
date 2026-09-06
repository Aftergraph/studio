// V6.5 Venture OS — Product Cell Registry
// Invariant: mission creation requires human approval

export class ProductCell {
  #missions = [];
  
  constructor({ id, goal, status, budgetEnvelopeId, workforceId }) {
    if (!id) throw new Error('ProductCell requires id');
    if (!goal) throw new Error('ProductCell requires goal');
    if (!status) throw new Error('ProductCell requires status');
    
    this.id = id;
    this.goal = goal;
    this.status = status;
    this.budgetEnvelopeId = budgetEnvelopeId;
    this.workforceId = workforceId;
    this.createdAt = new Date().toISOString();
  }
  
  createMission({ id, title, humanApproved, ...rest }) {
    if (!humanApproved) {
      throw new Error('Mission creation requires human approval');
    }
    
    const mission = {
      id,
      title,
      cellId: this.id,
      status: 'approved',
      humanApproved: true,
      createdAt: new Date().toISOString(),
      ...rest
    };
    
    this.#missions.push(mission);
    return mission;
  }
  
  get missions() {
    return [...this.#missions];
  }
}

export class CellRegistry {
  #cells = new Map();
  
  register(cell) {
    if (!(cell instanceof ProductCell)) {
      throw new Error('Can only register ProductCell instances');
    }
    this.#cells.set(cell.id, cell);
    return cell;
  }
  
  get(id) {
    return this.#cells.get(id);
  }
  
  list() {
    return Array.from(this.#cells.values());
  }
}
