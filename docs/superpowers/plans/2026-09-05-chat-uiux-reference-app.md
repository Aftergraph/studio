# Aftergraph Chat UI/UX Reference App Implementation Plan

> **SUPERSEDED** — This plan is superseded by the V3→V4→V5 implementation track. 0 tasks from this plan were executed; all work landed through the later iterations instead. Retained for historical context only. Do not implement tasks below.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, dependency-free, production-style reference app implementing Aftergraph's canonical 9-domain adaptive Chat UI/UX contract.

**Architecture:** A static PWA shell uses pure ES modules for domain routing, deterministic surface composition, persisted local application state, typed chat events, Needs You, approvals, artifacts, agents, context/memory and command-palette navigation. A zero-dependency Node server hosts the app and rewrites deep links to the shell. Core behavior is TDD-tested with Node's built-in test runner.

**Tech Stack:** HTML5, CSS, native ES modules, Node.js 22+, node:test, PWA Service Worker, localStorage.

**Spec:** Canonical UX contract derived from Aftergraph/trust-gateway docs/ux, with research constraints from intelligence-systems-research and ownership boundaries from after-graph-governance.

## Global Constraints

- Canonical top-level IA: NOW, CHAT, WORK, AGENTS, BRAIN, OUTPUT, CONTROL, CONNECT, SYSTEM.
- Design principle: Objects persist. Surfaces adapt. Capabilities extend. Agents act. Humans retain control.
- UI composition must be deterministic and risk/capability/device/approval-aware.
- Destructive work must not execute without explicit approval.
- Needs You must be exception-first.
- Completion must not be presented as verification without evidence.
- No external runtime dependencies or CDN assets.
- Keyboard accessibility and reduced motion must be supported.
- App must run offline after first load.

---

### Task 1: Canonical domain + deep-link contract
**Files:** `src/domain.mjs`, `src/router.mjs`, `tests/domain.test.mjs`
- [ ] Write failing tests for domain order, aliases and deep-link parsing.
- [ ] Run tests and observe RED.
- [ ] Implement minimal domain/router modules.
- [ ] Run tests and observe GREEN.

### Task 2: Dynamic composition engine
**Files:** `src/compose-engine.mjs`, `tests/compose-engine.test.mjs`
- [ ] Write failing tests for risk override, approval pinning, capability omission and mobile density.
- [ ] Run RED.
- [ ] Implement deterministic composition.
- [ ] Run GREEN.

### Task 3: Application state and controlled actions
**Files:** `src/state.mjs`, `tests/state.test.mjs`
- [ ] Write failing tests for Needs You resolution, approval decisions, takeover and verified mission settlement.
- [ ] Run RED.
- [ ] Implement immutable-ish state reducer helpers.
- [ ] Run GREEN.

### Task 4: Search / command palette
**Files:** `src/search.mjs`, `tests/search.test.mjs`
- [ ] Write failing fuzzy/prefix search tests.
- [ ] Run RED.
- [ ] Implement ranked search.
- [ ] Run GREEN.

### Task 5: App shell and all nine domains
**Files:** `index.html`, `styles.css`, `src/main.mjs`, `src/fixtures.mjs`
- [ ] Build semantic shell and domain rail.
- [ ] Render NOW, CHAT, WORK, AGENTS, BRAIN, OUTPUT, CONTROL, CONNECT, SYSTEM.
- [ ] Wire typed chat/composer, Needs You, approvals, artifacts, context inspector and runtime telemetry.
- [ ] Add keyboard interactions, focus management and reduced-motion support.

### Task 6: PWA and local server
**Files:** `manifest.webmanifest`, `sw.js`, `server.mjs`, `package.json`
- [ ] Add zero-dependency local server and deep-link fallback.
- [ ] Add service worker and manifest.
- [ ] Add start/test/verify scripts.

### Task 7: Verification and package
**Files:** `scripts/verify.mjs`, `README.md`, `SOURCE-OF-TRUTH.md`
- [ ] Run complete automated test suite.
- [ ] Start local server and smoke HTTP routes.
- [ ] Render desktop + mobile screenshots in headless Chromium.
- [ ] Inspect screenshots and fix visible issues.
- [ ] Create SHA-256 manifest.
- [ ] Zip the complete deliverable.
