import test from 'node:test';
import assert from 'node:assert/strict';
import { createFederatedIndex } from '../src/search/federated-index.mjs';
import { createContextResolver } from '../src/search/context-resolver.mjs';
import { createObjectGraph } from '../src/federation/object-graph.mjs';
import { createEvidenceGraph } from '../src/federation/evidence-graph.mjs';
import { createEnvelope } from '../src/federation/object-envelope.mjs';
import { createIntegrationRegistry } from '../src/federation/integration-registry.mjs';

function mockObject({ id, type, source, payload = {}, freshness = 'current', tenantId = null, revision = 'rev-1' }) {
  return createEnvelope({
    sourceIntegration: source,
    type,
    canonicalId: String(id),
    canonicalOwner: source,
    tenantId,
    status: 'active',
    freshness,
    payload,
    sourceRevision: revision,
    authority: [{ owner: source, operations: ['read'] }],
    evidence: []
  });
}

test('Universal Search: indexes and searches all 8 canonical object families with full provenance', () => {
  const index = createFederatedIndex();

  const families = [
    { type: 'work', source: 'works', id: 'w-1', payload: { title: 'Deploy Distributed Cluster' } },
    { type: 'research_program', source: 'isr', id: 'rp-2', payload: { title: 'Distributed Cluster Latency Study' } },
    { type: 'agent', source: 'avc', id: 'ag-3', payload: { name: 'Cluster Hermes Worker' } },
    { type: 'evidence', source: 'isr', id: 'ev-4', payload: { title: 'Benchmark Latency Cluster Evidence', method: 'empirical' } },
    { type: 'memory', source: 'works', id: 'mem-5', payload: { title: 'Cluster Failover Decision Note' } },
    { type: 'repository', source: 'governance', id: 'repo-6', payload: { title: 'Cluster Infrastructure Repository' } },
    { type: 'artifact', source: 'works', id: 'art-7', payload: { filename: 'cluster-config.yaml' } },
    { type: 'decision', source: 'trust-gateway', id: 'dec-8', payload: { title: 'Approve Cluster Rollout' } }
  ];

  for (const f of families) {
    index.index(mockObject(f));
  }

  // Query for 'cluster' matches all 8 families
  const searchResult = index.search('cluster');
  assert.equal(searchResult.results.length, 8, 'All 8 families must be indexed and searchable');

  // Verify deep provenance on every result
  for (const item of searchResult.results) {
    assert.ok(item.graphId, 'graphId required');
    assert.ok(item.canonicalId, 'canonicalId required');
    assert.ok(item.type, 'type required');
    assert.ok(item.sourceIntegration, 'sourceIntegration required');
    assert.ok(item.canonicalOwner, 'canonicalOwner required');
    assert.ok(item.freshness, 'freshness required');
    assert.ok(item.sourceRevision, 'sourceRevision required');
    assert.ok(typeof item.score === 'number' && item.score > 0, 'score must be positive number');
  }
});

test('Universal Search: multi-token ranking prioritizes exact match and fresh over stale objects', () => {
  const index = createFederatedIndex();

  // Three items with different match quality and freshness
  index.index(mockObject({ id: '1', type: 'work', source: 'works', payload: { title: 'API Gateway Deploy' }, freshness: 'current' }));
  index.index(mockObject({ id: '2', type: 'work', source: 'works', payload: { title: 'API Gateway Deploy' }, freshness: 'stale' }));
  index.index(mockObject({ id: '3', type: 'work', source: 'works', payload: { title: 'General Gateway Documentation' }, freshness: 'current' }));

  const res = index.search('API Gateway Deploy');
  assert.equal(res.results.length, 3);
  // Item 1 (exact + current) must rank higher than Item 2 (exact + stale)
  assert.equal(res.results[0].canonicalId, '1');
  assert.equal(res.results[1].canonicalId, '2');
  assert.ok(res.results[0].score > res.results[1].score, 'Current item must score higher than stale item');
});

test('Universal Search: incomplete-result semantics under single, multiple, and total upstream outages', () => {
  const index = createFederatedIndex();
  index.setCoverage('works', 'current');
  index.setCoverage('trust-gateway', 'current');
  index.setCoverage('isr', 'current');

  index.index(mockObject({ id: 'w1', type: 'work', source: 'works', payload: { title: 'Alpha Mission' } }));
  index.index(mockObject({ id: 'r1', type: 'research_program', source: 'isr', payload: { title: 'Alpha Research' } }));

  // 1. All healthy
  const healthy = index.search('alpha');
  assert.equal(healthy.complete, true);
  assert.deepEqual(healthy.unavailable, []);
  assert.equal(healthy.results.length, 2);

  // 2. Single outage: isr goes unavailable
  index.setCoverage('isr', 'unavailable');
  const singleOutage = index.search('alpha');
  assert.equal(singleOutage.complete, false, 'Search must declare incomplete when an engine is down');
  assert.deepEqual(singleOutage.unavailable, ['isr']);
  assert.equal(singleOutage.coverage['isr'], 'unavailable');
  assert.equal(singleOutage.coverage['works'], 'current');

  // 3. Multiple outages: works also degraded
  index.setCoverage('works', 'degraded');
  const multiOutage = index.search('alpha');
  assert.equal(multiOutage.complete, false);
  assert.ok(multiOutage.unavailable.includes('isr'));
  assert.equal(multiOutage.coverage['works'], 'degraded');

  // 4. Total outage
  index.setCoverage('trust-gateway', 'unavailable');
  index.setCoverage('works', 'unavailable');
  const totalOutage = index.search('alpha');
  assert.equal(totalOutage.complete, false);
  assert.equal(totalOutage.unavailable.length, 3);
});

test('ContextResolver: resolves focal neighborhood, evidence, decisions, and preserves zero-authority invariant', async () => {
  const objects = createObjectGraph();
  const evidence = createEvidenceGraph();
  const registry = createIntegrationRegistry();

  registry.register({
    schema: 'aftergraph.integration/v1',
    id: 'works',
    repository: 'Aftergraph/works',
    integrationVersion: '1',
    repositoryRevision: 'sha-w',
    roles: ['execution'],
    objects: ['work'],
    relations: [],
    capabilities: [],
    surfaces: ['work'],
    events: [],
    reads: ['work'],
    writes: ['cancel'],
    authority: [{ owner: 'works', operations: ['cancel'] }],
    evidence: [],
    health: { kind: 'test' },
    degradedBehavior: { reads: 'stale', writes: 'block' },
    compatibility: { mode: 'exact-or-declared', supported: ['1.x'] }
  });
  registry.setState('works', 'current');

  // Create focal work object
  const workObj = mockObject({ id: 'work-100', type: 'work', source: 'works', payload: { title: 'Payment Pipeline Build' }, tenantId: 'tenant-acme' });
  // Create agent object
  const agentObj = mockObject({ id: 'agent-200', type: 'agent', source: 'works', payload: { name: 'Hermes-Worker-1' }, tenantId: 'tenant-acme' });

  objects.upsert(workObj);
  objects.upsert(agentObj);
  objects.relate({
    from: 'works:work:work-100',
    to: 'works:agent:agent-200',
    type: 'assigned_to',
    sourceIntegration: 'works'
  });

  // Attach evidence
  evidence.registerEvidence({
    id: 'ev-test-1',
    owner: 'works',
    class: 'execution',
    method: 'automated-test',
    freshness: 'current',
    status: 'verified',
    sourceRevision: 'sha-w',
    payload: { testPassRate: 1.0 }
  });
  evidence.linkEvidence('works:work:work-100', 'ev-test-1');

  const resolver = createContextResolver({
    objects,
    evidence,
    registry
  });

  const context = await resolver.resolveContext({
    focalId: 'works:work:work-100',
    tenantId: 'tenant-acme'
  });

  assert.ok(context.focal, 'Focal object must resolve');
  assert.equal(context.focal.graphId, 'works:work:work-100');
  assert.equal(context.neighbors.length, 1, 'Assigned agent neighbor must be included');
  assert.equal(context.neighbors[0].graphId, 'works:agent:agent-200');

  // Invariant: Context assembly NEVER grants authority
  assert.equal(context.authority, 'none', 'Context assembly must carry authority: none');
  assert.equal(context.complete, true);
  assert.equal(context.tenantId, 'tenant-acme');
});

test('ContextResolver: strict tenant isolation fails closed and prevents cross-tenant leakage', async () => {
  const objects = createObjectGraph();
  const evidence = createEvidenceGraph();
  const registry = createIntegrationRegistry();

  const objA = mockObject({ id: 'a1', type: 'work', source: 'works', payload: { title: 'Org A Secret' }, tenantId: 'tenant-a' });
  objects.upsert(objA);

  const resolver = createContextResolver({ objects, evidence, registry });

  // Attempting to resolve tenant-a object from tenant-b context fails closed
  await assert.rejects(
    () => resolver.resolveContext({ focalId: 'works:work:a1', tenantId: 'tenant-b' }),
    /tenant_isolation_violation/
  );
});

test('EXIT GATE: Full search provenance and incomplete-result semantics under all outage combinations', () => {
  const index = createFederatedIndex();
  const coreEngines = ['works', 'trust-gateway', 'isr', 'avc', 'aie', 'skills-vault', 'governance'];

  for (const eng of coreEngines) {
    index.setCoverage(eng, 'current');
    index.index(mockObject({ id: `item-${eng}`, type: 'item', source: eng, payload: { queryTerm: 'core-audit' } }));
  }

  // 1. Initial complete state
  const initial = index.search('core-audit');
  assert.equal(initial.complete, true);
  assert.equal(initial.results.length, coreEngines.length);

  // 2. Test every engine independently failing
  for (const failedEng of coreEngines) {
    index.setCoverage(failedEng, 'unavailable');
    const res = index.search('core-audit');
    assert.equal(res.complete, false, `Must report incomplete when ${failedEng} is unavailable`);
    assert.ok(res.unavailable.includes(failedEng), `Must list ${failedEng} in unavailable list`);

    // Verify all returned results still carry exact provenance
    for (const item of res.results) {
      assert.ok(item.sourceIntegration);
      assert.ok(item.freshness);
      assert.ok(item.sourceRevision);
    }

    // Restore
    index.setCoverage(failedEng, 'current');
  }
});
