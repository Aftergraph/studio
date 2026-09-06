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
