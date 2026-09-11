# Aftergraph Billing Workflow V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working, review-first Billing workflow inside Aftergraph Studio that deterministically turns completed operational visits into Ready, Waiting, Needs info, or Invoiced queues.

**Architecture:** Add an isolated pure billing domain under `src/billing/`, persist incubation data inside the existing workspace state, expose guarded API routes through the existing Node server, and provide a focused first-party `/billing.html` UI. Rendetalje scenarios are fixtures, not hard-coded rules.

**Tech Stack:** Node.js 22 ESM, built-in `node:test`, existing Studio durable state server, plain HTML/CSS/ES modules, Aftergraph semantic tokens.

**Spec:** `docs/superpowers/specs/2026-09-11-aftergraph-billing-workflow-v1-design.md`

## Global Constraints

- Zero external runtime dependencies.
- Calendar duration is never billable evidence; only verified actual work minutes are billable.
- Money uses integer minor units.
- V1 is review-first and never auto-sends invoices.
- Operational access/key/alarm details must never enter billing projections or fixtures.
- Unknown or contradictory financial inputs fail closed to `needs_info`.
- Preserve existing Chat/Work/Space behavior and existing verification commands.

---

### Task 1: Pure billing readiness and money engine

**Files:**
- Create: `src/billing/model.mjs`
- Create: `src/billing/readiness.mjs`
- Create: `src/billing/money.mjs`
- Test: `tests/billing-readiness.test.mjs`

**Interfaces:**
- Produces: `evaluateBilling({customers,visits,invoices,now})`, `projectInvoice({customer,visits,taxRateBps})`, `billingFixtureState()`.

- [ ] Write tests for per-visit Ready, monthly Waiting, missing actuals, duplicate protection, next-month non-blocking, discount/tax rounding.
- [ ] Run `node --test tests/billing-readiness.test.mjs` and confirm failures before implementation.
- [ ] Implement normalized model helpers and deterministic evaluator.
- [ ] Implement money projection using integer minor units.
- [ ] Re-run focused tests and `npm test`.
- [ ] Commit `feat(billing): add deterministic readiness engine`.

### Task 2: Workspace persistence and Rendetalje reference fixtures

**Files:**
- Modify: `src/state.mjs`
- Create: `src/billing/fixtures.mjs`
- Test: `tests/billing-state.test.mjs`

**Interfaces:**
- Consumes: pure billing types from Task 1.
- Produces: `state.billing = {customers,visits,invoices,settings}` in fixture mode; empty billing state otherwise.

- [ ] Write state fixture tests for Katrine Ready, Anton/Heidi/Casper waiting, Peder needs info, and empty production state.
- [ ] Add privacy-minimal reference fixtures.
- [ ] Seed billing state from `createInitialState` without altering non-fixture production semantics.
- [ ] Run focused tests and `npm test`.
- [ ] Commit `feat(billing): persist incubation state and fixtures`.

### Task 3: Guarded billing API

**Files:**
- Modify: `server/app-server.mjs`
- Create: `src/billing/mutations.mjs`
- Test: `tests/billing-api.test.mjs`

**Interfaces:**
- `GET /api/v1/billing`
- `POST /api/v1/billing/actuals`
- `POST /api/v1/billing/invoices/draft`
- `POST /api/v1/billing/invoices/:id/issue`

- [ ] Write API tests for projection read, persisted actuals, non-ready draft rejection, ready draft creation, duplicate prevention, actor/idempotency guard, and idempotent issue transition.
- [ ] Implement billing mutations as pure state transforms.
- [ ] Wire routes using existing `readJson`, `beginAction`, `completeAction`, durable store mutation and error conventions.
- [ ] Run focused API tests and `npm test`.
- [ ] Commit `feat(billing): add guarded billing API`.

### Task 4: Billing browser client and focused operator UI

**Files:**
- Create: `billing.html`
- Create: `src/billing/browser-client.mjs`
- Create: `src/billing/billing-app.mjs`
- Create: `styles/billing.css`
- Test: `tests/billing-ui-contract.test.mjs`

**Interfaces:**
- UI reads `GET /api/v1/billing` and renders four queues.
- Ready items expose `Review invoice`; other queues expose explanatory next actions only.

- [ ] Write source-contract tests for queue labels, semantic headings, status text, and absence of operational secret fields.
- [ ] Build responsive first-party Billing shell using existing tokens/reset CSS.
- [ ] Implement queue switching, amount summaries, plain-language reason mapping and accessible review drawer.
- [ ] Implement no-backend degraded state rather than fake success.
- [ ] Run focused UI source tests and `npm run verify:a11y` when CI/runtime is available.
- [ ] Commit `feat(billing): add focused review-first workspace`.

### Task 5: Studio discoverability without adding a permanent primary mode

**Files:**
- Modify: `src/app/bootstrap.mjs`
- Test: `tests/billing-ui-contract.test.mjs`

**Interfaces:**
- Work surface exposes a `Billing` launcher that navigates to `/billing.html`.
- Chat/Work/Space primary modes remain unchanged.

- [ ] Add a small Work-level launcher/card using existing interaction styles.
- [ ] Verify the primary navigation contract remains Chat/Work/Space.
- [ ] Run UI contract tests and existing browser/source verification.
- [ ] Commit `feat(billing): expose billing from Work`.

### Task 6: Documentation, governance boundary, and PR evidence

**Files:**
- Modify: `README.md`
- Create: `docs/billing/README.md`
- Create: `docs/billing/EXTRACTION.md`

**Interfaces:**
- Documents Studio as experience/incubation owner only; domain remains extraction-ready.

- [ ] Document local use, readiness semantics, API and privacy boundary.
- [ ] Document extraction criteria for a dedicated Aftergraph product/runtime repository.
- [ ] Run `npm test` and `npm run verify` on the exact branch SHA through available CI.
- [ ] Open a narrow PR with exact-head evidence and limitations.
- [ ] Do not claim production readiness until required CI/verification is green.
