// ponytail: minimal validation, no external deps
export function createGoal({ id, owner, successCriteria, budgetCents, horizonEnd, parentGoalId }) {
  if (!owner || typeof owner !== 'string' || owner.startsWith('agent:')) {
    throw new Error('goal_owner_must_be_human');
  }
  if (!Array.isArray(successCriteria) || successCriteria.length === 0) {
    throw new Error('goal_successCriteria_required');
  }
  for (const sc of successCriteria) {
    if (!sc || typeof sc.predicate !== 'string' || sc.predicate.trim() === '') {
      throw new Error('goal_successCriteria_predicate_required');
    }
  }
  if (
    typeof budgetCents !== 'number' ||
    !Number.isInteger(budgetCents) ||
    budgetCents < 0
  ) {
    throw new Error('goal_budgetCents_non_negative_integer');
  }
  const parsed = new Date(horizonEnd);
  if (isNaN(parsed.getTime()) || parsed <= new Date()) {
    throw new Error('goal_horizonEnd_future_iso');
  }

  const goal = Object.freeze({
    id,
    owner,
    successCriteria: Object.freeze(successCriteria.map((sc) => Object.freeze({ ...sc }))),
    budgetCents,
    horizonEnd,
    ...(parentGoalId !== undefined ? { parentGoalId } : {}),
  });
  return goal;
}
