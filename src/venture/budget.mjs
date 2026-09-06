// V6.5 Venture OS — Budget Envelope
// Invariant: hard ceiling, exceeds blocks, expansion requires human approval

export class BudgetEnvelope {
  constructor({ id, allocation }) {
    if (!id) throw new Error('BudgetEnvelope requires id');
    if (typeof allocation !== 'number' || allocation < 0) {
      throw new Error('BudgetEnvelope requires numeric allocation');
    }
    
    this.id = id;
    this.allocation = allocation;
    this.consumption = 0;
    this.exceeded = false;
    this.expansions = [];
  }
  
  consume(amount) {
    if (this.exceeded) {
      throw new Error('Budget exceeded: consumption blocked');
    }
    
    this.consumption += amount;
    if (this.consumption > this.allocation) {
      this.exceeded = true;
    }
    
    return this.consumption;
  }
  
  expand(amount, options = {}) {
    if (!options.humanApproved) {
      throw new Error('Budget expansion requires human approval');
    }
    
    this.allocation += amount;
    this.exceeded = this.consumption > this.allocation;
    this.expansions.push({ amount, at: new Date().toISOString() });
    
    return this.allocation;
  }
  
  settle() {
    return {
      envelopeId: this.id,
      allocated: this.allocation,
      actual: this.consumption,
      variance: this.allocation - this.consumption,
      exceeded: this.exceeded,
      settledAt: new Date().toISOString()
    };
  }
}
