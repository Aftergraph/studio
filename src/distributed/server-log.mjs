// V81-distributed-03 — server-side canonical sync log.
// ponytail: reuses offline-event-log merge (idempotent, first-writer-wins) +
// converge() total order for readback. Retried submits with the same
// idempotency key are normal sync retries, so reuse returns 200 with the
// converged log instead of 409 — event-id dedup is the idempotency mechanism.
import { createOfflineEventLog } from './offline-event-log.mjs';
import { converge } from './convergence.mjs';

export function validateSyncEvent(event) {
  const invalid = () => { const error = new Error('invalid_sync_event'); error.code = 'invalid_sync_event'; return error; };
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw invalid();
  for (const field of ['id', 'nodeId', 'type']) {
    if (!event[field] || typeof event[field] !== 'string') throw invalid();
  }
  if (event.payload !== undefined && (typeof event.payload !== 'object' || event.payload === null)) throw invalid();
  if (event.vectorClock !== undefined && (typeof event.vectorClock !== 'object' || event.vectorClock === null)) throw invalid();
  return true;
}

export function createServerLog() {
  const log = createOfflineEventLog({ nodeId: 'server' });

  function submit(events) {
    if (!Array.isArray(events)) throw validateSyncEvent(null);
    for (const event of events) validateSyncEvent(event);
    log.merge(events);
    return read();
  }

  function read() {
    return Object.freeze({
      events: converge(log.events(), []),
      clock: log.currentClock(),
    });
  }

  return Object.freeze({ submit, read });
}
