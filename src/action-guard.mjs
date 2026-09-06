// V81-016 — shared consequential-action guard.
// ponytail: in-memory idempotency is enough for one process; durable request
// keys belong to the canonical authority store when multi-node execution lands.
export const RESET_CONFIRMATION = 'RESET_WORKSPACE';

export function createActionGuard({ ttlMs = 5000, now = () => Date.now() } = {}) {
  const records = new Map();
  const expire = () => {
    const time = now();
    for (const [key, record] of records) if (record.expiresAt <= time) records.delete(key);
  };
  return Object.freeze({
    begin(key) {
      if (!key) throw new TypeError('idempotency key required');
      expire();
      const existing = records.get(key);
      if (existing) throw new Error(`duplicate consequential action: ${key}`);
      const record = { state: 'loading', expiresAt: now() + ttlMs };
      records.set(key, record);
      return { state: record.state };
    },
    complete(key, result) {
      const record = records.get(key);
      if (!record) throw new Error(`unknown action key: ${key}`);
      const next = { state: 'success', result };
      records.set(key, { ...next, expiresAt: record.expiresAt });
      return next;
    },
    fail(key, error) {
      records.delete(key);
      return { state: 'error', error: String(error || 'action_failed') };
    },
    replay(key) {
      const record = records.get(key);
      if (!record || record.state === 'loading') return null;
      const { state, result, error } = record;
      return state === 'success' ? { state, result } : { state, error };
    },
  });
}

export function assertActorCapability({ state, actor, capability }) {
  if (!actor || actor !== state?.user?.id) throw new Error('forbidden: actor identity mismatch');
  const capabilities = state.user.capabilities || [];
  if (!capabilities.includes('*') && !capabilities.includes(capability)) {
    throw new Error(`forbidden: missing capability ${capability}`);
  }
  return true;
}

export function requireResetConfirmation(token) {
  if (token !== RESET_CONFIRMATION) throw new Error('reset confirmation required');
  return true;
}
