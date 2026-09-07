// V9 drift-monitor: pure assessment of goal health from linked missions.
// ponytail: pace uses an imminent-window heuristic (remaining < 7d and
// progress < 50) unless startedAt is supplied, in which case expected pace
// is linear elapsed/total. Server passes startedAt when goal records carry
// creation time; until then the heuristic is the documented ceiling.
const IMMINENT_MS = 7 * 24 * 3600 * 1000;

export function assessGoalDrift({ goal, missions = [], now = Date.now(), spentCents = 0, startedAt = null } = {}) {
  const reasons = [];
  if (!goal) throw new TypeError('goal required');
  const linked = missions.filter(m => m?.goalId === goal.id);
  const horizonMs = Date.parse(goal.horizonEnd);
  if (!Number.isFinite(horizonMs)) throw new TypeError('goal horizonEnd required');
  if (horizonMs <= now) {
    reasons.push('horizon passed with goal open');
  }
  if (!linked.length) {
    reasons.push('no linked missions carrying the goal');
  } else {
    const avg = linked.reduce((sum, m) => sum + (Number(m.progress) || 0), 0) / linked.length;
    const remaining = horizonMs - now;
    if (startedAt !== null && Number.isFinite(startedAt) && horizonMs > startedAt) {
      const expected = 100 * Math.min(1, Math.max(0, (now - startedAt) / (horizonMs - startedAt)));
      if (avg < expected - 15) reasons.push(`pace behind: ${avg.toFixed(0)}% vs ${expected.toFixed(0)}% expected`);
    } else if (remaining < IMMINENT_MS && avg < 50) {
      reasons.push(`pace behind: ${avg.toFixed(0)}% with under 7 days remaining`);
    }
  }
  if (Number.isFinite(spentCents) && Number.isInteger(goal.budgetCents) && spentCents > goal.budgetCents) {
    reasons.push(`budget overrun: ${spentCents}c spent of ${goal.budgetCents}c`);
  }
  return { goalId: goal.id, drifted: reasons.length > 0, reasons, linkedMissions: linked.length };
}
