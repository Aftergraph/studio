// V81-distributed-01 — node identity.
// ponytail: stable id, nothing else. Distributed routing/keys grow here when needed.
export function createNodeIdentity({ id = null } = {}) {
  const nodeId = id ?? `node_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return Object.freeze({
    id: String(nodeId),
    createdAt: new Date().toISOString(),
  });
}
