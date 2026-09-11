const freezeRecord = value => Object.freeze(value);

const repoName = value => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.split('/').at(-1) || null;
};

export function auditInteractionOwnership({ topology = {}, orgState = {}, reviewedManifest = {} } = {}) {
  const topologyRepos = Array.isArray(topology.repositories) ? topology.repositories : [];
  const liveRepos = Array.isArray(orgState.repositories) ? orgState.repositories : [];
  const reviewedRepos = Object.values(reviewedManifest.repos || {});

  const live = new Map(liveRepos.map(entry => [repoName(entry.full_name), entry]).filter(([name]) => name));
  const reviewed = new Map(reviewedRepos.map(entry => [repoName(entry.repo), entry]).filter(([name]) => name));
  const repositories = {};

  for (const meta of topologyRepos) {
    const name = repoName(meta.name);
    if (!name) continue;
    const current = live.get(name);
    const prior = reviewed.get(name);
    const state = !prior || !current
      ? 'unreviewed'
      : prior.head === current.remote_head_sha ? 'current' : 'drifted';
    repositories[name] = freezeRecord({
      owner: meta.role ?? null,
      plane: meta.architecture_plane ?? null,
      state,
      currentHead: current?.remote_head_sha ?? null,
      reviewedHead: prior?.head ?? null,
    });
  }

  return freezeRecord({
    schema: 'aftergraph.interaction-ownership-audit/1.0',
    repositories: freezeRecord(repositories),
  });
}
