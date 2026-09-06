# Aftergraph V6 Unified Intelligence Operating Environment — QA Report

**Version:** 6.0.0  
**Date:** 2026-09-06  
**Status:** PASS (All 13 Release Verification Gates Green)

---

## 1. Executive Summary

Aftergraph V6 unifies the human operating environment across `Chat · Work · Space` with first-class contextual access to `NOW · RESEARCH · AGENTS · BRAIN · CAPABILITIES · CONTROL · CONNECT · OUTPUT · SYSTEM` while preserving canonical authority and evidence boundaries from all specialist engines.

All 22 implementation tasks defined in the approved V6 implementation plan are completed and verified through automated test suites, contracts, headless browser smoke tests, cross-system E2E journeys, and real vendored accessibility scanning.

---

## 2. Test & Verification Matrix

| Gate | Category | Command | Result |
|---|---|---|---|
| **Gate 1** | Node Behavioral Suite | `npm test` | **305/305 PASS** (0 failed, 0 skipped) |
| **Gate 2** | Workspace Verification | `node scripts/verify.mjs` | **58/58 PASS** (All syntax & contracts) |
| **Gate 3** | Platform Source Contracts | `node scripts/platform_verify.mjs` | **15/15 PASS** (Expo & SwiftUI source contracts) |
| **Gate 4** | Headless Browser Smoke (V4) | `python scripts/browser_smoke.py` | **60/60 PASS** (0 console/page errors) |
| **Gate 5** | Headless Browser Smoke (V5) | `python scripts/browser_smoke_v5.py` | **21/21 PASS** (Space, Zoom, Replay, 390px) |
| **Gate 6** | V6 Contextual Browser QA | `python scripts/v6_browser_qa.py` | **13/13 PASS** (Research, Capabilities, Mobile) |
| **Gate 7** | Fullstack Bridge Smoke | `python scripts/fullstack_bridge_smoke_v5.py` | **10/10 PASS** (Real Node store persistence) |
| **Gate 8** | Upstream Source Truth | `node scripts/verify-upstreams.mjs` | **PASS** (6 repos, 12 mission states) |
| **Gate 9** | Polyrepo Bridge Smoke | `python scripts/polyrepo_bridge_smoke_v5.py` | **12/12 PASS** (Adapters, Hub, TG approval) |
| **Gate 10** | Performance Smoke | `python scripts/performance_smoke.py` | **PASS** (p95 interaction: 2.800 ms, DOM < 700) |
| **Gate 11** | Cross-System E2E Journeys | `python scripts/v6_e2e.py` | **8/8 PASS** (Journeys A–E verified) |
| **Gate 12** | Secret & Credential Scan | `node scripts/v6-secret-scan.mjs` | **PASS** (0 credential/token leaks) |
| **Gate 13** | Axe-Core 4.10.3 WCAG 2.2 AA | `python scripts/a11y_smoke.py` | **PASS** (0 critical, 0 serious violations) |

---

## 3. Measured Performance Evidence

- **Desktop Active-View DOM Counts (Budget < 700):**
  - Chat: **366** DOM nodes
  - Work: **299** DOM nodes
  - Space: **436** DOM nodes
- **Mobile 390px Active-View DOM Counts (Budget < 500):**
  - Chat: **214** DOM nodes
  - Work: **198** DOM nodes
  - Space: **264** DOM nodes
- **Interaction Feedback p95 (Budget < 100 ms):**
  - Measured p95: **2.800 ms**
  - Measured p50: **1.400 ms**
- **Search Response p95 (Budget < 150 ms):**
  - Measured p95: **5.120 ms** (Indexed metadata)
- **Render Churn & Stability:**
  - Progress tick full-shell renders: **0**
  - Incremental patch count per tick: **1**
  - Frame rAF p95: **66.700 ms**

---

## 4. Accessibility Gate (WCAG 2.2 AA)

- **Vendored Dependency:** `scripts/vendor/axe.min.js` (axe-core 4.10.3, 553,446 bytes, SHA-256 `880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb`, MPL-2.0).
- **Automated Axe Scan Results:**
  - `desktop-chat`: **0 critical, 0 serious, 0 moderate, 0 minor**
  - `desktop-work`: **0 critical, 0 serious, 0 moderate, 0 minor**
  - `desktop-space`: **0 critical, 0 serious, 0 moderate, 0 minor**
  - `desktop-system`: **0 critical, 0 serious, 0 moderate, 0 minor**
  - `desktop-control`: **0 critical, 0 serious, 0 moderate, 0 minor**
  - `mobile-chat` (390px): **0 critical, 0 serious, 0 moderate, 0 minor**
  - `mobile-work` (390px): **0 critical, 0 serious, 0 moderate, 0 minor**
  - `mobile-space` (390px): **0 critical, 0 serious, 0 moderate, 0 minor**
- **Manual/Contract Verifications:**
  - Skip link present on all views
  - Semantic landmark `<main class="ag-app">` present
  - Touch targets >= 44px on mobile
  - 390px horizontal overflow = 0 px
  - Visible focus indicators and keyboard focus trap in modals

---

## 5. Required V6 Invariants Verified

1. `WorkItemNeverBecomesWorksWorkImplicitly` — Graph IDs wrap canonical IDs; promotion requires explicit human actor.
2. `ResearchEvidenceNeverBecomesRuntimeAuthority` — Research claims and evidence are read-only; execution authority remains strictly empty.
3. `ProjectionNeverGrantsAuthority` — UI projections carry no execution authority.
4. `FailedAuthorityWriteNeverShowsSuccess` — Consequential writes fail visibly on authority rejection; no optimistic success.
5. `BackgroundSyncNeverStealsHumanNavigation` — Background reconciliation updates state without mutating active human navigation.
6. `BackgroundSyncPreservesComposerFocusCaretAndDraft` — Human typing draft, focus key, and caret selection survive background sync.
7. `SourceRevisionDriftDisablesUnsafeWrites` — Drifting from pinned upstream SHA disables consequential writes while preserving read-only views.
8. `StaleEvidenceNeverAppearsNewlyVerified` — Stale evidence records are labeled stale and cannot be verified without fresh re-attestation.
9. `CapabilityDiscoveryNeverEqualsCapabilityGrant` — Discovered capabilities remain 'not-granted' until explicit authority resolution.
10. `CrossTenantRelationFailsClosed` — Relations between mismatched tenant IDs throw and fail closed.
11. `MissingIntegrationLeavesUnaffectedDomainsOperational` — An offline integration degrades only its own objects, leaving other domains active.
12. `SearchReportsIncompleteCoverageDuringOutage` — Federated search exposes `complete: false` and lists unavailable providers during outages.

---

## 6. End-to-End Journeys A–E

- **Journey A (Intent → Capabilities → Authority → Works Execution → Verified Outcome):** PASS
- **Journey B (Observation → WorkItem → Human Review → Explicit Promotion → Works Work):** PASS
- **Journey C (ISR Claim → Evidence Inspection → Promotion Proposal → No Automatic Runtime Authority):** PASS
- **Journey D (AVC/Hermes Mission → TG Consequential Action → Failure with No Synthetic Success):** PASS
- **Journey E (Integration Outage → Partial Federation → Search Reports Incomplete Coverage):** PASS
