// ponytail: heartbeat and exact-head drift monitor ensuring only current un-drifted engines accept writes
export function createLiveHealthMonitor({
  registry,
  pinnedRevisions = {}
} = {}) {
  const healthStates = new Map();

  function resolvePinnedSha(id) {
    const entry = pinnedRevisions[id];
    if (!entry) return null;
    return typeof entry === 'string' ? entry : entry.sha;
  }

  return Object.freeze({
    recordHeartbeat(integrationId, { revision, status = 'ok' } = {}) {
      const pinned = resolvePinnedSha(integrationId);
      const isDrifted = Boolean(pinned && revision && pinned !== revision);
      const state = isDrifted ? 'drifted' : status === 'ok' ? 'current' : 'degraded';

      healthStates.set(integrationId, {
        state,
        revision,
        lastHeartbeat: Date.now(),
        isDrifted
      });

      if (registry) {
        registry.setState(
          integrationId,
          state,
          isDrifted ? { reason: 'exact-head drift', pinned, observed: revision } : null
        );
      }

      return healthStates.get(integrationId);
    },

    recordMissedHeartbeat(integrationId, missedCount = 1) {
      const state = missedCount >= 3 ? 'stale' : 'degraded';
      const existing = healthStates.get(integrationId) || {};
      healthStates.set(integrationId, {
        ...existing,
        state,
        missedCount
      });

      if (registry) {
        registry.setState(integrationId, state, { missedCount });
      }

      return healthStates.get(integrationId);
    },

    getHealth(integrationId) {
      const entry = healthStates.get(integrationId);
      const regEntry = registry?.get(integrationId);
      const state = entry?.state || regEntry?.state || 'stale';
      return {
        integrationId,
        state,
        revision: entry?.revision || null,
        isWriteSafe: state === 'current'
      };
    },

    isWriteSafe(integrationId) {
      const regWritable = registry ? registry.canWrite(integrationId) : true;
      const local = healthStates.get(integrationId);
      return regWritable && (!local || local.state === 'current');
    }
  });
}
