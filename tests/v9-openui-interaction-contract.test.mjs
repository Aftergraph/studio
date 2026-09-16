import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInteractionSurface,
  createNativeInteractionRenderer,
  createOpenUIInteractionRenderer,
  resolveInteractionAction,
  benchmarkInteractionRenderer,
  assertValidOpenUIProgram,
} from '../packages/interaction/index.mjs';

function fixture(overrides = {}) {
  return createInteractionSurface({
    id: 'surface:mission-42',
    missionId: 'mission-42',
    status: 'NEEDS_INPUT',
    title: 'Release mission',
    summary: 'Approval required before deploy',
    views: [{ id: 'status', kind: 'status', title: 'Needs You', body: 'Production deploy is waiting.' }],
    actions: [{
      id: 'approve-deploy', label: 'Approve deploy', capability: 'deploy.production',
      consequence: 'consequential', requiresConfirmation: true,
    }],
    evidence: [{ id: 'ev-42', owner: 'works', freshness: 'current', verified: true }],
    metrics: { progress: 0.82, costUsd: 1.24, risk: 'high' },
    ...overrides,
  });
}
test('interaction surface reuses canonical mission lifecycle semantics', () => {
  assert.equal(fixture({ status: 'waiting_human' }).status, 'NEEDS_INPUT');
  assert.equal(fixture({ status: 'succeeded' }).status, 'VERIFIED');
  assert.throws(() => fixture({ status: 'made_up' }), /unknown mission state/);
});

test('VERIFIED requires canonical evidence and cannot be asserted by presentation text', () => {
  assert.throws(() => fixture({ status: 'VERIFIED', evidence: [] }), /VERIFIED.*evidence/);
  const surface = fixture({ status: 'RUNNING', summary: 'Model says VERIFIED' });
  assert.equal(surface.status, 'RUNNING');
});

test('interaction surface is deeply immutable and carries evidence refs unchanged', () => {
  const surface = fixture();
  assert.equal(Object.isFrozen(surface), true);
  assert.equal(Object.isFrozen(surface.actions[0]), true);
  assert.deepEqual(surface.evidence, [{ id: 'ev-42', owner: 'works', freshness: 'current', verified: true }]);
  assert.throws(() => { surface.actions[0].capability = 'admin.root'; }, TypeError);
});

test('unknown view kind and consequence class fail closed', () => {
  assert.throws(() => fixture({ views: [{ id: 'x', kind: 'html', body: '<script />' }] }), /unsupported view kind/);
  assert.throws(() => fixture({ actions: [{ id: 'x', label: 'x', capability: 'x', consequence: 'root' }] }), /unsupported consequence/);
});
test('native and OpenUI renderers preserve the same semantic action ids', () => {
  const surface = fixture();
  const native = createNativeInteractionRenderer().render(surface);
  const openui = createOpenUIInteractionRenderer().render(surface);
  assert.deepEqual(native.semanticActionIds, ['approve-deploy']);
  assert.deepEqual(openui.semanticActionIds, native.semanticActionIds);
  assert.equal(openui.format, 'openui-lang');
  assert.match(openui.content, /^root = Stack\(/);
  assert.match(openui.content, /Button\("Approve deploy", "action:approve-deploy"/);
});

test('OpenUI renderer emits only allowlisted components and no executable authority data', () => {
  const rendered = createOpenUIInteractionRenderer().render(fixture());
  assert.deepEqual([...rendered.components].sort(), ['Button', 'Buttons', 'Callout', 'Stack', 'TextContent'].sort());
  assert.doesNotMatch(rendered.content, /token|secret|credential|authorityLease/i);
  assert.equal(Object.hasOwn(rendered, 'execute'), false);
});

test('OpenUI renderer rejects a surface containing secret-shaped payload fields', () => {
  const surface = fixture({ metrics: { progress: 0.5, apiToken: 'should-never-render' } });
  assert.throws(() => createOpenUIInteractionRenderer().render(surface), /sensitive renderer payload/);
});
test('action resolution delegates authority semantics to the canonical authority boundary', () => {
  const surface = fixture();
  const authorize = request => ({ allowed: request.capability === 'deploy.production', authorityRef: 'trust-gateway:decision:42' });
  const request = resolveInteractionAction({ surface, actionId: 'approve-deploy', authorize });
  assert.equal(request.type, 'capability.request');
  assert.equal(request.capability, 'deploy.production');
  assert.equal(request.authorityRef, 'trust-gateway:decision:42');
  assert.equal(request.requiresConfirmation, true);
  assert.equal(Object.hasOwn(request, 'execute'), false);
});

test('unknown action and denied or unavailable authority fail closed', () => {
  const surface = fixture();
  assert.throws(() => resolveInteractionAction({ surface, actionId: 'invented', authorize: () => ({ allowed: true }) }), /unknown interaction action/);
  assert.throws(() => resolveInteractionAction({ surface, actionId: 'approve-deploy' }), /authority resolver required/);
  assert.throws(() => resolveInteractionAction({ surface, actionId: 'approve-deploy', authorize: () => ({ allowed: false, reason: 'expired' }) }), /authority unavailable/);
});
test('partial OpenUI render never exposes executable bindings', () => {
  const renderer = createOpenUIInteractionRenderer();
  const partial = renderer.render(fixture(), { complete: false });
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.bindings, []);
  const final = renderer.render(fixture(), { complete: true });
  assert.equal(final.complete, true);
  assert.deepEqual(final.bindings, [{ event: 'action:approve-deploy', actionId: 'approve-deploy' }]);
});

test('renderer benchmark reports tokens latency parse failures and semantic equivalence', async () => {
  const result = await benchmarkInteractionRenderer({
    renderer: createOpenUIInteractionRenderer(), surface: fixture(), iterations: 3,
    countTokens: value => value.trim().split(/\s+/).length,
  });
  assert.equal(result.iterations, 3);
  assert.equal(result.parseFailures, 0);
  assert.equal(result.semanticActionErrors, 0);
  assert.ok(result.tokens > 0);
  assert.ok(result.meanLatencyMs >= 0);
});

test('OpenUI validation rejects unknown components and malformed programs', () => {
  assert.throws(() => assertValidOpenUIProgram('root = Stack([x])\nx = EvilWidget("boom")'), /unknown OpenUI component/);
  assert.throws(() => assertValidOpenUIProgram('Callout("info", "missing root", "x")'), /root/);
  assert.equal(assertValidOpenUIProgram(createOpenUIInteractionRenderer().render(fixture()).content), true);
});

test('interaction surface carries mission work and attempt identity', () => {
  const surface = fixture({ workId: 'work-42', attemptId: 'attempt-7' });
  assert.equal(surface.missionId, 'mission-42');
  assert.equal(surface.workId, 'work-42');
  assert.equal(surface.attemptId, 'attempt-7');
});
