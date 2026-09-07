import test from 'node:test';
import assert from 'node:assert/strict';
import * as routes from '../src/api-routes.mjs';

test('api-routes exports frozen route builders for all client paths', () => {
  const expected = [
    'apiHealthz','apiState','apiNeeds','apiMissions','apiAgents','apiArtifacts','apiConnections','apiSpaces','apiSystem','apiUpstreams',
    'apiUpstreamsSync','apiUpstreamApprovalDecision','apiUpstreamWorkControl','apiWorkIntelligenceReview','apiWorkIntelligencePromote',
    'apiAieTaskCancel','apiAieMessages','apiConversations','apiNeed','apiContext','apiArtifact','apiConversationMessages',
    'apiApprovalDecision','apiMissionControl','apiMissionRuntime','apiMemory','apiMemoryPromote','apiAuthoritativeMemory',
    'apiSpace','apiReplay','apiReset','apiAutonomyKillRead','apiAutonomyKillEngage','apiAutonomyKillRelease',
    'apiSyncEventsSubmit','apiSyncEventsRead','apiEvents',
    'apiFederationIntegrations','apiFederationObjects','apiFederationObject','apiFederationSearch','apiFederationNow','apiFederationCapabilities',
  ];
  for (const name of expected) {
    assert.equal(typeof routes[name], 'function', `missing route builder: ${name}`);
  }
});

test('static routes return exact canonical paths', () => {
  assert.equal(routes.apiHealthz(), '/healthz');
  assert.equal(routes.apiState(), '/api/v1/state');
  assert.equal(routes.apiNeeds(), '/api/v1/needs');
  assert.equal(routes.apiMissions(), '/api/v1/missions');
  assert.equal(routes.apiAgents(), '/api/v1/agents');
  assert.equal(routes.apiArtifacts(), '/api/v1/artifacts');
  assert.equal(routes.apiConnections(), '/api/v1/connections');
  assert.equal(routes.apiSpaces(), '/api/v1/spaces');
  assert.equal(routes.apiSystem(), '/api/v1/system');
  assert.equal(routes.apiUpstreams(), '/api/v1/upstreams');
  assert.equal(routes.apiUpstreamsSync(), '/api/v1/upstreams/sync');
  assert.equal(routes.apiAieMessages(), '/api/v1/upstreams/aie/messages');
  assert.equal(routes.apiConversations(), '/api/v1/conversations');
  assert.equal(routes.apiAuthoritativeMemory(), '/api/v1/memory/authoritative');
  assert.equal(routes.apiReplay(), '/api/v1/replay');
  assert.equal(routes.apiReset(), '/api/v1/reset');
  assert.equal(routes.apiAutonomyKillEngage(), '/api/v1/autonomy/kill');
  assert.equal(routes.apiAutonomyKillRelease(), '/api/v1/autonomy/kill/release');
  assert.equal(routes.apiSyncEventsSubmit(), '/api/v1/sync/events');
  assert.equal(routes.apiSyncEventsRead(), '/api/v1/sync/events');
  assert.equal(routes.apiEvents(), '/api/v1/events');
  assert.equal(routes.apiFederationIntegrations(), '/api/v1/federation/integrations');
  assert.equal(routes.apiFederationObjects(), '/api/v1/federation/objects');
  assert.equal(routes.apiFederationNow(), '/api/v1/federation/now');
});

test('parameterized routes encode IDs and query params correctly', () => {
  assert.equal(routes.apiUpstreamApprovalDecision('abc/def'), '/api/v1/upstreams/trust-gateway/approvals/abc%2Fdef/decision');
  assert.equal(routes.apiUpstreamWorkControl('w-1'), '/api/v1/upstreams/works/w-1/control');
  assert.equal(routes.apiWorkIntelligenceReview('wi#2'), '/api/v1/upstreams/work-intelligence/wi%232/review');
  assert.equal(routes.apiWorkIntelligencePromote('wi 3'), '/api/v1/upstreams/work-intelligence/wi%203/promote');
  assert.equal(routes.apiAieTaskCancel('t/1'), '/api/v1/upstreams/aie/tasks/t%2F1/cancel');
  assert.equal(routes.apiNeed('n/1'), '/api/v1/needs/n%2F1');
  assert.equal(routes.apiContext('conv q4'), '/api/v1/context?conversationId=conv%20q4');
  assert.equal(routes.apiArtifact('art/q4'), '/api/v1/artifacts/art%2Fq4');
  assert.equal(routes.apiConversationMessages('c/1'), '/api/v1/conversations/c%2F1/messages');
  assert.equal(routes.apiApprovalDecision('apr/1'), '/api/v1/approvals/apr%2F1/decision');
  assert.equal(routes.apiMissionControl('m/1'), '/api/v1/missions/m%2F1/control');
  assert.equal(routes.apiMissionRuntime('m/1'), '/api/v1/missions/m%2F1/runtime');
  assert.equal(routes.apiMemory('mem/1'), '/api/v1/memory/mem%2F1');
  assert.equal(routes.apiMemoryPromote('mem/1'), '/api/v1/memory/mem%2F1/promote');
  assert.equal(routes.apiSpace('s/1'), '/api/v1/spaces/s%2F1');
  assert.equal(routes.apiAutonomyKillRead('global'), '/api/v1/autonomy/kill?scope=global');
  assert.equal(routes.apiFederationObject('obj/1'), '/api/v1/federation/objects/obj%2F1');
  assert.equal(routes.apiFederationSearch('hello world', { tenantId: 't/1' }), '/api/v1/federation/search?q=hello+world&tenantId=t%2F1');
  assert.equal(routes.apiFederationSearch('test'), '/api/v1/federation/search?q=test');
  assert.equal(routes.apiFederationCapabilities('cap/1'), '/api/v1/federation/capabilities?q=cap%2F1');
  assert.equal(routes.apiFederationCapabilities(), '/api/v1/federation/capabilities?q=');
});

test('all exports are pure functions (frozen contract)', () => {
  for (const [name, fn] of Object.entries(routes)) {
    assert.equal(typeof fn, 'function', `${name} is not a function`);
    // ponytail: pure functions have no own mutable state
    assert.equal(Object.keys(fn).length, 0, `${name} has unexpected own properties`);
  }
});
