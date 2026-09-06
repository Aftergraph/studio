// V7.1 Adaptive Workspace — Exit Gate Tests (node:test)
// Exit gate: UI composed dynamically from intent/object/context.
// Invariants: typed schemas only — only registered surface kinds emitted;
// same object renders differently by journey stage + context; no arbitrary HTML.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceRegistry } from '../src/federation/surface-registry.mjs';
import {
  composeAdaptive,
  ADAPTIVE_SURFACE_KINDS,
} from '../src/workspace/adaptive-composer.mjs';

function registry() {
  const r = createSurfaceRegistry();
  r.register({ id: 'mission-detail', sourceIntegration: 'works', objectTypes: ['mission', 'work'] });
  r.register({ id: 'context-inspector', sourceIntegration: 'studio', objectTypes: ['memory', 'context'] });
  r.register({ id: 'approval-gate', sourceIntegration: 'studio', objectTypes: [] });
  r.register({ id: 'evidence-panel', sourceIntegration: 'isr', objectTypes: ['claim', 'evidence'] });
  r.register({ id: 'action-bar', sourceIntegration: 'studio', objectTypes: [] });
  r.register({ id: 'fallback-feed', sourceIntegration: 'studio', objectTypes: [] });
  return r;
}

// ── Closed surface vocabulary ───────────────────────────────────────

test('Adaptive: emits only registered surface kinds', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'resolved',
    device: 'desktop',
  });
  assert.ok(plan.surfaces.length > 0);
  for (const s of plan.surfaces) {
    assert.ok(ADAPTIVE_SURFACE_KINDS.includes(s.kind), `unregistered kind: ${s.kind}`);
  }
});

test('Adaptive: unknown object type falls back, never invents surfaces', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'starship',
    journeyStage: 'resolved',
    device: 'desktop',
  });
  assert.ok(plan.surfaces.length > 0);
  for (const s of plan.surfaces) {
    assert.ok(ADAPTIVE_SURFACE_KINDS.includes(s.kind));
  }
  assert.ok(plan.surfaces.some((s) => s.reason === 'fallback'));
});

test('Adaptive: registry required', () => {
  assert.throws(() => composeAdaptive({ objectType: 'mission' }), /registry/i);
});

// ── Journey-stage adaptivity ────────────────────────────────────────

test('Adaptive: approved journey pins approval-gate first', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'approved',
    device: 'desktop',
  });
  assert.equal(plan.surfaces[0].kind, 'approval-gate');
});

test('Adaptive: evidenced journey surfaces evidence-panel for claims', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'claim',
    journeyStage: 'evidenced',
    device: 'desktop',
    evidenceRef: 'ev_1',
  });
  assert.ok(plan.surfaces.some((s) => s.kind === 'evidence-panel'));
});

test('Adaptive: same object differs by stage', () => {
  const reg = registry();
  const a = composeAdaptive({ registry: reg, objectType: 'mission', journeyStage: 'resolved', device: 'desktop' });
  const b = composeAdaptive({ registry: reg, objectType: 'mission', journeyStage: 'approved', device: 'desktop' });
  assert.notDeepEqual(
    a.surfaces.map((s) => s.kind),
    b.surfaces.map((s) => s.kind));
});

// ── Context adaptivity ──────────────────────────────────────────────

test('Adaptive: memory context adds context-inspector', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'contextualized',
    context: ['brain:memory:m1'],
    device: 'desktop',
  });
  assert.ok(plan.surfaces.some((s) => s.kind === 'context-inspector'));
});

// ── Capability gating (same idiom as compose-engine) ────────────────

test('Adaptive: ungranted action surface omitted with reason', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'approved',
    intent: 'execute',
    granted: [],
    device: 'desktop',
  });
  assert.ok(plan.omitted.some((o) => o.reason === 'capability'));
  assert.ok(!plan.surfaces.some((s) => s.kind === 'action-bar'));
});

test('Adaptive: granted action surface present', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'approved',
    intent: 'execute',
    granted: ['work.execute'],
    device: 'desktop',
  });
  assert.ok(plan.surfaces.some((s) => s.kind === 'action-bar'));
});

// ── Device density ──────────────────────────────────────────────────

test('Adaptive: mobile keeps kinds, reduces density', () => {
  const reg = registry();
  const d = composeAdaptive({ registry: reg, objectType: 'mission', journeyStage: 'resolved', device: 'desktop' });
  const m = composeAdaptive({ registry: reg, objectType: 'mission', journeyStage: 'resolved', device: 'mobile' });
  assert.deepEqual(m.surfaces.map((s) => s.kind), d.surfaces.map((s) => s.kind));
  assert.equal(m.density, 'summary');
  assert.equal(d.density, 'detail');
});

// ── No arbitrary HTML ───────────────────────────────────────────────

test('Adaptive: plan carries no markup, only typed descriptors', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'resolved',
    device: 'desktop',
  });
  const blob = JSON.stringify(plan);
  assert.ok(!blob.includes('<'), 'plan must not contain HTML markup');
  for (const s of plan.surfaces) {
    assert.equal(typeof s.kind, 'string');
    assert.equal(typeof s.priority, 'number');
    assert.ok(['detail', 'summary', 'compact'].includes(s.density));
  }
});

test('Adaptive: plan frozen', () => {
  const plan = composeAdaptive({
    registry: registry(),
    objectType: 'mission',
    journeyStage: 'resolved',
    device: 'desktop',
  });
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.surfaces));
});

// ── Exit gate: intent → adaptive workspace ──────────────────────────

test('V7.1 exit: journey stage drives workspace composition end-to-end', async () => {
  const { resolveUniversalIntent } = await import('../src/composer/universal-resolver.mjs');
  const { createIntentJourney, advanceJourney } = await import('../src/intent/journey.mjs');
  const { createCapabilityRegistry } = await import('../src/federation/capability-registry.mjs');

  const reg = createCapabilityRegistry({ resolveGrant: () => false });
  reg.register({ id: 'work:execute', source: 'works', discoverable: true });

  const resolution = resolveUniversalIntent({
    text: 'build the prototype', mode: 'Build',
    subject: { id: 'human:1' }, capabilityRegistry: reg,
  });
  let j = createIntentJourney({ resolution, actor: 'human:1' });
  const reg2 = registry();

  const before = composeAdaptive({
    registry: reg2, objectType: 'mission', journeyStage: j.stage, device: 'desktop',
  });
  j = advanceJourney(j, 'contextualized', { context: ['works:work:w1'] });
  j = advanceJourney(j, 'approved', { approver: 'human:1' });
  const after = composeAdaptive({
    registry: reg2, objectType: 'mission', journeyStage: j.stage, device: 'desktop',
  });
  assert.equal(after.surfaces[0].kind, 'approval-gate');
  assert.notDeepEqual(
    before.surfaces.map((s) => s.kind),
    after.surfaces.map((s) => s.kind));
});
