import test from 'node:test';
import assert from 'node:assert/strict';
import * as routes from '../src/api-routes.mjs';

test('api-routes exports frozen route builders for all client paths', () => {
  const expected = [
    'healthz','state','needs','missions','agents','artifacts','connections','spaces','system','upstreams',
    'upstreamsSync','upstreamApprovalDecision','upstreamWorkControl','workIntelligenceReview','workIntelligencePromote',
    'aieTaskCancel','aieMessages','conversations','need','context','artifact','conversationMessages',
    'approvalDecision','missionControl','missionRuntime','memory','memoryPromote','authoritativeMemory',
    'space','replay','reset','autonomyKillRead','autonomyKillEngage','autonomyKillRelease',
    'syncEventsSubmit','syncEventsRead','events',
    'federationIntegrations','federationObjects','federationObject','federationSearch','federationNow','federationCapabilities',
  ];
  for (const name of expected) {
    assert.equal(typeof routes[name], 'function', `missing route builder: ${name}`);
  }
});

test('static routes return exact canonical paths', () => {
  assert.equal(routes.healthz(), '/healthz');
  assert.equal(routes.state(), '/api/v1/state');
  assert.equal(routes.needs(), '/api/v1/needs');
  assert.equal(routes.missions(), '/api/v1/missions');
  assert.equal(routes.agents(), '/api/v1/agents');
  assert.equal(routes.artifacts(), '/api/v1/artifacts');
  assert.equal(routes.connections(), '/api/v1/connections');
  assert.equal(routes.spaces(), '/api/v1/spaces');
  assert.equal(routes.system(), '/api/v1/system');
  assert.equal(routes.upstreams(), '/api/v1/upstreams');
  assert.equal(routes.upstreamsSync(), '/api/v1/upstreams/sync');
  assert.equal(routes.aieMessages(), '/api/v1/upstreams/aie/messages');
  assert.equal(routes.conversations(), '/api/v1/conversations');
  assert.equal(routes.authoritativeMemory(), '/api/v1/memory/authoritative');
  assert.equal(routes.replay(), '/api/v1/replay');
  assert.equal(routes.reset(), '/api/v1/reset');
  assert.equal(routes.autonomyKillEngage(), '/api/v1/autonomy/kill');
  assert.equal(routes.autonomyKillRelease(), '/api/v1/autonomy/kill/release');
  assert.equal(routes.syncEventsSubmit(), '/api/v1/sync/events');
  assert.equal(routes.syncEventsRead(), '/api/v1/sync/events');
  assert.equal(routes.events(), '/api/v1/events');
  assert.equal(routes.federationIntegrations(), '/api/v1/federation/integrations');
  assert.equal(routes.federationObjects(), '/api/v1/federation/objects');
  assert.equal(routes.federationNow(), '/api/v1/federation/now');
});

test('parameterized routes encode IDs and query params correctly', () => {
  assert.equal(routes.upstreamApprovalDecision('abc/def'), '/api/v1/upstreams/trust-gateway/approvals/abc%2Fdef/decision');
  assert.equal(routes.upstreamWorkControl('w-1'), '/api/v1/upstreams/works/w-1/control');
  assert.equal(routes.workIntelligenceReview('wi#2'), '/api/v1/upstreams/work-intelligence/wi%232/review');
  assert.equal(routes.workIntelligencePromote('wi 3'), '/api/v1/upstreams/work-intelligence/wi%203/promote');
  assert.equal(routes.aieTaskCancel('t/1'), '/api/v1/upstreams/aie/tasks/t%2F1/cancel');
  assert.equal(routes.need('n/1'), '/api/v1/needs/n%2F1');
  assert.equal(routes.context('conv q4'), '/api/v1/context?conversationId=conv%20q4');
  assert.equal(routes.artifact('art/q4'), '/api/v1/artifacts/art%2Fq4');
  assert.equal(routes.conversationMessages('c/1'), '/api/v1/conversations/c%2F1/messages');
  assert.equal(routes.approvalDecision('apr/1'), '/api/v1/approvals/apr%2F1/decision');
  assert.equal(routes.missionControl('m/1'), '/api/v1/missions/m%2F1/control');
  assert.equal(routes.missionRuntime('m/1'), '/api/v1/missions/m%2F1/runtime');
  assert.equal(routes.memory('mem/1'), '/api/v1/memory/mem%2F1');
  assert.equal(routes.memoryPromote('mem/1'), '/api/v1/memory/mem%2F1/promote');
  assert.equal(routes.space('s/1'), '/api/v1/spaces/s%2F1');
  assert.equal(routes.autonomyKillRead('global'), '/api/v1/autonomy/kill?scope=global');
  assert.equal(routes.federationObject('obj/1'), '/api/v1/federation/objects/obj%2F1');
  assert.equal(routes.federationSearch('hello world', { tenantId: 't/1' }), '/api/v1/federation/search?q=hello+world&tenantId=t%2F1');
  assert.equal(routes.federationSearch('test'), '/api/v1/federation/search?q=test');
  assert.equal(routes.federationCapabilities('cap/1'), '/api/v1/federation/capabilities?q=cap%2F1');
  assert.equal(routes.federationCapabilities(), '/api/v1/federation/capabilities?q=');
});

test('all exports are pure functions (frozen contract)', () => {
  for (const [name, fn] of Object.entries(routes)) {
    assert.equal(typeof fn, 'function', `${name} is not a function`);
    // ponytail: pure functions have no own mutable state
    assert.equal(Object.keys(fn).length, 0, `${name} has unexpected own properties`);
  }
});
