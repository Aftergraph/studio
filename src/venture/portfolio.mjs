// V6.5 Venture OS — Portfolio (read-only, derived)
// Invariant: observation only, never authoritative

export class Portfolio {
  #cells = [];
  
  constructor() {
    this.authority = 'none';
    this.createdAt = new Date().toISOString();
  }
  
  get totalMissions() {
    return this.#cells.reduce((sum, cell) => sum + (cell.missions || 0), 0);
  }
  
  get totalCost() {
    return this.#cells.reduce((sum, cell) => sum + (cell.cost || 0), 0);
  }
  
  get cells() {
    return [...this.#cells];
  }
  
  addCell({ id, missions = 0, cost = 0, ...rest }) {
    if (!id) throw new Error('Portfolio cell requires id');
    this.#cells.push({ id, missions, cost, ...rest });
    return this;
  }
}
