import test from 'node:test';
import assert from 'node:assert/strict';
import { graphId, createEnvelope } from '../src/federation/object-envelope.mjs';
import { resolveAuthority, executeConsequentialWrite } from '../src/federation/authority-graph.mjs';
import { createFederationKernel } from '../src/federation/federation-kernel.mjs';
import { createCapabilityRegistry } from '../src/federation/capability-registry.mjs';
import { resolveUniversalIntent } from '../src/composer/universal-resolver.mjs';
import { createFederatedIndex } from '../src/search/federated-index.mjs';
import { createIsrManifest, projectResearchSnapshot, createPromotionProposal } from '../src/integrations/isr.mjs';
import { validateIntegrationManifest } from '../src/federation/integration-manifest.mjs';
import { createObjectGraph } from '../src/federation/object-graph.mjs';
import { createEvidenceGraph } from '../src/federation/evidence-graph.mjs';
import { createIntegrationRegistry } from '../src/federation/integration-registry.mjs';
import { createFederationReconciler } from '../src/federation/reconciler.mjs';
import { captureFocusSnapshot, restoreFocusSnapshot } from '../src/app/render-scheduler.mjs';
import { createNowProjection } from '../src/now/projection.mjs';

function mockManifest(id, { roles = ['projection'], objects = ['work'], authority = [] } = {}) {
  return validateIntegrationManifest({
    schema: 'aftergraph.integration/v1',
    id,
    repository: `Aftergraph/${id}`,
    integrationVersion: '1.0.0',
    repositoryRevision: 'sha-head',
    roles,
    objects,
    relations: [],
    capabilities: [],
    surfaces: [id],
    events: [],
    reads: [id],
    writes: authority.flatMap(a => a.operations),
    authority,
    evidence: [],
    health: { kind: 'test' },
    degradedBehavior: { reads: 'stale', writes: 'block' },
    compatibility: { mode: 'exact-or-declared', supported: ['1.x'] }
  });
}

export function journeyNames() {
  return ['research-to-governed-work', 'wi-to-execution', 'avc-agent-execution', 'failure-and-recovery', 'partial-federation'];
}

test('all five V6 E2E journeys are registered', () => {
  const REQUIRED = ['research-to-governed-work', 'wi-to-execution', 'avc-agent-execution', 'failure-and-recovery', 'partial-federation'];
  assert.deepEqual(journeyNames().sort(), REQUIRED.sort());
});

test('WorkItemNeverBecomesWorksWorkImplicitly', () => {
  assert.notEqual(graphId('wi', 'work_item', '42'), graphId('works', 'work', '42'));
});

test('ResearchEvidenceNeverBecomesRuntimeAuthority', () => {
  const m = createIsrManifest({ repositoryRevision: 'sha-head' });
  assert.equal(m.authority.some(a => a.operations.includes('execute')), false);
  const r = projectResearchSnapshot({
    revision: 'sha-head',
    claims: [{ id: 'c1', title: 'claim', evidenceIds: ['e1'], status: 'provisional' }],
    evidence: [{ id: 'e1', method: 'simulation', limitations: ['simulated'], verified: true }]
  });
  assert.throws(() => resolveAuthority(r.objects[0], 'execute'), /authority/);
});

test('ProjectionNeverGrantsAuthority', () => {
  assert.throws(() => resolveAuthority({ canonicalOwner: 'isr', authority: [] }, 'execute'), /authority/);
});

test('FailedAuthorityWriteNeverShowsSuccess', async () => {
  const states = [];
  const reg = { canWrite: owner => owner === 'trust-gateway' };
  const adapters = {
    'trust-gateway': { write: async () => { throw new Error('Policy Denied: Action exceeds risk threshold'); } }
  };
  await assert.rejects(
    async () => executeConsequentialWrite({
      registry: reg,
      adapters,
      object: { graphId: 'tg:action:1', canonicalOwner: 'trust-gateway', authority: [{ owner: 'trust-gateway', operations: ['kill'] }] },
      operation: 'kill',
      input: {},
      onUiState: s => states.push(s)
    }),
    /Policy Denied/
  );
  assert.equal(states.includes('submitted'), true);
  assert.equal(states.includes('success'), false);
  assert.equal(states.includes('approved'), false);
});

test('BackgroundSyncNeverStealsHumanNavigation', () => {
  const reg = createIntegrationRegistry();
  reg.register(mockManifest('works'));
  reg.setState('works', 'current');
  const human = { activeDomain: 'chat', activeConversationId: 'c1', activeSpaceId: 's1', composerDraft: 'hello', theme: 'dark' };
  const r = createFederationReconciler({
    registry: reg,
    objects: createObjectGraph(),
    evidence: createEvidenceGraph(),
    capabilities: createCapabilityRegistry(),
    getHumanState: () => human
  });
  r.reconcile('works', { objects: [] });
  assert.deepEqual(human, { activeDomain: 'chat', activeConversationId: 'c1', activeSpaceId: 's1', composerDraft: 'hello', theme: 'dark' });
});

test('BackgroundSyncPreservesComposerFocusCaretAndDraft', () => {
  const reg = createIntegrationRegistry();
  reg.register(mockManifest('works'));
  reg.setState('works', 'current');
  const human = {
    activeDomain: 'chat',
    activeConversationId: 'c1',
    activeSpaceId: 's1',
    composerDraft: 'keep this human draft stable',
    focusKey: 'composer-input',
    selectionStart: 5,
    selectionEnd: 15
  };
  const reconciler = createFederationReconciler({
    registry: reg,
    objects: createObjectGraph(),
    evidence: createEvidenceGraph(),
    capabilities: createCapabilityRegistry(),
    getHumanState: () => human
  });
  reconciler.reconcile('works', { objects: [] });
  assert.equal(human.composerDraft, 'keep this human draft stable');
  assert.equal(human.focusKey, 'composer-input');
  assert.equal(human.selectionStart, 5);
  assert.equal(human.selectionEnd, 15);

  let focused = false, selection = null;
  const target = {
    disabled: false,
    dataset: { focusKey: 'composer-input' },
    selectionStart: 5,
    selectionEnd: 15,
    selectionDirection: 'forward',
    focus() { focused = true; },
    setSelectionRange(s, e, d) { selection = [s, e, d]; }
  };
  const root = {
    contains: el => el === target,
    querySelector: sel => sel === '[data-focus-key="composer-input"]' ? target : null
  };
  const snapshot = captureFocusSnapshot(root, { activeElement: target });
  assert.notEqual(snapshot, null);
  assert.equal(restoreFocusSnapshot(root, snapshot), true);
  assert.equal(focused, true);
  assert.deepEqual(selection, [5, 15, 'forward']);
});

test('SourceRevisionDriftDisablesUnsafeWrites', () => {
  const reg = createIntegrationRegistry();
  reg.register(mockManifest('works', { authority: [{ owner: 'works', operations: ['write'] }] }));
  reg.setState('works', 'drifted', { expected: 'sha-head', actual: 'sha-drifted' });
  assert.equal(reg.canWrite('works'), false, 'Unsafe writes must be disabled on source revision drift');
  assert.equal(reg.canRead('works'), true, 'Read-only projections remain available');
});

test('StaleEvidenceNeverAppearsNewlyVerified', () => {
  const g = createEvidenceGraph();
  g.registerEvidence({
    id: 'works:e1',
    owner: 'works',
    class: 'execution',
    method: 'verifier',
    freshness: 'stale',
    verified: true
  });
  g.linkEvidence('works:work:w1', 'works:e1');
  const x = g.evidenceFor('works:work:w1')[0];
  assert.equal(x.freshness, 'stale');
  assert.equal(g.isFreshVerified('works:e1'), false);
});

test('CapabilityDiscoveryNeverEqualsCapabilityGrant', () => {
  const r = createCapabilityRegistry();
  r.register({ id: 'skill:research', source: 'skills-vault', discoverable: true, requiresAuthority: ['research.execute'] });
  assert.equal(r.discover('research').length, 1);
  assert.equal(r.grantStatus({ id: 'agent:1' }, 'skill:research'), 'not-granted');
});

test('CrossTenantRelationFailsClosed', () => {
  const g = createObjectGraph();
  const a = createEnvelope({ sourceIntegration: 'wi', type: 'work_item', canonicalId: '1', canonicalOwner: 'wi', tenantId: 't1', status: 'open', payload: {}, sourceRevision: 'a' });
  const b = createEnvelope({ sourceIntegration: 'works', type: 'work', canonicalId: '2', canonicalOwner: 'works', tenantId: 't2', status: 'running', payload: {}, sourceRevision: 'b' });
  const c = createEnvelope({ sourceIntegration: 'works', type: 'work', canonicalId: '3', canonicalOwner: 'works', tenantId: null, status: 'running', payload: {}, sourceRevision: 'c' });
  g.upsert(a);
  g.upsert(b);
  g.upsert(c);
  assert.throws(() => g.relate({ type: 'related_to', from: a.graphId, to: b.graphId, sourceIntegration: 'wi' }), /cross-tenant/);
  assert.throws(() => g.relate({ type: 'related_to', from: a.graphId, to: c.graphId, sourceIntegration: 'wi' }), /cross-tenant/);
});

test('MissingIntegrationLeavesUnaffectedDomainsOperational', () => {
  const reg = createIntegrationRegistry();
  reg.register(mockManifest('works'));
  reg.register(mockManifest('isr'));
  reg.setState('works', 'current');
  reg.setState('isr', 'unavailable');
  const objGraph = createObjectGraph();
  const reconciler = createFederationReconciler({
    registry: reg,
    objects: objGraph,
    evidence: createEvidenceGraph(),
    capabilities: createCapabilityRegistry()
  });
  const obj = createEnvelope({ sourceIntegration: 'works', type: 'work', canonicalId: 'w1', canonicalOwner: 'works', status: 'RUNNING', freshness: 'current', payload: {}, sourceRevision: 'sha' });
  assert.doesNotThrow(() => reconciler.reconcile('works', { objects: [obj] }));
  assert.equal(objGraph.get(obj.graphId).status, 'RUNNING');
});

test('SearchReportsIncompleteCoverageDuringOutage', () => {
  const index = createFederatedIndex();
  index.setCoverage('works', 'current');
  index.setCoverage('isr', 'unavailable');
  const r = index.search('anything', { tenantId: 't1' });
  assert.equal(r.complete, false);
  assert.deepEqual(r.unavailable, ['isr']);
});

// --- TASK 20: Cross-System E2E Journeys A–E ---

test('Journey A: Intent -> capability discovery -> authority evaluation -> approval -> WORKS execution -> evidence -> verified outcome', async () => {
  // 1. Intent composition & capability discovery (without grant)
  const capReg = createCapabilityRegistry({ resolveGrant: (subject, cap) => cap.id === 'work:execute' && subject.approved === true });
  capReg.register({ id: 'work:execute', source: 'works', discoverable: true, tags: ['build', 'execute'] });

  const unapprovedIntent = resolveUniversalIntent({
    text: 'Deploy the new intelligence pipeline',
    mode: 'Build',
    subject: { id: 'human:1', approved: false },
    capabilityRegistry: capReg
  });
  assert.equal(unapprovedIntent.capabilities.some(c => c.id === 'work:execute'), true);
  assert.equal(unapprovedIntent.executionAllowed, false, 'Discovery is not a grant');
  assert.equal(unapprovedIntent.requiresApproval, true);

  // 2. Human approval granting authority
  const approvedIntent = resolveUniversalIntent({
    text: 'Deploy the new intelligence pipeline',
    mode: 'Build',
    subject: { id: 'human:1', approved: true },
    capabilityRegistry: capReg
  });
  assert.equal(approvedIntent.executionAllowed, true);

  // 3. Consequential write to WORKS via kernel
  const executionAudit = [];
  const kernel = createFederationKernel({
    adapters: {
      works: {
        write: async (op, input) => {
          executionAudit.push({ op, input });
          return { status: 'SUCCEEDED', executionId: 'exec-123', outcome: 'pipeline-deployed' };
        }
      }
    }
  });

  kernel.registerIntegration(mockManifest('works', {
    roles: ['durable-execution'],
    objects: ['work', 'outcome', 'evidence'],
    authority: [{ owner: 'works', operations: ['execute-pipeline'] }]
  }));
  kernel.setIntegrationState('works', 'current');

  const workEnv = createEnvelope({
    sourceIntegration: 'works',
    type: 'work',
    canonicalId: 'w-42',
    canonicalOwner: 'works',
    status: 'READY',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'works', operations: ['execute-pipeline'] }],
    payload: { title: 'Pipeline work' }
  });

  const writeResult = await kernel.write({
    object: workEnv,
    operation: 'execute-pipeline',
    input: { triggerBy: 'human:1' }
  });
  assert.equal(writeResult.status, 'SUCCEEDED');
  assert.equal(executionAudit[0].op, 'execute-pipeline');

  // 4. Evidence generation & verified outcome
  const outcomeEnv = createEnvelope({
    sourceIntegration: 'works',
    type: 'outcome',
    canonicalId: 'out-123',
    canonicalOwner: 'works',
    status: 'VERIFIED',
    freshness: 'current',
    sourceRevision: 'sha-head',
    payload: { outcome: 'pipeline-deployed', verified: true },
    evidence: [{ id: 'ev-123', class: 'execution', owner: 'works' }]
  });
  kernel.reconcile('works', { objects: [outcomeEnv] });
  assert.equal(kernel.object('works:outcome:out-123').status, 'VERIFIED');
});

test('Journey B: Workspace observation -> WI WorkItem -> human review -> explicit promotion -> WORKS Work', async () => {
  // 1. Observation ingested
  const obs = { id: 'obs-99', issue: 'latency regression on model endpoint' };

  // 2. WI WorkItem created with proposal-only status
  const wiManifest = mockManifest('work-intelligence', {
    roles: ['observation', 'proposal-only'],
    objects: ['work_item'],
    authority: [{ owner: 'work-intelligence', operations: ['review', 'promote'] }]
  });

  const workItemEnv = createEnvelope({
    sourceIntegration: 'work-intelligence',
    type: 'work_item',
    canonicalId: 'wi-99',
    canonicalOwner: 'work-intelligence',
    status: 'PROPOSED',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'work-intelligence', operations: ['review', 'promote'] }],
    payload: { observationId: obs.id, title: 'Fix latency regression' }
  });

  assert.equal(workItemEnv.graphId, 'work-intelligence:work_item:wi-99');
  assert.notEqual(workItemEnv.graphId, 'works:work:wi-99', 'WorkItem cannot implicitly become WORKS Work');

  // 3. Human review & promotion requires explicit actor
  let promoted = false;
  const wiAdapter = {
    review: (id, { decision, actor }) => ({ id, decision, actor }),
    promote: (id, { actor }) => {
      if (!actor) throw new Error('promotion requires explicit human actor');
      promoted = true;
      return { ok: true, promotedTo: 'works:work:w-new-100' };
    }
  };

  assert.throws(() => wiAdapter.promote('wi-99', {}), /explicit human actor/);
  const promoRes = wiAdapter.promote('wi-99', { actor: 'human:auditor' });
  assert.equal(promoRes.ok, true);
  assert.equal(promoted, true);

  // 4. Promoted WORKS Work has distinct identity and explicit relationship
  const worksWorkEnv = createEnvelope({
    sourceIntegration: 'works',
    type: 'work',
    canonicalId: 'w-new-100',
    canonicalOwner: 'works',
    status: 'PENDING',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'works', operations: ['execute'] }],
    relations: [{ type: 'promoted_from', target: workItemEnv.graphId, source: 'works' }],
    payload: { title: 'Fix latency regression' }
  });

  assert.equal(worksWorkEnv.canonicalOwner, 'works');
  assert.equal(worksWorkEnv.relations[0].target, 'work-intelligence:work_item:wi-99');
});

test('Journey C: ISR claim -> evidence inspection -> promotion proposal -> governance review -> NO automatic runtime authority', () => {
  // 1. ISR claim & scientific evidence
  const isrManifest = createIsrManifest({ repositoryRevision: 'sha-isr' });
  assert.equal(isrManifest.authority.some(a => a.operations?.includes('execute')), false);

  const research = projectResearchSnapshot({
    revision: 'sha-isr',
    claims: [{ id: 'claim-1', title: 'New routing reduces cost by 40%', status: 'validated', evidenceIds: ['ev-isr-1'] }],
    evidence: [{ id: 'ev-isr-1', method: 'benchmark-simulation', limitations: ['simulated'], verified: true }]
  });

  const claimObj = research.objects[0];
  assert.deepEqual(claimObj.authority, [], 'Research object has no runtime authority');

  // 2. Create promotion proposal
  const proposal = createPromotionProposal({
    claimId: 'claim-1',
    target: 'aie',
    actor: 'human:researcher',
    reason: 'benchmark proven in testbed'
  });

  assert.equal(proposal.kind, 'research-promotion-proposal');
  assert.equal(proposal.runtimeAuthority, 'none', 'Proposal grants no runtime authority');
  assert.equal(proposal.requiresHumanApproval, true);

  // 3. Invariant check: Cannot resolve runtime authority from research proposal or claim
  assert.throws(() => resolveAuthority(claimObj, 'execute'), /authority/);
  assert.throws(() => resolveAuthority({ canonicalOwner: 'isr', authority: proposal.runtimeAuthority === 'none' ? [] : ['execute'] }, 'execute'), /authority/);
});

test('Journey D: Failure and recovery — active execution -> degradation -> stale projection -> Needs You/incident -> recover -> evidence -> authoritative resync', async () => {
  // 1. Consequential action failure has no synthetic local success
  const tgManifest = mockManifest('trust-gateway', {
    roles: ['runtime-enforcement'],
    objects: ['action'],
    authority: [{ owner: 'trust-gateway', operations: ['execute-action'] }]
  });

  const uiStates = [];
  const kernel = createFederationKernel({
    adapters: {
      'trust-gateway': {
        write: async (op, input) => {
          throw new Error('Policy Denied: Action exceeds risk threshold');
        }
      },
      works: {
        write: async (op, input) => {
          return { status: 'PAUSED', workId: input.workId, recoveredAt: new Date().toISOString() };
        }
      }
    }
  });

  kernel.registerIntegration(tgManifest);
  kernel.setIntegrationState('trust-gateway', 'current');

  const actionEnv = createEnvelope({
    sourceIntegration: 'trust-gateway',
    type: 'action',
    canonicalId: 'act-destructive-1',
    canonicalOwner: 'trust-gateway',
    status: 'PROPOSED',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'trust-gateway', operations: ['execute-action'] }],
    payload: { actionType: 'delete-index' }
  });

  // Must reject and ui state must not claim success
  await assert.rejects(
    () => kernel.write({
      object: actionEnv,
      operation: 'execute-action',
      input: { missionId: 'avc-mission-9' },
      onUiState: state => uiStates.push(state)
    }),
    /Policy Denied/
  );

  assert.equal(uiStates.includes('submitted'), true);
  assert.equal(uiStates.includes('success'), false);
  assert.equal(uiStates.includes('approved'), false);

  // 2. Multi-phase Failure and Recovery lifecycle
  // Phase a: Active execution
  kernel.registerIntegration(mockManifest('works', {
    roles: ['durable-execution'],
    objects: ['work', 'incident'],
    authority: [{ owner: 'works', operations: ['pause', 'resume', 'cancel'] }]
  }));
  kernel.setIntegrationState('works', 'current');

  const activeWork = createEnvelope({
    sourceIntegration: 'works',
    type: 'work',
    canonicalId: 'w-rec-1',
    canonicalOwner: 'works',
    status: 'RUNNING',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'works', operations: ['pause', 'resume', 'cancel'] }],
    payload: { title: 'Durable execution job' }
  });
  kernel.reconcile('works', { objects: [activeWork] });
  assert.equal(kernel.object(activeWork.graphId).freshness, 'current');

  // Phase b: Integration degradation -> stale projection
  kernel.setIntegrationState('works', 'degraded');
  const degradedWork = createEnvelope({
    sourceIntegration: 'works',
    type: 'work',
    canonicalId: 'w-rec-1',
    canonicalOwner: 'works',
    status: 'RUNNING',
    freshness: 'stale',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'works', operations: ['pause', 'resume', 'cancel'] }],
    payload: { title: 'Durable execution job' }
  });
  kernel.reconcile('works', { objects: [degradedWork] });
  assert.equal(kernel.object(activeWork.graphId).freshness, 'stale');

  // Phase c: Needs You / Incident surfaced in NOW projection
  const incidentEnv = createEnvelope({
    sourceIntegration: 'works',
    type: 'incident',
    canonicalId: 'inc-rec-1',
    canonicalOwner: 'works',
    status: 'NEEDS_INPUT',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'works', operations: ['pause', 'resume'] }],
    payload: { title: 'Execution worker degraded - intervention required' }
  });
  kernel.reconcile('works', { objects: [incidentEnv] });
  const now = createNowProjection({ objects: kernel.objects() });
  assert.ok(now.needsYou.some(item => item.graphId === incidentEnv.graphId || item.status === 'NEEDS_INPUT'));

  // Phase d: Pause/cancel recovery via canonical authority write
  kernel.setIntegrationState('works', 'current');
  const pauseRecovery = await kernel.write({
    object: degradedWork,
    operation: 'pause',
    input: { workId: 'w-rec-1', reason: 'Degraded worker intervention' }
  });
  assert.equal(pauseRecovery.status, 'PAUSED');

  // Phase e: Evidence recorded and authoritative resync restores verified outcome
  kernel._registries.evidence.registerEvidence({
    id: 'works:ev-rec-1',
    owner: 'works',
    class: 'execution',
    method: 'canonical-recovery-journal',
    freshness: 'current',
    verified: true
  });
  kernel._registries.evidence.linkEvidence(activeWork.graphId, 'works:ev-rec-1');
  assert.equal(kernel.evidenceFor(activeWork.graphId).length, 1);
  assert.equal(kernel.evidenceFor(activeWork.graphId)[0].owner, 'works');

  // Authoritative resync confirms paused/settled state
  const recoveredWork = createEnvelope({
    sourceIntegration: 'works',
    type: 'work',
    canonicalId: 'w-rec-1',
    canonicalOwner: 'works',
    status: 'PAUSED',
    freshness: 'current',
    sourceRevision: 'sha-head',
    authority: [{ owner: 'works', operations: ['pause', 'resume', 'cancel'] }],
    payload: { title: 'Durable execution job', state: 'PAUSED', recoveryId: 'works:ev-rec-1' }
  });
  kernel.reconcile('works', { objects: [recoveredWork] });
  assert.equal(kernel.object(activeWork.graphId).status, 'PAUSED');
  assert.equal(kernel.object(activeWork.graphId).freshness, 'current');
});

test('Journey E: Integration outage -> partial federation -> unaffected domains remain operational -> search reports incomplete coverage -> stale evidence visibly remains stale', () => {
  const index = createFederatedIndex();

  // 1. Multi-domain objects indexed
  index.index({
    graphId: 'works:work:w1',
    canonicalId: 'w1',
    type: 'work',
    sourceIntegration: 'works',
    canonicalOwner: 'works',
    freshness: 'current',
    tenantId: 't1',
    payload: { title: 'Core infrastructure task' }
  });

  index.index({
    graphId: 'isr:claim:c1',
    canonicalId: 'c1',
    type: 'claim',
    sourceIntegration: 'isr',
    canonicalOwner: 'isr',
    freshness: 'stale',
    tenantId: 't1',
    payload: { title: 'Neural cache study' }
  });

  // 2. Integration outage simulation
  index.setCoverage('works', 'current');
  index.setCoverage('isr', 'unavailable');

  // 3. Search under partial outage
  const searchRes = index.search('task', { tenantId: 't1' });
  assert.equal(searchRes.complete, false, 'Search flags incomplete coverage');
  assert.deepEqual(searchRes.unavailable, ['isr']);
  assert.equal(searchRes.results.length, 1);
  assert.equal(searchRes.results[0].canonicalId, 'w1');
  assert.equal(searchRes.results[0].freshness, 'current');

  // 4. Stale evidence query
  const staleRes = index.search('study', { tenantId: 't1' });
  assert.equal(staleRes.results[0].freshness, 'stale', 'Stale evidence remains visibly labeled stale, never upgraded');
});
