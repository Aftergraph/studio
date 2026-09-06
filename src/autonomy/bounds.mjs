// V83-autonomy-01 — kill switch + bounded allowance.
// ponytail: pure frozen records over the V7.4 CostLedger; human-check is the
// same naming convention as V8.2 (real identity belongs to V8.0 institutions).
const isHuman = by => typeof by === 'string' && by.length > 0 && !by.startsWith('agent:');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

export function createKillSwitch({ id, scope } = {}) {
  if (!id || typeof id !== 'string') throw new TypeError('kill switch id required');
  if (!scope || typeof scope !== 'string') throw new TypeError('kill switch scope required');
  return freeze({ id, scope, engaged: false, history: [] });
}

function humanOnly(by, verb) {
  if (!isHuman(by)) { const error = new Error(`kill switch ${verb} requires a human`); error.code = 'kill_not_human'; throw error; }
}

export function engageKill(sw, { by, reason } = {}) {
  if (!sw || typeof sw !== 'object') throw new TypeError('kill switch required');
  humanOnly(by, 'engage');
  if (!reason || typeof reason !== 'string') throw new TypeError('engage reason required');
  return freeze({ ...sw, engaged: true, history: [...sw.history, { action: 'engage', by, reason, at: new Date().toISOString() }] });
}

export function releaseKill(sw, { by } = {}) {
  if (!sw || typeof sw !== 'object') throw new TypeError('kill switch required');
  humanOnly(by, 'release');
  return freeze({ ...sw, engaged: false, history: [...sw.history, { action: 'release', by, at: new Date().toISOString() }] });
}

export function assertAutonomyAllowed({ killSwitch, ledger, missionId, budgetCents, policyOk = true, evidenceRef = null } = {}) {
  if (killSwitch?.engaged) { const error = new Error('autonomy_killed: kill switch engaged'); error.code = 'autonomy_killed'; throw error; }
  if (!ledger || typeof ledger.totalFor !== 'function') throw new TypeError('cost ledger required');
  if (!missionId) throw new TypeError('missionId required');
  if (!Number.isInteger(budgetCents) || budgetCents < 0) throw new TypeError('budgetCents must be a non-negative integer');
  const spentCents = ledger.totalFor(missionId);
  if (spentCents >= budgetCents) {
    const error = new Error('autonomy_budget_exhausted: overrun requires human approval');
    error.code = 'autonomy_budget_exhausted';
    throw error;
  }
  if (policyOk !== true) { const error = new Error('autonomy_policy_denied'); error.code = 'autonomy_policy_denied'; throw error; }
  return freeze({ allowed: true, spentCents, remainingCents: budgetCents - spentCents, evidenceRef });
}
