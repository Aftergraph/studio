// V81-distributed-04 — offline-first client: local-first truth + background sync.
// ponytail: thin wrapper over offline-event-log; the server's converged log is
// the only remote authority, and failed sync never touches local truth.
import { createOfflineEventLog } from './offline-event-log.mjs';
import { converge } from './convergence.mjs';

export function createOfflineClient({ nodeId, api, actor = 'demo-user', onChange = () => {} } = {}) {
  if (!nodeId || typeof nodeId !== 'string') throw new TypeError('nodeId required');
  if (!api || typeof api.submitSync !== 'function') throw new TypeError('api with submitSync required');
  const log = createOfflineEventLog({ nodeId });
  const acked = new Set();

  function append({ type, payload = {}, id = null } = {}) {
    const event = log.append({ type, payload, id });
    onChange(events());
    return event;
  }

  function events() {
    return converge(log.events(), []);
  }

  function pendingCount() {
    return log.events().filter(event => !acked.has(event.id)).length;
  }

  async function sync({ idempotencyKey = `sync-${nodeId}-${Date.now()}` } = {}) {
    let response;
    try {
      response = await api.submitSync({ actor, nodeId, events: log.events(), idempotencyKey });
    } catch {
      return { synced: false, pending: pendingCount() };
    }
    log.merge(response?.events ?? []);
    for (const event of response?.events ?? []) acked.add(event.id);
    onChange(events());
    return { synced: true, pending: pendingCount(), clock: response?.clock ?? {} };
  }

  return Object.freeze({ nodeId, append, events, pendingCount, sync });
}
