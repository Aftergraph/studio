# Aftergraph Billing Hybrid App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing review-first Billing workflow into an installable standalone Aftergraph Billing PWA while preserving Studio integration, one canonical financial engine, and a clean future extraction path to `Aftergraph/billing`.

**Architecture:** Keep `src/billing/` and the existing guarded API as the single source of truth. Add a `/billing/` app shell, manifest, service worker and read-only cache layer, retain Studio as a launcher/back-office surface, and explicitly prohibit offline financial mutations. Preserve HTTP/domain contracts so the app can later be moved to a dedicated repository and optionally consumed by an Expo native client.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, existing Studio durable state/API, plain HTML/CSS/ES modules, Web App Manifest, Service Worker API, Cache API, Aftergraph semantic tokens.

**Spec:** `docs/superpowers/specs/2026-09-11-aftergraph-billing-hybrid-app-design.md`

## Global Constraints

- Zero new runtime dependencies.
- Existing readiness, money, duplicate and idempotency rules remain canonical.
- Calendar duration is never billable evidence.
- Consequential Billing writes are network-only and fail closed offline.
- Cached Billing data is read-only, minimal and visibly marked stale.
- No access/key/alarm/credential information may enter PWA caches or projections.
- Preserve Studio Chat/Work/Space primary navigation.
- Keep PR #55 draft until exact-head verification is green.

---

### Task 1: Hybrid product contracts and PWA source tests

**Files:**
- Modify: `tests/billing-ui-contract.test.mjs`
- Create: `tests/billing-pwa.test.mjs`

**Interfaces:**
- Produces source-level contracts for `/billing/`, `manifest.webmanifest`, service worker registration, offline-write prohibition and compatibility redirect.

- [ ] Add a failing test that reads `billing/index.html` and asserts the title `Aftergraph Billing`, manifest link, mobile viewport/safe-area metadata and module bootstrap.
- [ ] Add a failing test that reads `billing/manifest.webmanifest` and asserts `name`, `short_name`, `start_url: /billing/`, `scope: /billing/`, `display: standalone`, and at least 192/512 icon entries.
- [ ] Add a failing test that reads `billing/sw.js` and asserts mutation paths are never cached and the code contains no Background Sync write queue.
- [ ] Add a failing test that asserts `billing.html` redirects to `/billing/` and Studio still links to `/billing/`.
- [ ] Run `node --test tests/billing-pwa.test.mjs tests/billing-ui-contract.test.mjs` and confirm RED before implementation.

### Task 2: Standalone Billing app shell and installability

**Files:**
- Create: `billing/index.html`
- Create: `billing/manifest.webmanifest`
- Create: `billing/sw.js`
- Create: `src/billing/pwa.mjs`
- Modify: `billing.html`
- Modify: `styles/billing.css`

**Interfaces:**
- `registerBillingPwa({onConnectivityChange})` registers the worker and reports online/offline state.
- `/billing/` is the canonical app URL.
- `/billing.html` performs a compatibility redirect preserving query/hash.

- [ ] Implement `billing/index.html` by moving the existing Billing shell to the canonical `/billing/` path and adding manifest/apple-mobile/status metadata.
- [ ] Implement a manifest with Aftergraph Billing product identity, standalone display, theme/background colors, and 192/512 icon paths.
- [ ] Implement `src/billing/pwa.mjs` with feature-detected service-worker registration and `online`/`offline` listeners.
- [ ] Implement `billing/sw.js` with static-shell cache-first handling, navigation network-first handling, and explicit network-only behavior for `/api/v1/billing` mutations.
- [ ] Replace `billing.html` with a minimal compatibility redirect to `/billing/` preserving `location.search` and `location.hash`.
- [ ] Extend CSS with standalone safe-area padding and mobile bottom-action accommodation.
- [ ] Re-run focused PWA/UI tests and confirm GREEN.

### Task 3: Read-only offline projection and recovery

**Files:**
- Modify: `src/billing/browser-client.mjs`
- Modify: `src/billing/billing-app.mjs`
- Test: `tests/billing-pwa.test.mjs`

**Interfaces:**
- `createBillingClient()` keeps mutation methods network-only.
- Browser app stores only the last successful read projection in `localStorage` under `aftergraph.billing.read-cache.v1` with `syncedAt`.
- Cached state is rendered only after a canonical load fails and must be labelled stale.

- [ ] Add failing tests for a named read-cache key, stale-label copy and absence of mutation replay/queue APIs.
- [ ] Remove the incorrect `projectInvoice({ account, ... })` preview call and use only `projectInvoice({ customer, visits, taxRateBps })`.
- [ ] Persist a sanitized successful Billing read payload plus ISO `syncedAt` after `client.load()` succeeds.
- [ ] On load failure, render the last sanitized projection only when present and show `Offline · senest synkroniseret <time>`; otherwise show unavailable state.
- [ ] Disable actuals/draft/issue controls whenever `navigator.onLine === false` or the active state is cached/stale.
- [ ] On `online`, force a canonical refresh before re-enabling mutations.
- [ ] Re-run focused tests.

### Task 4: Product-level mobile information architecture

**Files:**
- Modify: `billing/index.html`
- Modify: `src/billing/billing-app.mjs`
- Modify: `styles/billing.css`
- Test: `tests/billing-ui-contract.test.mjs`

**Interfaces:**
- User-facing app views are `inbox`, `ready`, `waiting`, `needs_info`, `invoiced` while canonical domain status remains unchanged.
- Inbox orders actionable work `needs_info`, then `ready`, then `waiting`.

- [ ] Add source-contract tests for a compact Billing app nav and an `Inbox` default view without altering domain status names.
- [ ] Make Inbox the initial app view and compute it from existing projections without new persistence.
- [ ] Keep one clear primary action per item: add actuals, review invoice, or explanatory no-action state.
- [ ] Add a mobile sticky/bottom navigation/action treatment that respects `env(safe-area-inset-bottom)` and never obscures dialog/form controls.
- [ ] Preserve semantic tabs/labels and keyboard focus behavior.
- [ ] Re-run `node --test tests/billing-ui-contract.test.mjs tests/billing-pwa.test.mjs`.

### Task 5: Studio integration, extraction docs and exact-head verification

**Files:**
- Modify: `src/app/bootstrap.mjs`
- Create: `docs/billing/APP.md`
- Create: `docs/billing/EXTRACTION.md`
- Modify: PR #55 body

**Interfaces:**
- Studio Work deep-links to `/billing/`.
- Extraction doc defines the future `Aftergraph/billing` ownership boundary and native-client rule: API consumer only, no duplicated financial logic.

- [ ] Update Studio launcher/deep link from `/billing.html` to `/billing/` without adding a fourth primary Studio mode.
- [ ] Document install/use, offline safety, readiness workflow and current incubation deployment.
- [ ] Document exact extraction file/API boundaries and the constraint that Expo/native clients consume the same Billing API.
- [ ] Run exact-head GitHub CI and CodeQL through the PR workflow.
- [ ] Inspect failing job logs, fix root causes and repeat until required checks are green or an external blocker is proven.
- [ ] Update PR #55 description from initial TDD RED wording to the actual hybrid-product state and verification evidence.
- [ ] Keep PR draft until product verification is green and merge is explicitly approved by the user.
