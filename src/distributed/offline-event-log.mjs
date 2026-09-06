// V81-distributed-01 — offline-first append-only event log.
// ponytail: in-memory append + idempotent merge by event id; durable storage
// and conflict resolution belong to a later slice, not this one.
import { createVectorClock, mergeVectorClocks } from './vector-clock.mjs';

export function createOfflineEventLog({ nodeId } = {}) {
  if (!nodeId || typeof nodeId !== 'string') throw new TypeError('nodeId required');
  const clock = createVectorClock();
  const byId = new Map();
  const order = [];

  function append({ type, payload = {}, id = null } = {}) {
    if (!type || typeof type !== 'string') throw new TypeError('event type required');
    const sequence = clock.increment(nodeId);
    const event = Object.freeze({
      id: id ?? `evt_${nodeId}_${sequence}_${Math.random().toString(36).slice(2, 8)}`,
      nodeId,
      type: String(type),
      payload: Object.freeze(structuredClone(payload)),
      vectorClock: clock.snapshot(),
      appendedAt: new Date().toISOString(),
    });
    if (byId.has(event.id)) return byId.get(event.id);
    byId.set(event.id, event);
    order.push(event.id);
    return event;
  }

  function merge(remoteEvents = []) {
    if (!Array.isArray(remoteEvents)) throw new TypeError('remote events must be an array');
    for (const remote of remoteEvents) {
      if (!remote || typeof remote !== 'object' || !remote.id) continue;
      if (byId.has(remote.id)) continue; // first writer wins — no authority leakage
      clock.merge(remote.vectorClock ?? {});
      const event = Object.freeze({
        id: String(remote.id),
        nodeId: String(remote.nodeId ?? 'unknown'),
        type: String(remote.type ?? 'unknown.event'),
        payload: Object.freeze(structuredClone(remote.payload ?? {})),
        vectorClock: Object.freeze({ ...(remote.vectorClock ?? {}) }),
        appendedAt: String(remote.appendedAt ?? new Date().toISOString()),
      });
      byId.set(event.id, event);
      order.push(event.id);
    }
    return events();
  }

  function events() {
    return Object.freeze(order.map(id => byId.get(id)));
  }

  function currentClock() {
    return clock.snapshot();
  }

  return Object.freeze({ nodeId, append, merge, events, currentClock });
}

export { mergeVectorClocks };
