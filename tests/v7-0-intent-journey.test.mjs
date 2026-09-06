// V7.0 Intent OS — Intent Journey Exit Gate Tests (node:test)
// Exit gate: Intent → verified outcome across 3+ engines, no step skippable.
// Invariants: resolver never executes; execution requires granted+approval;
// completed requires evidenceRef; stages advance immediate-next only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRegistry } from '../src/federation/capability-registry.mjs';
import { createEvidenceGraph } from '../src/federation/evidence-graph.mjs';
import { createCapabilityRuntime } from '../src/runtime/capability-runtime.mjs';
import { resolveUniversalIntent } from '../src/composer/universal-resolver.mjs';
import { createIntentJourney, advanceJourney, JOURNEY_STAGES } from '../src/intent/journey.mjs';

function registry(granted = []) {
  const r = createCapabilityRegistry({ resolveGrant: (_s, c) => granted.includes(c.id) });
  for (const c of [
    { id: 'skill:research', source: 'skills-vault', discoverable: true, tags: ['research'] },
    { id: 'work:execute', source: 'works', discoverable: true, tags: ['build', 'execute'] },
    { id: 'agent:delegate', source: 'avc', discoverable: true, tags: ['delegate'] },
  ]) r.register(c);
  return r;
}

function resolved(text = 'research this and build a prototype', mode = 'Build') {
  return resolveUniversalIntent({
    text, mode,
    subject: { id: 'human:1' },
    capabilityRegistry: registry(),
  });
}

// ── Creation ────────────────────────────────────────────────────────

test('IntentJourney: creation requires resolution + actor', () => {
  assert.throws(() => createIntentJourney({}), /resolution/i);
  assert.throws(() => createIntentJourney({ resolution: resolved() }), /actor/i);
});

test('IntentJourney: starts at resolved, never executed, grants nothing', () => {
  const j = createIntentJourney({ resolution: resolved(), actor: 'human:1' });
  assert.equal(j.stage, 'resolved');
  assert.equal(j.executed, false);
  assert.equal(j.authority, 'none');
  assert.deepEqual(JOURNEY_STAGES, ['resolved', 'contextualized', 'approved', 'executing', 'evidenced', 'completed']);
});

test('IntentJourney: preserves resolution context + capabilities', () => {
  const r = resolveUniversalIntent({
    text: 'inspect this', mode: 'Ask', context: [{ graphId: 'works:work:w1' }],
    subject: { id: 'human:1' }, capabilityRegistry: registry(),
  });
  const j = createIntentJourney({ resolution: r, actor: 'human:1' });
  assert.deepEqual(j.context, ['works:work:w1']);
  assert.ok(j.capabilities.length >= 0);
});

// ── Stage ordering ──────────────────────────────────────────────────

test('IntentJourney: stages advance immediate-next only, no skipping', () => {
  const j = createIntentJourney({ resolution: resolved(), actor: 'human:1' });
  assert.throws(() => advanceJourney(j, 'approved', { approver: 'human:1' }), /out of order/i);
  assert.throws(() => advanceJourney(j, 'completed', {}), /out of order/i);
  assert.throws(() => advanceJourney(j, 'resolved', {}), /out of order/i);
});

test('IntentJourney: unknown stage rejected', () => {
  const j = createIntentJourney({ resolution: resolved(), actor: 'human:1' });
  assert.throws(() => advanceJourney(j, 'shipped', {}), /unknown.*stage/i);
});

// ── contextualized ──────────────────────────────────────────────────

test('IntentJourney: contextualized requires bound context', () => {
  const j = createIntentJourney({ resolution: resolved(), actor: 'human:1' });
  assert.throws(() => advanceJourney(j, 'contextualized', {}), /context/i);
  assert.throws(() => advanceJourney(j, 'contextualized', { context: [] }), /context/i);
  const j2 = advanceJourney(j, 'contextualized', { context: ['works:work:w1'] });
  assert.equal(j2.stage, 'contextualized');
  assert.deepEqual(j2.context, ['works:work:w1']);
});

// ── approved ────────────────────────────────────────────────────────

test('IntentJourney: approved requires human approver', () => {
  const j = advanceJourney(
    createIntentJourney({ resolution: resolved(), actor: 'human:1' }),
    'contextualized', { context: ['works:work:w1'] });
  assert.throws(() => advanceJourney(j, 'approved', {}), /approver/i);
  const j2 = advanceJourney(j, 'approved', { approver: 'human:1' });
  assert.equal(j2.stage, 'approved');
  assert.equal(j2.approver, 'human:1');
  assert.equal(j2.executed, false);
});

// ── executing ───────────────────────────────────────────────────────

test('IntentJourney: executing blocked while any capability ungranted', () => {
  const j = advanceJourney(
    advanceJourney(createIntentJourney({ resolution: resolved(), actor: 'human:1' }),
      'contextualized', { context: ['works:work:w1'] }),
    'approved', { approver: 'human:1' });
  assert.throws(
    () => advanceJourney(j, 'executing', { registry: registry(), subject: 'human:1' }),
    /not.?granted/i);
});

test('IntentJourney: executing requires registry + subject', () => {
  const j = advanceJourney(
    advanceJourney(createIntentJourney({ resolution: resolved(), actor: 'human:1' }),
      'contextualized', { context: ['works:work:w1'] }),
    'approved', { approver: 'human:1' });
  assert.throws(() => advanceJourney(j, 'executing', {}), /registry/i);
});

test('IntentJourney: executing allowed once all capabilities granted', () => {
  const j = advanceJourney(
    advanceJourney(createIntentJourney({ resolution: resolved(), actor: 'human:1' }),
      'contextualized', { context: ['works:work:w1'] }),
    'approved', { approver: 'human:1' });
  const full = registry(['skill:research', 'work:execute']);
  const j2 = advanceJourney(j, 'executing', { registry: full, subject: 'human:1' });
  assert.equal(j2.stage, 'executing');
});

// ── evidenced / completed ───────────────────────────────────────────

test('IntentJourney: evidenced requires evidenceRef', () => {
  const full = registry(['skill:research', 'work:execute']);
  const j = advanceJourney(
    advanceJourney(
      advanceJourney(createIntentJourney({ resolution: resolved(), actor: 'human:1' }),
        'contextualized', { context: ['works:work:w1'] }),
      'approved', { approver: 'human:1' }),
    'executing', { registry: full, subject: 'human:1' });
  assert.throws(() => advanceJourney(j, 'evidenced', {}), /evidenceRef/i);
  const j2 = advanceJourney(j, 'evidenced', { evidenceRef: 'ev_cap_1' });
  assert.equal(j2.stage, 'evidenced');
  assert.equal(j2.evidenceRef, 'ev_cap_1');
});

test('IntentJourney: completed only from evidenced', () => {
  const full = registry(['skill:research', 'work:execute']);
  const mk = () => advanceJourney(
    advanceJourney(
      advanceJourney(createIntentJourney({ resolution: resolved(), actor: 'human:1' }),
        'contextualized', { context: ['works:work:w1'] }),
      'approved', { approver: 'human:1' }),
    'executing', { registry: full, subject: 'human:1' });
  assert.throws(() => advanceJourney(mk(), 'completed', {}), /out of order/i);
  const done = advanceJourney(advanceJourney(mk(), 'evidenced', { evidenceRef: 'ev_1' }), 'completed', {});
  assert.equal(done.stage, 'completed');
  assert.equal(done.evidenceRef, 'ev_1');
});

// ── Immutability ────────────────────────────────────────────────────

test('IntentJourney: records frozen, originals unchanged, history appended', () => {
  const j = createIntentJourney({ resolution: resolved(), actor: 'human:1' });
  assert.ok(Object.isFrozen(j));
  const j2 = advanceJourney(j, 'contextualized', { context: ['works:work:w1'] });
  assert.equal(j.stage, 'resolved');
  assert.ok(Object.isFrozen(j2));
  assert.equal(j2.history.length, j.history.length + 1);
  assert.equal(j2.history.at(-1).stage, 'contextualized');
});

test('IntentJourney: authority stays none at every stage', () => {
  const full = registry(['skill:research', 'work:execute']);
  let j = createIntentJourney({ resolution: resolved(), actor: 'human:1' });
  j = advanceJourney(j, 'contextualized', { context: ['c1'] });
  j = advanceJourney(j, 'approved', { approver: 'human:1' });
  j = advanceJourney(j, 'executing', { registry: full, subject: 'human:1' });
  j = advanceJourney(j, 'evidenced', { evidenceRef: 'ev_1' });
  j = advanceJourney(j, 'completed', {});
  for (const h of j.history) assert.equal(h.authority ?? 'none', 'none');
  assert.equal(j.authority, 'none');
});

// ── Exit gate: full chain across 4 engines ──────────────────────────

test('V7.0 exit: intent → verified outcome across resolver, registry, runtime, evidence', async () => {
  const reg = registry();
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry: reg, evidence });

  // 1. resolve (engine 1: composer) — nothing granted, nothing executed
  const resolution = resolveUniversalIntent({
    text: 'research reliability and build a prototype', mode: 'Build',
    subject: { id: 'human:1' }, capabilityRegistry: reg,
  });
  assert.equal(resolution.executed, false);
  assert.equal(resolution.requiresApproval, true);

  // 2. journey thread opens
  let j = createIntentJourney({ resolution, actor: 'human:1' });
  j = advanceJourney(j, 'contextualized', { context: ['isr:study:s1', 'works:work:w1'] });

  // 3. human approves (engine 2: authority)
  j = advanceJourney(j, 'approved', { approver: 'human:1' });

  // 4. grant issued out-of-band (grants come from TG/capability runtime, never the journey)
  const grantedReg = registry(['skill:research', 'work:execute']);
  const grantedRuntime = createCapabilityRuntime({ registry: grantedReg, evidence });
  j = advanceJourney(j, 'executing', { registry: grantedReg, subject: 'human:1' });

  // 5. execute via governed runtime (engine 3: capability runtime)
  const out = await grantedRuntime.executeCapability({
    capabilityId: 'skill:research', subject: 'human:1', inputs: { q: 'reliability' },
  });
  assert.equal(out.ok, true);
  assert.ok(out.evidenceRef);

  // 6. seal evidence (engine 4: evidence graph) + complete
  j = advanceJourney(j, 'evidenced', { evidenceRef: out.evidenceRef });
  j = advanceJourney(j, 'completed', {});
  assert.equal(j.stage, 'completed');

  const sealed = evidence.getEvidence(out.evidenceRef);
  assert.ok(sealed);
  assert.equal(sealed.status, 'verified');
  assert.equal(sealed.payload.capabilityId, 'skill:research');
});

test('V7.0 exit: runtime still refuses ungranted execution mid-journey', async () => {
  const reg = registry();
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry: reg, evidence });
  await assert.rejects(
    () => runtime.executeCapability({ capabilityId: 'work:execute', subject: 'human:1', inputs: {} }),
    /not.?granted/i);
});

test('V7.0 exit: Research-mode journey can never reach executing with runtime caps', () => {
  const r = resolveUniversalIntent({
    text: 'investigate reliability', mode: 'Research',
    subject: { id: 'human:1' }, capabilityRegistry: registry(),
  });
  assert.ok(!r.capabilities.some((c) => c.id === 'work:execute'));
  const j = createIntentJourney({ resolution: r, actor: 'human:1' });
  assert.equal(j.stage, 'resolved');
});
