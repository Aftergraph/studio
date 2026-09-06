# Aftergraph V6 — Unified Intelligence Operating Environment

Date: 2026-09-06
Version: 6.0.0

## Architecture Overview

Aftergraph V6 unifies intelligence orchestration, deep agentic execution, living spatial visualization, and federated upstream services into a single, cohesive operating environment.

### Core Architecture & Invariants
- **Primary Human Modes**: Chat, Work, Space — fast mode-switch without navigation loss or full re-renders.
- **Contextual Domains**: NOW, RESEARCH, AGENTS, BRAIN, CAPABILITIES, CONTROL, CONNECT, OUTPUT, SYSTEM.
- **Authoritative Separation of Concerns**:
  - `WorkItem != WORKS Work` (Work Intelligence is observation/proposal only; execution authority resides strictly in WORKS).
  - `Research Claim != Runtime Authority` (ISR Research provides evidence/proposals; cannot mutate runtime policies).
  - `Capability Discovery != Capability Grant` (AVC / skills registry discovery requires explicit policy-gated grants).
- **Federated Engine & Graphs**:
  - Unified Object Graph (`src/federation/object-graph.mjs`)
  - Authority Graph (`src/federation/authority-graph.mjs`)
  - Evidence Graph (`src/federation/evidence-graph.mjs`)
  - Capability Graph (`src/federation/capability-graph.mjs`)
  - Federated Registry & Engine (`src/federation/registry.mjs`, `src/federation/engine.mjs`)
  - Federated Search & NOW Projection (`src/federation/search.mjs`, `src/federation/now-projection.mjs`)
- **Universal Spatial & Composer Surfaces**:
  - Universal Composer (`src/views/universal-composer.mjs`, `packages/composer/`)
  - Universal Space (`src/views/universal-space.mjs`, `packages/spatial/`)
  - Research View (`src/views/research-view.mjs`) & Capabilities View (`src/views/capabilities-view.mjs`)
- **Safety & Resilience**:
  - Non-optimistic consequential writes: remote approvals delegate directly to Trust Gateway; WI promotion fails closed without human confirmation.
  - Partial federation resilience: unconfigured or offline engines degrade gracefully without crashing the shell or blocking local work.
  - Revision drift fail-closed: validation asserts exact-head alignment against upstream manifests.
  - Zero credential leakage: credentials, secrets, and auth tokens are stripped from state, SSE payloads, and UI render trees.

## Accessibility Gate (WCAG 2.2 AA)
- Vendored `axe-core 4.10.3` (`scripts/vendor/axe.min.js`, SHA-256: `880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb`).
- License documentation: `scripts/vendor/AXE-LICENSE.txt` (MPL-2.0).
- Automated a11y suite (`scripts/a11y_smoke.py`) executes Playwright + real axe-core across 8 viewport/surface combinations.
- Result: **0 critical, 0 serious, 0 moderate, 0 minor violations**.

## Verification Summary
- **302/302** Node tests pass (`npm test`).
- **39/39** Workspace syntax, architecture, and contract assertions pass (`node scripts/verify.mjs`).
- Platform source checks pass (`node scripts/platform_verify.mjs`).
- Exact-head source truth checks pass (`node scripts/verify-upstreams.mjs`).
- Browser smoke checks pass (`python scripts/browser_smoke.py`, `python scripts/browser_smoke_v5.py`).
- Fullstack server integration & browser bridge smoke pass (`python scripts/fullstack_bridge_smoke_v5.py`).
- Polyrepo upstream adapters, hub, and browser bridge smoke pass (`python scripts/polyrepo_bridge_smoke_v5.py`).
- Release verification suite (`npm run verify:release`): **100% PASS across all 8 gates**.

## Ecosystem & Brand Releases
- Established official **Aftergraph Studio** (@aftergraph/studio, Aftergraph/studio).
- Deployed official **Aftergraph Brand System** (@aftergraph/brand, Aftergraph/brand).
- Added GitHub Actions CI/CD workflows for both repositories.
- Registered Studio and Brand in Aftergraph/.github profile ecosystem table.
- Full 16-gate monolithic verification verified 100% green.
## [V6.4] — Research OS

### Added
- `src/research/surface-registry.mjs` — 5 typed research surfaces (Study, Experiment, Claim, Evidence, Paper), all isr-owned, zero runtime authority
- `src/research/promotion-pipeline.mjs` — staged human-gated promotion pipeline (proposed → reviewed → approved → promoted); runtimeAuthority always 'none'; promoted stage emits capability-grant-request, never a grant
- `tests/v6-4-research-os.test.mjs` — 14 test cases covering surface invariants and pipeline stage machine
- Gate 16 added to release verifier (V6.4 Research OS Exit Gate)

### Invariant
Research result can never implicitly become runtime authority. Promotion requires explicit human reviewer and approver at every stage.
## [V6.5] — Venture OS

### Added
- `src/venture/cell-registry.mjs` — ProductCell (id, goal, status required); mission creation requires humanApproved
- `src/venture/budget.mjs` — BudgetEnvelope with hard ceiling; exceeded blocks consumption; expansion requires humanApproved; settle() records allocated vs actual
- `src/venture/workforce.mjs` — Workforce roster with verifier≠executor enforcement, no self-assign, freezable roster
- `src/venture/mission-outcome.mjs` — MissionOutcome with verifier≠executor hard throw; verified outcomes require verifier_id; failed outcomes record cost
- `src/venture/portfolio.mjs` — read-only derived Portfolio (authority: 'none'); aggregates missions and cost across cells
- `src/venture/avc-integration.mjs` — AVC federation manifest; authority never includes execute
- `tests/v6-5-venture-os.test.mjs` — 20 test cases covering all V6.5 invariants
- Gate 17 added to release verifier (V6.5 Venture OS Exit Gate)

### Fixed
- `packages/brand` converted from dangling gitlink to vendored files at exact-head 52ae51a of Aftergraph/brand
- `upstreams/` vendored in-repo; verify.mjs, verify-upstreams.mjs and source-truth-bundle.test.mjs now resolve in-repo upstreams/

### Invariant
Product Cell → mission (human-approved) → workforce execution → verifier seals outcome → budget settled → portfolio updated. Nothing in the chain can be skipped or auto-approved.

## [V7.0] — Intent Operating System (Intent Journey)

### Added
- `src/intent/journey.mjs` — immutable stage machine
  `resolved → contextualized → approved → executing → evidenced → completed`;
  grants nothing, records only; authority 'none' at every stage.
- `server/intent-routes.mjs` — `POST /api/v1/federation/intent/resolve|advance`
  wired into federation routes (thin layer over the journey machine).
- `tests/v7-0-intent-journey.test.mjs` — 17 tests incl. full exit-chain test
  across resolver, registry, capability runtime, evidence graph.
- `scripts/v6_release_verify.mjs` — Gate 19: V7.0 Intent Journey Exit Gate.

### Invariants
- Resolver never executes; `executing` requires every capability granted
  in the live registry; `completed` requires sealed evidenceRef;
  stages advance immediate-next only.

## [V7.1] — Adaptive Workspace

### Added
- `src/workspace/adaptive-composer.mjs` — `composeAdaptive()` builds the
  workspace from objectType + journeyStage + context + intent + grants.
  Typed surface descriptors only, never markup, never authority.
- `server/workspace-routes.mjs` — `GET /api/v1/federation/workspace/compose`
  wired into federation routes (read-only composition endpoint).
- `tests/v7-1-adaptive-workspace.test.mjs` — 13 tests incl. journey-driven
  end-to-end composition (resolved vs approved renders differently).
- `scripts/v6_release_verify.mjs` — Gate 20: V7.1 Adaptive Workspace Exit Gate.

### Invariants
- Only registered surface kinds emitted (closed vocabulary
  `ADAPTIVE_SURFACE_KINDS`); unknown types fall back, never invent.
- Execute intent without grant omits action-bar with explicit reason.
- Plan frozen; JSON contains zero markup.

## [V7.2] — Agent Society

### Added
- `src/society/agent-society.mjs` — bounded team composition, coordinator-led
  delegation, ordered handoffs, and verifier separation over V6.5 Workforce.
- `server/society-routes.mjs` — team, delegate, execute, verify and chain
  endpoints under `/api/v1/federation/society`.
- `packages/ui/agents/agent-card.mjs` — `AGDelegationStrip` makes the
  executor→verifier topology explicit in the existing AGENTS surface.
- `tests/v7-2-agent-society.test.mjs` — 15 domain tests; server API coverage
  verifies the full delegation chain.
- `scripts/v6_release_verify.mjs` — Gate 21: V7.2 Agent Society Exit Gate.

### Invariants
- Agents cannot self-assign, self-promote, self-approve, or self-verify.
- `verifier !== executor`; verification requires prior execution evidence.
- Team topology and handoffs carry `authority: 'none'`.

## [V7.3] — Temporal Intelligence

### Added
- `src/temporal/temporal-intelligence.mjs` — deterministic historical
  reconstruction, immutable counterfactual branches, and explicit future
  trajectories.
- `GET /api/v1/temporal` — read-only temporal projection endpoint for
  historical, counterfactual, and forecast modes.
- Replay UI now exposes Historical, Counterfactual, and Forecast modes.
- `tests/v7-3-temporal-intelligence.test.mjs` — temporal invariants and
  zero-authority exit-chain coverage.
- `scripts/v6_release_verify.mjs` — Gate 22: V7.3 Temporal Intelligence Exit Gate.

### Invariants
- Temporal views are deterministic and immutable.
- Counterfactuals never mutate historical state or execute actions.
- Future trajectories are forecasts only: `executed: false`, `authority: 'none'`.

## [V7.4] — Outcome Economy

### Added
- `src/economy/outcome-economy.mjs` — integer-cent attributable cost ledger,
  idempotent entries, evidence-bound settlement, and reconciliation.
- `GET /api/v1/temporal` remains read-only; economy never moves money or issues
  invoices.
- Outcome receipts can show actual vs allocated cost without implying payment.
- `tests/v7-4-outcome-economy.test.mjs` — 10 tests for cents precision,
  budget overruns, evidence, idempotency and reconciliation.
- `scripts/v6_release_verify.mjs` — Gate 23: V7.4 Outcome Economy Exit Gate.

### Invariants
- All amounts are finite, non-negative integer cents within safe integer range.
- Budget overrun blocks settlement until explicit human approval.
- Cost, evidence and outcome remain attributable; authority stays `none`.

## [V8.0] — Institutional Intelligence

### Added
- `src/institution/institutional-graph.mjs` — organization, membership and
  policy graph with scoped authorization and immutable projections.
- `server/institutional-routes.mjs` — human-gated organization, membership
  and policy mutations plus read-only projection and authorization reads.
- `packages/ui/system/institution-summary.mjs` — Control-surface institutional
  scope summary that never presents projection as authority.
- `tests/v8-0-institutional-intelligence.test.mjs` — organization, policy,
  cross-org, API and UI contract coverage.
- `scripts/v6_release_verify.mjs` — Gate 24: V8.0 Institutional Intelligence.

### Invariants
- Cross-organization relations and authorization fail closed.
- Policy and membership changes require human approval.
- Explicit deny wins over allow; projections carry `authority: 'none'`.
