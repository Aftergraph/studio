import { normalizeFederatedEvent } from './event-normalizer.mjs';

// ponytail: in-memory streaming adapter with backlog buffer and outage simulation
export function createLiveStreamAdapter({
  integrationId,
  sourceRevision = 'pinned-head'
} = {}) {
  let connectionStatus = 'connected';
  let seq = 0;
  const subscribers = new Set();
  const backlog = [];

  function emit(envelope) {
    for (const sub of subscribers) {
      try {
        sub(envelope);
      } catch (err) {
        console.error(`Error in live stream subscriber for ${integrationId}:`, err);
      }
    }
  }

  return Object.freeze({
    integrationId,
    status() {
      return connectionStatus;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    publish(rawEvent) {
      if (connectionStatus !== 'connected') {
        backlog.push(rawEvent);
        return null;
      }
      seq += 1;
      const envelope = normalizeFederatedEvent({
        sourceIntegration: integrationId,
        sourceRevision,
        sequence: seq,
        rawEvent
      });
      emit(envelope);
      return envelope;
    },
    simulateOutage(reason = 'outage') {
      connectionStatus = 'unavailable';
    },
    bufferOffline(rawEvent) {
      backlog.push(rawEvent);
    },
    simulateRecovery() {
      connectionStatus = 'connected';
      while (backlog.length > 0) {
        const rawEvent = backlog.shift();
        seq += 1;
        const envelope = normalizeFederatedEvent({
          sourceIntegration: integrationId,
          sourceRevision,
          sequence: seq,
          rawEvent
        });
        emit(envelope);
      }
    }
  });
}
