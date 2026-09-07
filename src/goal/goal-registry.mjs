// ponytail: in-memory map, no persistence yet
export function createGoalRegistry() {
  const store = new Map();

  return Object.freeze({
    register(goal) {
      if (store.has(goal.id)) throw new Error('goal_duplicate_id');
      store.set(goal.id, goal);
      return goal;
    },
    get(id) {
      return store.get(id);
    },
    list() {
      return [...store.values()];
    },
    revise(id, { changes, approvedBy }) {
      if (!approvedBy || typeof approvedBy !== 'string' || approvedBy.startsWith('agent:')) {
        throw new Error('goal_revise_approvedBy_must_be_human');
      }
      const current = store.get(id);
      if (!current) throw new Error('goal_not_found');

      const updatedFields = { ...current, ...changes };
      const entry = Object.freeze({
        at: new Date().toISOString(),
        approvedBy,
        changes: Object.freeze({ ...changes }),
      });
      const history = Object.freeze([...(current.history || []), entry]);
      const revised = Object.freeze({ ...updatedFields, history });
      store.set(id, revised);
      return revised;
    },
    retire(id, { by, reason }) {
      if (!by || typeof by !== 'string' || by.startsWith('agent:')) {
        throw new Error('goal_retire_by_must_be_human');
      }
      if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        throw new Error('goal_retire_reason_required');
      }
      const current = store.get(id);
      if (!current) throw new Error('goal_not_found');

      const retired = Object.freeze({
        ...current,
        retired: true,
        retiredBy: by,
        retireReason: reason,
      });
      store.set(id, retired);
      return retired;
    },
  });
}
