// V6.5 Venture OS — Mission Outcome
// Invariant: verifier ≠ executor (hard throw), verified requires verifier_id

export class MissionOutcome {
  constructor({ missionId, verdict, verifierId, executorId, evidenceRefs = [], costActual = 0 }) {
    if (!missionId) throw new Error('MissionOutcome requires missionId');
    if (!['success', 'partial', 'failed'].includes(verdict)) {
      throw new Error('MissionOutcome requires valid verdict (success/partial/failed)');
    }
    
    // Verified outcomes require a verifier
    if ((verdict === 'success' || verdict === 'partial') && !verifierId) {
      throw new Error('MissionOutcome: verifier required for verified outcomes');
    }
    
    // Verifier ≠ Executor — hard invariant
    if (executorId && verifierId && executorId === verifierId) {
      throw new Error('MissionOutcome: verifier must differ from executor');
    }
    
    this.missionId = missionId;
    this.verdict = verdict;
    this.verifierId = verifierId;
    this.executorId = executorId;
    this.evidenceRefs = evidenceRefs;
    this.costActual = costActual;
    this.sealedAt = new Date().toISOString();
    this.status = verdict === 'failed' ? 'recorded' : 'verified';
  }
  
  toJSON() {
    return {
      missionId: this.missionId,
      verdict: this.verdict,
      verifierId: this.verifierId,
      executorId: this.executorId,
      evidenceRefs: this.evidenceRefs,
      costActual: this.costActual,
      sealedAt: this.sealedAt,
      status: this.status
    };
  }
}
