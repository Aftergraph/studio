# Source-of-Truth Mapping — Aftergraph Workspace V5

This package is the local full-stack reference implementation of the approved **Aftergraph V5 C Agentic Operating Environment**. It builds on the previously verified Aftergraph architecture but is not represented as a byte-identical checkout of upstream repositories.

## Layered canonical ownership

1. **`Aftergraph/trust-gateway`** — product UX/application, adaptive workspace, approvals, Needs You, capability/risk-aware presentation and command surfaces.
2. **`Aftergraph/intelligence-systems-research`** — human-experience research, mission-centric UX, progressive disclosure, cost/risk/outcome visibility and completion ≠ verification.
3. **`Aftergraph/after-graph-governance`** — cross-repo ownership, naming and evidence-layer boundaries.
4. **`Aftergraph/works-execution`** — durable work/execution, evidence, recovery and settlement semantics.
5. **`Aftergraph/work-intelligence-v2`** — signal/observation → candidate → review → publication semantics.
6. **`Aftergraph/aie`** — authority, delegation, revocation, policy and evidence semantics.

## V5 product truth inside this package

- **Design contract:** `docs/superpowers/specs/2026-09-05-aftergraph-v5-agentic-operating-environment-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-09-05-aftergraph-v5-implementation.md`
- **Visible implementation:** `src/main.mjs`, `v4.css`, `v5.css`, `packages/*`
- **Durable full-stack backend:** `server.mjs`, `src/server-store.mjs`, `src/server-runtime-hub.mjs`
- **Client/backend reconciliation:** `src/api-client.mjs`, `src/backend-reconciliation.mjs`
- **Replay model:** `src/replay.mjs`
- **Spatial lifecycle:** `src/spatial-lifecycle.mjs`
- **Automated evidence:** `tests/*.test.mjs`, `scripts/verify.mjs`, `scripts/browser_smoke.py`, `scripts/browser_smoke_v5.py`, `scripts/fullstack_bridge_smoke_v5.py`
- **Native source contracts:** `platforms/expo`, `platforms/swiftui`

## Human-facing vs canonical architecture

Human-facing primary modes:

`CHAT · WORK · SPACE`

Canonical ownership remains:

`NOW · CHAT · WORK · AGENTS · BRAIN · OUTPUT · CONTROL · CONNECT · SYSTEM`

Space is a human interaction mode owned by WORK semantics; it does not become a tenth canonical domain.

## Inhouse UI boundary

The approved **B model** remains canonical:

> Aftergraph owns product component APIs, semantics, tokens, icon language, motion language and visual behavior. Low-level headless/accessibility primitives may be used internally without becoming the visible design system.

V5 first-party package set:

- `@aftergraph/ui`
- `@aftergraph/motion`
- `@aftergraph/tokens`
- `@aftergraph/icons`
- `@aftergraph/runtime-ui`
- `@aftergraph/spatial`
- `@aftergraph/presence`
- `@aftergraph/interaction`
- `@aftergraph/visualization`
- `@aftergraph/composer`

The reference filesystem uses local ESM package folders rather than published npm packages.

## Runtime truth

The local Node backend is real and persistence-backed. It provides HTTP/SSE contracts and durable state for the reference implementation.

The mission execution engine is deterministic by design so behavior can be reproduced in tests. It demonstrates execution, pause/resume, approval gating, verification, takeover/hand-back and outcome settlement without claiming connection to production WORKS/AIE/provider runtimes.

## Spatial truth

Space state is serializable and server-persisted. V5 supports typed surfaces, region docking, pointer drag, keyboard Move, focus, layout modes, semantic zoom, agent presence/follow and replay cursor persistence.

Motion does not own correctness; spatial state changes remain valid with reduced/no motion.

## Native truth

Expo and SwiftUI express the V5 Chat/Work/Space mental model and spatial/motion semantics. They are source/type/parse verified only in this environment.

## Benchmark truth

`BENCHMARK-CHATGPT-CLAUDE-2026-09-05.md` records the interaction-level benchmark used to simplify the shell before V4/V5. This project does not claim proprietary token extraction, pixel-identical cloning or access to competitor private implementation details.


## V5.1 polyrepo source truth

The polyrepo integration pins independently reviewed default-branch revisions in `src/integrations/upstream-hub.mjs` and the sibling `upstreams/UPSTREAM-MANIFEST.json`. Release verification fails on drift between those two sources.

Canonical ownership is preserved:

- Trust Gateway owns enforcement, approvals and audit.
- WORKS owns durable execution, journals, handoff, evidence and Company Brain.
- AIE owns normative authority and its A2A transport semantics.
- Work Intelligence V2 owns detection/observation/proposal semantics and has no implicit execution authority.
- After Graph Governance owns the materialized cross-repo contracts.
- ISR is a research/HCI reference, not a runtime authority.

The exact materialized contracts are `mission-state/1.0`, `policy.token/1.0`, and `work-intelligence-boundary/1.0`. Interface notes are not presented as byte-identical source files. See the sibling `upstreams/SOURCE-MATERIALIZATION.json`.

The session could not perform a full Git clone because container DNS could not resolve `github.com`. Repositories unavailable through the authenticated GitHub connector are explicitly recorded as tracked-but-not-materialized rather than simulated.
