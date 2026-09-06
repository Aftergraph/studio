// V6.5 Venture OS — Exit Gate Tests (node:test)
// Invariants: mission approval, verifier≠executor, no self-assign,
// budget ceiling, portfolio read-only

import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductCell, CellRegistry } from '../src/venture/cell-registry.mjs';
import { BudgetEnvelope } from '../src/venture/budget.mjs';
import { Workforce } from '../src/venture/workforce.mjs';
import { MissionOutcome } from '../src/venture/mission-outcome.mjs';
import { Portfolio } from '../src/venture/portfolio.mjs';
import { AVCIntegration } from '../src/venture/avc-integration.mjs';

// ── ProductCell ─────────────────────────────────────────────────────

test('VentureOS: ProductCell creation requires goal + status', () => {
  assert.throws(() => new ProductCell({ id: 'c1' }), /goal/i);
  assert.throws(() => new ProductCell({ id: 'c1', goal: 'ship' }), /status/i);
  const cell = new ProductCell({ id: 'c1', goal: 'ship v1', status: 'active' });
  assert.equal(cell.goal, 'ship v1');
  assert.equal(cell.status, 'active');
});

test('VentureOS: mission creation requires human approval', () => {
  const cell = new ProductCell({ id: 'c1', goal: 'ship', status: 'active' });
  assert.throws(
    () => cell.createMission({ id: 'm1', title: 'do thing' }),
    /human approval/i
  );
  const mission = cell.createMission({ id: 'm1', title: 'do thing', humanApproved: true });
  assert.equal(mission.id, 'm1');
  assert.equal(mission.status, 'approved');
});

test('VentureOS: CellRegistry only registers ProductCell instances', () => {
  const registry = new CellRegistry();
  assert.throws(() => registry.register({ id: 'fake' }), /ProductCell/);
  const cell = new ProductCell({ id: 'c1', goal: 'ship', status: 'active' });
  registry.register(cell);
  assert.equal(registry.get('c1'), cell);
});

// ── BudgetEnvelope ──────────────────────────────────────────────────

function makeBudget() {
  return new BudgetEnvelope({ id: 'b1', allocation: 1000 });
}

test('VentureOS: BudgetEnvelope sets exceeded flag when consumption > allocation', () => {
  const budget = makeBudget();
  budget.consume(900);
  assert.equal(budget.exceeded, false);
  budget.consume(200);
  assert.equal(budget.exceeded, true);
  assert.equal(budget.consumption, 1100);
});

test('VentureOS: BudgetEnvelope blocks consumption when exceeded', () => {
  const budget = makeBudget();
  budget.consume(1100);
  assert.throws(() => budget.consume(1), /budget exceeded/i);
});

test('VentureOS: BudgetEnvelope expansion requires human approval', () => {
  const budget = makeBudget();
  assert.throws(() => budget.expand(500), /requires human approval/i);
  budget.expand(500, { humanApproved: true });
  assert.equal(budget.allocation, 1500);
});

test('VentureOS: BudgetEnvelope settlement records actual vs allocated', () => {
  const budget = makeBudget();
  budget.consume(600);
  const settlement = budget.settle();
  assert.equal(settlement.allocated, 1000);
  assert.equal(settlement.actual, 600);
  assert.equal(settlement.variance, 400);
});

test('VentureOS: BudgetEnvelope requires numeric allocation', () => {
  assert.throws(() => new BudgetEnvelope({ id: 'b1' }), /allocation/i);
});

// ── Workforce ───────────────────────────────────────────────────────

function makeWorkforce() {
  const workforce = new Workforce({ id: 'w1' });
  workforce.addAgent({ id: 'a1', role: 'executor', name: 'Agent 1' });
  workforce.addAgent({ id: 'a2', role: 'verifier', name: 'Agent 2' });
  return workforce;
}

test('VentureOS: Workforce assignment enforces verifier ≠ executor', () => {
  const workforce = makeWorkforce();
  const assignment = workforce.assign({ missionId: 'm1', executorId: 'a1', verifierId: 'a2' });
  assert.equal(assignment.executorId, 'a1');
  assert.equal(assignment.verifierId, 'a2');
  assert.throws(
    () => workforce.assign({ missionId: 'm2', executorId: 'a1', verifierId: 'a1' }),
    /verifier must differ/i
  );
});

test('VentureOS: Workforce prevents agent self-assignment', () => {
  const workforce = makeWorkforce();
  assert.throws(
    () => workforce.assign({ missionId: 'm1', executorId: 'a1', verifierId: 'a2', selfAssigned: true }),
    /self-assign/i
  );
});

test('VentureOS: Workforce roster is frozen', () => {
  const workforce = makeWorkforce();
  workforce.freeze();
  assert.throws(
    () => workforce.addAgent({ id: 'a3', role: 'worker', name: 'Agent 3' }),
    /frozen/i
  );
});

test('VentureOS: Workforce assignment requires roster membership', () => {
  const workforce = makeWorkforce();
  assert.throws(
    () => workforce.assign({ missionId: 'm1', executorId: 'ghost', verifierId: 'a2' }),
    /not in roster/
  );
});

// ── MissionOutcome ──────────────────────────────────────────────────

test('VentureOS: MissionOutcome requires verifier_id for verified status', () => {
  assert.throws(
    () => new MissionOutcome({ missionId: 'm1', verdict: 'success', verifierId: null }),
    /verifier required/i
  );
});

test('VentureOS: MissionOutcome verifier ≠ executor (hard throw)', () => {
  assert.throws(
    () => new MissionOutcome({ missionId: 'm1', verdict: 'success', executorId: 'a1', verifierId: 'a1' }),
    /verifier must differ/i
  );
});

test('VentureOS: MissionOutcome failed outcome records cost', () => {
  const outcome = new MissionOutcome({
    missionId: 'm1',
    verdict: 'failed',
    executorId: 'a1',
    verifierId: 'a2',
    costActual: 250,
  });
  assert.equal(outcome.costActual, 250);
  assert.equal(outcome.verdict, 'failed');
  assert.equal(outcome.status, 'recorded');
});

test('VentureOS: MissionOutcome rejects invalid verdict', () => {
  assert.throws(
    () => new MissionOutcome({ missionId: 'm1', verdict: 'maybe', executorId: 'a1', verifierId: 'a2' }),
    /valid verdict/i
  );
});

// ── Portfolio ───────────────────────────────────────────────────────

test('VentureOS: Portfolio is read-only, derived, no authority', () => {
  const portfolio = new Portfolio();
  assert.equal(portfolio.authority, 'none');
  // Portfolio exposes no authority-granting surface
  assert.throws(() => portfolio.grantAuthority(), TypeError);
});

test('VentureOS: Portfolio aggregates correctly across cells', () => {
  const portfolio = new Portfolio();
  portfolio.addCell({ id: 'c1', missions: 3, cost: 500 });
  portfolio.addCell({ id: 'c2', missions: 2, cost: 300 });
  assert.equal(portfolio.totalMissions, 5);
  assert.equal(portfolio.totalCost, 800);
});

// ── AVC integration boundary ────────────────────────────────────────

test('VentureOS: AVC integration authority never includes execute', () => {
  const integration = new AVCIntegration();
  const manifest = integration.getManifest();
  assert.ok(!manifest.authority.includes('execute'), 'authority must never include execute');
});

test('VentureOS: AVC integration rejects unknown surfaces', () => {
  const integration = new AVCIntegration();
  assert.throws(() => integration.getSurface('nope'), /Unknown AVC surface/);
  const surface = integration.getSurface('missions');
  assert.equal(surface.authority, 'read');
});
