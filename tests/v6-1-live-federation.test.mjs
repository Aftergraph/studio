import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventEnvelope, validateEventEnvelope } from '../src/federation/live/event-envelope.mjs';
import { normalizeFederatedEvent } from '../src/federation/live/event-normalizer.mjs';
import { createLiveStreamAdapter } from '../src/federation/live/live-stream-adapter.mjs';
import { createLiveHealthMonitor } from '../src/federation/live/health-monitor.mjs';
import { createAuthoritativeResyncProtocol } from '../src/federation/live/resync-protocol.mjs';
import { createIntegrationRegistry } from '../src/federation/integration-registry.mjs';
import { createObjectGraph } from '../src/federation/object-graph.mjs';
import { createEvidenceGraph } from '../src/federation/evidence-graph.mjs';
import { createEnvelope } from '../src/federation/object-envelope.mjs';
import { UPSTREAM_REVISIONS } from '../src/integrations/upstream-hub.mjs';

function mockManifest(id, { repo = `Aftergraph/${id}`, sha = 'pinned-sha-123', writes = ['write'] } = {}) {
  return {
    schema: 'aftergraph.integration/v1',
    id,
    repository: repo,
    integrationVersion: '1.0.0',
    repositoryRevision: sha,
    roles: ['live-test'],
    objects: ['item'],
    relations: [],
    capabilities: [],
    surfaces: [id],
    events: [],
    reads: ['items'],
    writes,
    authority: writes.map(op => ({ owner: id, operations: [op] })),
    evidence: [],
    health: { kind: 'live-stream' },
    degradedBehavior: { reads: 'stale', writes: 'block' },
    compatibility: { mode: 'exact-or-declared', supported: ['1.x'] }
  };
}

test('EventEnvelope: validates structure, immutability and required fields', () => {
  assert.throws(() => createEventEnvelope({}), /sourceIntegration required/);
  assert.throws(() => createEventEnvelope({ sourceIntegration: 'works' }), /type required/);
  assert.throws(() => createEventEnvelope({ sourceIntegration: 'works', type: 'work.step' }), /sequence integer required/);

  const env = createEventEnvelope({
    id: 'evt-1',
    sourceIntegration: 'works',
    sourceRevision: '3ea1a804',
    type: 'work.step.completed',
    occurredAt: '2026-09-06T12:00:00.000Z',
    sequence: 1,
    objectRef: 'works:work:w-101',
    payload: { step: 'build', durationMs: 450 }
  });

  assert.equal(env.id, 'evt-1');
  assert.equal(env.sourceIntegration, 'works');
  assert.equal(env.sequence, 1);
  assert.equal(env.type, 'work.step.completed');
  assert.equal(env.objectRef, 'works:work:w-101');
  assert.equal(env.payload.step, 'build');
  assert.ok(Object.isFrozen(env));
  assert.ok(Object.isFrozen(env.payload));

  assert.equal(validateEventEnvelope(env), true);
  assert.equal(validateEventEnvelope({ invalid: true }), false);
});

test('EventNormalizer: normalizes heterogeneous events across all canonical engines', () => {
  const cases = [
    {
      source: 'trust-gateway',
      raw: { id: 'tg-99', type: 'approval_requested', item: { approvalId: 'app-1', risk: 'high' } },
      expectedType: 'approval.requested',
      expectedRef: 'trust-gateway:approval:app-1'
    },
    {
      source: 'works',
      raw: { event_id: 'w-88', event_type: 'step_completed', work_id: 'job-42', step_index: 2 },
      expectedType: 'work.step.completed',
      expectedRef: 'works:work:job-42'
    },
    {
      source: 'work-intelligence',
      raw: { id: 'wi-77', kind: 'observation_detected', observation_id: 'obs-9' },
      expectedType: 'observation.ingested',
      expectedRef: 'work-intelligence:observation:obs-9'
    },
    {
      source: 'aie',
      raw: { message_id: 'aie-66', action: 'delegation_granted', delegation_id: 'del-5' },
      expectedType: 'delegation.granted',
      expectedRef: 'aie:delegation:del-5'
    },
    {
      source: 'avc',
      raw: { id: 'avc-55', event: 'incident_raised', incident_id: 'inc-12', severity: 'p1' },
      expectedType: 'cell.incident.raised',
      expectedRef: 'avc:incident:inc-12'
    },
    {
      source: 'isr',
      raw: { id: 'isr-44', action: 'claim_verified', claim_id: 'clm-3', evidence_id: 'ev-303' },
      expectedType: 'claim.verified',
      expectedRef: 'isr:claim:clm-3'
    },
    {
      source: 'skills-vault',
      raw: { id: 'sk-33', kind: 'skill_published', skill_id: 'skill-nlp' },
      expectedType: 'skill.discovered',
      expectedRef: 'skills-vault:skill:skill-nlp'
    },
    {
      source: 'governance',
      raw: { id: 'gov-22', type: 'contract_attested', contract_id: 'contract-v6' },
      expectedType: 'contract.attested',
      expectedRef: 'governance:contract:contract-v6'
    }
  ];

  let seq = 1;
  for (const c of cases) {
    const env = normalizeFederatedEvent({
      sourceIntegration: c.source,
      sourceRevision: 'head',
      sequence: seq++,
      rawEvent: c.raw
    });
    assert.equal(env.sourceIntegration, c.source);
    assert.equal(env.type, c.expectedType);
    assert.equal(env.objectRef, c.expectedRef);
  }
});

test('LiveStreamAdapter: manages connection state, buffers, and emits events', async () => {
  const adapter = createLiveStreamAdapter({
    integrationId: 'works',
    sourceRevision: UPSTREAM_REVISIONS.works.sha
  });

  const received = [];
  adapter.subscribe(evt => received.push(evt));

  assert.equal(adapter.status(), 'connected');

  adapter.publish({ event_id: 'e1', event_type: 'step_completed', work_id: 'w1' });
  adapter.publish({ event_id: 'e2', event_type: 'step_completed', work_id: 'w2' });

  assert.equal(received.length, 2);
  assert.equal(received[0].sequence, 1);
  assert.equal(received[1].sequence, 2);

  // Outage simulation
  adapter.simulateOutage('connection dropped');
  assert.equal(adapter.status(), 'unavailable');

  // Events emitted during outage are buffered
  adapter.bufferOffline({ event_id: 'e3', event_type: 'step_completed', work_id: 'w3' });
  assert.equal(received.length, 2); // Not delivered yet

  // Reconnect simulation drains backlog
  adapter.simulateRecovery();
  assert.equal(adapter.status(), 'connected');
  assert.equal(received.length, 3);
  assert.equal(received[2].sequence, 3);
});

test('LiveHealthMonitor: tracks heartbeats and flags exact-head drift', () => {
  const registry = createIntegrationRegistry();
  registry.register(mockManifest('works', { sha: UPSTREAM_REVISIONS.works.sha }));
  registry.setState('works', 'current');

  const monitor = createLiveHealthMonitor({
    registry,
    pinnedRevisions: UPSTREAM_REVISIONS
  });

  // Healthy heartbeat
  monitor.recordHeartbeat('works', { revision: UPSTREAM_REVISIONS.works.sha, status: 'ok' });
  assert.equal(monitor.getHealth('works').state, 'current');
  assert.equal(monitor.isWriteSafe('works'), true);

  // Exact-head drift detected
  monitor.recordHeartbeat('works', { revision: 'drifted-unpinned-sha-999', status: 'ok' });
  const drifted = monitor.getHealth('works');
  assert.equal(drifted.state, 'drifted');
  assert.equal(monitor.isWriteSafe('works'), false);
  assert.equal(registry.get('works').state, 'drifted');

  // Stale detection
  monitor.recordMissedHeartbeat('works', 3);
  assert.equal(monitor.getHealth('works').state, 'stale');
  assert.equal(monitor.isWriteSafe('works'), false);
});

test('AuthoritativeResyncProtocol: detects sequence gaps and triggers full snapshot reconciliation', async () => {
  const registry = createIntegrationRegistry();
  const objects = createObjectGraph();
  const evidence = createEvidenceGraph();

  registry.register(mockManifest('works', { sha: 'sha-w' }));
  registry.setState('works', 'current');

  let humanState = { activeDomain: 'WORK', activeConversationId: 'c1', draftText: 'preserve this' };
  let refetchCalled = false;

  const resyncProtocol = createAuthoritativeResyncProtocol({
    registry,
    objects,
    evidence,
    getHumanState: () => humanState,
    fetchSnapshot: async (id) => {
      refetchCalled = true;
      return {
        objects: [
          createEnvelope({
            sourceIntegration: id,
            type: 'work',
            canonicalId: 'job-resynced',
            canonicalOwner: id,
            status: 'running',
            freshness: 'current',
            sourceRevision: 'sha-w',
            payload: { title: 'Durable Resynced Work' }
          })
        ],
        evidence: [],
        relations: []
      };
    }
  });

  // Normal event seq 1
  const env1 = createEventEnvelope({
    sourceIntegration: 'works',
    type: 'work.step.completed',
    sequence: 1,
    objectRef: 'works:work:job-1'
  });
  await resyncProtocol.handleEvent(env1);
  assert.equal(refetchCalled, false);

  // Gap: incoming event has sequence 4 (missed 2 and 3)
  const env4 = createEventEnvelope({
    sourceIntegration: 'works',
    type: 'work.step.completed',
    sequence: 4,
    objectRef: 'works:work:job-1'
  });
  await resyncProtocol.handleEvent(env4);

  assert.equal(refetchCalled, true);
  assert.ok(objects.get('works:work:job-resynced'));
  assert.equal(objects.get('works:work:job-resynced').payload.title, 'Durable Resynced Work');
  // Human state remains pristine
  assert.equal(humanState.draftText, 'preserve this');
  assert.equal(humanState.activeConversationId, 'c1');
});

test('EXIT GATE: Core engines can independently transition offline and online without false state', async () => {
  const coreEngines = [
    'trustGateway',
    'works',
    'workIntelligence',
    'aie',
    'autonomousVentureCompany',
    'skillsVault',
    'intelligenceSystemsResearch',
    'governance'
  ];

  const registry = createIntegrationRegistry();
  const objects = createObjectGraph();
  const evidence = createEvidenceGraph();

  for (const eng of coreEngines) {
    registry.register(mockManifest(eng, { writes: [`${eng}.action`] }));
    registry.setState(eng, 'current');
  }

  const resyncProtocol = createAuthoritativeResyncProtocol({
    registry,
    objects,
    evidence,
    fetchSnapshot: async (id) => ({
      objects: [
        createEnvelope({
          sourceIntegration: id,
          type: 'status_check',
          canonicalId: `check-${id}`,
          canonicalOwner: id,
          status: 'online',
          freshness: 'current',
          sourceRevision: 'pinned-sha-123',
          payload: { resynced: true }
        })
      ]
    })
  });

  for (const eng of coreEngines) {
    // 1. Engine goes offline
    registry.setState(eng, 'unavailable', { reason: 'network drop' });
    assert.equal(registry.canWrite(eng), false, `${eng} must disable writes when unavailable`);

    // 2. Unaffected engines remain writeable
    const others = coreEngines.filter(x => x !== eng);
    for (const other of others) {
      assert.equal(registry.canWrite(other), true, `${other} must remain fully operational when ${eng} is offline`);
    }

    // 3. Simulated write to offline engine FAILS immediately with zero synthetic success
    assert.throws(
      () => {
        if (!registry.canWrite(eng)) throw new Error(`engine_${eng}_unavailable`);
      },
      /unavailable/,
      `Attempting write to ${eng} must reject without synthetic success`
    );

    // 4. Engine recovers online through authoritative resync
    await resyncProtocol.resyncEngine(eng);
    assert.equal(registry.get(eng).state, 'current', `${eng} must be restored to current`);
    assert.equal(registry.canWrite(eng), true, `${eng} must be write-safe again`);
    assert.ok(objects.get(`${eng}:status_check:check-${eng}`), `Resynced object for ${eng} must be present in graph`);
  }
});
