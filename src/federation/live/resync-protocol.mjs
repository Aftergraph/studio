// ponytail: sequence gap detector and authoritative resync coordinator preserving human state
export function createAuthoritativeResyncProtocol({
  registry,
  objects,
  evidence,
  getHumanState = () => null,
  fetchSnapshot = async () => ({})
} = {}) {
  const lastSequences = new Map();

  async function resyncEngine(integrationId) {
    const humanBefore = getHumanState();

    if (registry) {
      registry.setState(integrationId, 'stale', { reason: 'resyncing' });
    }

    const snapshot = await fetchSnapshot(integrationId);

    if (objects && Array.isArray(snapshot?.objects)) {
      for (const obj of snapshot.objects) {
        objects.upsert(obj);
      }
    }

    if (evidence && Array.isArray(snapshot?.evidence)) {
      for (const ev of snapshot.evidence) {
        evidence.registerEvidence(ev);
      }
    }

    const humanAfter = getHumanState();
    if (humanBefore && humanAfter && JSON.stringify(humanBefore) !== JSON.stringify(humanAfter)) {
      throw new Error(`Authoritative resync mutated human-owned client state for ${integrationId}`);
    }

    if (registry) {
      registry.setState(integrationId, 'current');
    }

    return Object.freeze({
      integrationId,
      resyncedAt: new Date().toISOString(),
      objectCount: snapshot?.objects?.length || 0,
      evidenceCount: snapshot?.evidence?.length || 0
    });
  }

  async function handleEvent(envelope) {
    if (!envelope?.sourceIntegration || typeof envelope.sequence !== 'number') {
      return false;
    }

    const id = envelope.sourceIntegration;
    const lastSeq = lastSequences.get(id) || 0;
    const expected = lastSeq + 1;

    // Sequence gap detected: missed intermediate events -> must trigger authoritative snapshot
    if (envelope.sequence > expected) {
      await resyncEngine(id);
      lastSequences.set(id, envelope.sequence);
      return true;
    }

    lastSequences.set(id, envelope.sequence);
    return true;
  }

  return Object.freeze({
    handleEvent,
    resyncEngine,
    getLastSequence(id) {
      return lastSequences.get(id) || 0;
    }
  });
}
