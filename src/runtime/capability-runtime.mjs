// ponytail: capability execution runtime with strict discovery!=grant enforcement, policy evaluation, and evidence registration
export function createCapabilityRuntime({
  registry,
  evidence,
  defaultExecutor = async (inputs) => ({ executed: true, inputs })
} = {}) {
  if (!registry) throw new TypeError('registry required');

  return Object.freeze({
    async executeCapability({
      capabilityId,
      subject,
      inputs = {},
      authorization = null,
      budgetContext = null,
      executor = null
    } = {}) {
      if (!capabilityId) throw new TypeError('capabilityId required');
      if (!subject) throw new TypeError('subject required');

      const cap = registry.get(capabilityId);
      if (!cap) {
        throw new Error(`capability_not_found: ${capabilityId}`);
      }

      // INVARIANT: Discovery != Grant
      const status = registry.grantStatus(subject, capabilityId);
      if (status !== 'granted') {
        throw new Error(`capability_not_granted: subject '${subject}' is not authorized to execute '${capabilityId}'`);
      }

      // Policy: Critical risk or explicit approval requirement
      if (cap.risk === 'critical' || cap.policy?.requiresApproval) {
        const isApproved = authorization && authorization.status === 'approved' && authorization.approvalId;
        if (!isApproved) {
          throw new Error(`authority_approval_required: capability '${capabilityId}' requires explicit trust-gateway approval`);
        }
      }

      // Policy: Budget constraints
      if (budgetContext) {
        const { availableBudget = 0, estimatedCost = 0 } = budgetContext;
        if (estimatedCost > availableBudget) {
          throw new Error(`capability_budget_exceeded: estimated cost ${estimatedCost} exceeds available budget ${availableBudget}`);
        }
      }

      // Execute capability
      const execFn = executor || defaultExecutor;
      const outputs = await execFn(inputs);

      // Record evidence in EvidenceGraph
      let evidenceRef = null;
      if (evidence) {
        evidenceRef = `ev_cap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        evidence.registerEvidence({
          id: evidenceRef,
          owner: cap.source || 'aftergraph',
          class: 'capability-execution',
          method: 'governed-runtime',
          freshness: 'current',
          status: 'verified',
          sourceRevision: cap.sourceRevision || 'pinned-head',
          payload: {
            capabilityId,
            subject,
            inputs: structuredClone(inputs),
            outputs: structuredClone(outputs),
            approvalId: authorization?.approvalId || null
          }
        });
      }

      return Object.freeze({
        ok: true,
        capabilityId,
        subject,
        outputs: Object.freeze(structuredClone(outputs)),
        evidenceRef,
        executedAt: new Date().toISOString()
      });
    }
  });
}
