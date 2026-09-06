# Aftergraph UI Kernel + Living Interface v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a first-party Aftergraph semantic component system and use it to turn Workspace v3 into a live, immersive, adaptive Workspace v4.

**Architecture:** Preserve the v3 domain/state contracts, introduce five local ESM packages, and refactor the visible workspace around their semantic APIs. The motion package may load Motion 13.2.0 from esm.sh in-browser, but every essential transition has a no-network Web Animations/CSS fallback.

**Tech Stack:** HTML/CSS/ESM, Node.js 22 tests, Motion 13.2.0 optional browser runtime, Web Animations API fallback, Playwright/browser smoke harness already present in the reference project.

**Spec:** `docs/superpowers/specs/2026-09-05-aftergraph-ui-kernel-v4-design.md`

## Global Constraints
- Preserve canonical domains NOW, CHAT, WORK, AGENTS, BRAIN, OUTPUT, CONTROL, CONNECT, SYSTEM.
- Human-facing primary modes remain Chat and Work.
- External primitives are implementation details only; product-facing component names and styling are Aftergraph-owned.
- All consequential controls require explicit risk/authority/evidence semantics.
- Respect `prefers-reduced-motion`.
- Mobile must not horizontally overflow at 390px.
- Do not require an npm install to run the reference build.

---

### Task 1: Semantic foundations
**Files:** create `packages/tokens/index.mjs`, `packages/icons/index.mjs`, tests `tests/ui-kernel-v4.test.mjs`.
**Produces:** `TOKENS`, `MOTION_TOKENS`, `iconSpec()`.
- [x] Write tests asserting semantic token groups, motion classes and icon vocabulary.
- [x] Run tests and confirm RED because modules do not exist.
- [x] Implement minimum exports.
- [x] Run tests and confirm GREEN.

### Task 2: Motion runtime
**Files:** create `packages/motion/index.mjs`, extend `tests/ui-kernel-v4.test.mjs`.
**Produces:** `motionFor()`, `prefersReducedMotion()`, `animateElement()`, `morphSurface()`.
- [x] Add tests for duration class selection, reduced-motion collapse and deterministic surface transition descriptors.
- [x] Verify RED.
- [x] Implement semantics and browser-safe fallback runtime.
- [x] Verify GREEN.

### Task 3: Runtime composition
**Files:** create `packages/runtime-ui/index.mjs`, extend tests.
**Produces:** `composeLivingLayout(input)`, `attentionGravity(input)`.
- [x] Test normal chat, artifact split, destructive approval focus, takeover and mobile sheet composition.
- [x] Verify RED.
- [x] Implement deterministic composition.
- [x] Verify GREEN.

### Task 4: First-party semantic components
**Files:** create `packages/ui/index.mjs`, extend tests.
**Produces:** render functions for AGSurface, AGTrajectory, AGArtifact, AGApproval, AGNeedYou, AGComposer, AGAgentPresence.
- [x] Test semantic markup, ARIA roles and state attributes.
- [x] Verify RED.
- [x] Implement component renderers.
- [x] Verify GREEN.

### Task 5: Live mission simulator
**Files:** create `src/live-runtime.mjs`, extend `tests/state.test.mjs` or add `tests/live-runtime.test.mjs`.
**Produces:** `createLiveRuntime()`, `stepMission()`, `pauseMission()`, `resumeMission()`.
- [x] Test deterministic progress, approval pause, verification and outcome settlement.
- [x] Verify RED.
- [x] Implement runtime.
- [x] Verify GREEN.

### Task 6: Workspace v4 integration
**Files:** modify `src/main.mjs`, `index.html`, `styles.css`, `src/state.mjs`.
**Consumes:** packages from Tasks 1–5.
- [x] Add source-contract tests for component imports and v4 hooks.
- [x] Verify RED.
- [x] Refactor Chat/Work shell to use semantic components and live runtime.
- [x] Add artifact morph, attention-gravity approval, evidence reveal, takeover and outcome settlement.
- [x] Verify GREEN.

### Task 7: Immersive visual and motion system
**Files:** modify `styles.css`, `src/main.mjs`, service worker/manifest if needed.
- [x] Add source tests for reduced motion, ambient state class, surface morph class and resizable split handle.
- [x] Verify RED.
- [x] Implement cinematic local surfaces, ambient activity field, shared-surface transitions and responsive interactions.
- [x] Verify GREEN.

### Task 8: Mobile + native contract update
**Files:** update `platforms/expo/*`, `platforms/swiftui/*`, `scripts/platform_verify.mjs`.
- [x] Add platform contract checks for semantic motion names and approval/artifact presentation.
- [x] Verify RED.
- [x] Implement/update source contracts.
- [x] Verify GREEN.

### Task 9: QA and packaging
**Files:** update `README.md`, `QA-REPORT.md`, `SOURCE-OF-TRUTH.md`, `CHANGELOG-v4.md`, screenshots, checksums.
- [x] Run full Node tests.
- [x] Run source verification.
- [x] Run browser smoke and 390px overflow checks.
- [x] Run platform verification.
- [x] Capture desktop chat, artifact, approval, live state and mobile screenshots.
- [x] Compare implementation against `design-concept-v4.png` on hierarchy, typography, density, motion states, surface treatment and mobile behavior; fix material drift.
- [x] Build ZIP and validate archive integrity and SHA-256.
