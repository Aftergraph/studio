import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESEARCH_SURFACES,
  createResearchSurface,
  getSurfaceSchema,
} from '../src/research/surface-registry.mjs';
import {
  createPromotionPipeline,
  advancePromotion,
  PROMOTION_STAGES,
} from '../src/research/promotion-pipeline.mjs';

// ── Surface registry ────────────────────────────────────────────────
test('ResearchOS: all 5 surfaces registered', () => {
  const expected = ['study', 'experiment', 'claim', 'evidence', 'paper'];
  for (const s of expected) assert.ok(RESEARCH_SURFACES.has(s), `missing surface: ${s}`);
  assert.equal(RESEARCH_SURFACES.size, expected.length);
});

test('ResearchOS: each surface has typed schema', () => {
  for (const [name] of RESEARCH_SURFACES) {
    const schema = getSurfaceSchema(name);
    assert.ok(schema.fields, `${name} missing fields`);
    assert.ok(schema.authority === 'isr', `${name} must be owned by isr`);
    assert.ok(schema.promotable === true || schema.promotable === false, `${name} must declare promotable`);
  }
});

test('ResearchOS: createResearchSurface enforces required fields', () => {
  assert.throws(
    () => createResearchSurface('claim', {}),
    /id.*required|required.*id/i
  );
});

test('ResearchOS: createResearchSurface claim has no runtime authority', () => {
  const claim = createResearchSurface('claim', {
    id: 'C-42',
    title: 'Latency improves with batching',
    status: 'validated',
    evidenceIds: ['E-1'],
  });
  assert.equal(claim.surface, 'claim');
  assert.equal(claim.authority, 'isr');
  assert.deepEqual(claim.runtimeAuthority, []);
  assert.ok(Object.isFrozen(claim));
});

test('ResearchOS: paper surface records are read-only', () => {
  const paper = createResearchSurface('paper', {
    id: 'P-1',
    title: 'Bounded Agents',
    doi: '10.1/test',
    status: 'published',
  });
  assert.throws(() => { paper.title = 'mutated'; }, TypeError);
});

// ── Promotion pipeline ──────────────────────────────────────────────
test('ResearchOS: promotion stages in correct order', () => {
  assert.deepEqual(PROMOTION_STAGES, ['proposed', 'reviewed', 'approved', 'promoted']);
});

test('ResearchOS: pipeline starts at proposed', () => {
  const p = createPromotionPipeline({
    claimId: 'C-42',
    target: 'aie',
    actor: 'human:eve',
    reason: 'candidate spec',
  });
  assert.equal(p.stage, 'proposed');
  assert.equal(p.runtimeAuthority, 'none');
  assert.equal(p.requiresHumanApproval, true);
});

test('ResearchOS: advance proposed → reviewed requires reviewer', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  assert.throws(() => advancePromotion(p, 'reviewed', {}), /reviewer.*required|required.*reviewer/i);
});

test('ResearchOS: advance proposed → reviewed with reviewer', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  const p2 = advancePromotion(p, 'reviewed', { reviewer: 'human:adam', notes: 'looks good' });
  assert.equal(p2.stage, 'reviewed');
  assert.equal(p2.runtimeAuthority, 'none');
  assert.equal(p.stage, 'proposed', 'original unchanged (immutable step)');
});

test('ResearchOS: advance reviewed → approved requires approver', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  const p2 = advancePromotion(p, 'reviewed', { reviewer: 'human:adam' });
  assert.throws(() => advancePromotion(p2, 'approved', {}), /approver.*required|required.*approver/i);
});

test('ResearchOS: advance to approved records approver, still no runtime authority', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  const p2 = advancePromotion(p, 'reviewed', { reviewer: 'human:adam' });
  const p3 = advancePromotion(p2, 'approved', { approver: 'human:ceo', policy: 'P-001' });
  assert.equal(p3.stage, 'approved');
  assert.equal(p3.runtimeAuthority, 'none');
  assert.equal(p3.policy, 'P-001');
});

test('ResearchOS: promoted stage emits capability-grant-request, NOT a grant', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  const p2 = advancePromotion(p, 'reviewed', { reviewer: 'human:adam' });
  const p3 = advancePromotion(p2, 'approved', { approver: 'human:ceo', policy: 'P-001' });
  const p4 = advancePromotion(p3, 'promoted', { grantedBy: 'human:ceo' });
  assert.equal(p4.stage, 'promoted');
  assert.equal(p4.kind, 'capability-grant-request');
  assert.equal(p4.runtimeAuthority, 'none', 'promotion pipeline never issues runtime authority');
  assert.ok(Object.isFrozen(p4));
});

test('ResearchOS: cannot skip stages', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  assert.throws(() => advancePromotion(p, 'approved', { approver: 'human:ceo' }), /stage.*order|out.of.order|invalid transition/i);
});

test('ResearchOS: cannot regress stages', () => {
  const p = createPromotionPipeline({ claimId: 'C-1', target: 'aie', actor: 'human:eve' });
  const p2 = advancePromotion(p, 'reviewed', { reviewer: 'human:adam' });
  assert.throws(() => advancePromotion(p2, 'proposed', {}), /stage.*order|out.of.order|invalid transition/i);
});
