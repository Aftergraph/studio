# Ledger Visual QA Acceptance Report — Repaired

**Generated:** 2026-09-14T03:08:29.609212Z
**Base URL:** http://127.0.0.1:8765
**Branch:** fix/ledger-qa-real
**Commit:** 913ae84a
**Screenshots:** 12
**Findings:** 2
**Auth Verified:** ✅ Yes — dashboard rendered with fixture data

## Executive Summary

| Severity | Count |
|----------|-------|
| HIGH | 2 |

## Authentication Method

Synthetic magic token generated using the **dev secret** (`aftergraph-dev-secret-change-in-production`) matching the server's `requireAuth: false` configuration. Token injected into `localStorage` before page load. No production credentials used. No application auth weakened.

## Prior Issues Corrected

- **Previous harness captured login screens mislabeled as 'populated' dashboard states.** Fixed by injecting valid auth token before navigation.
- **`window.__BILLING_TEST_OVERRIDE_ITEMS` and `window.__BILLING_TEST_ERROR` were never read by the billing app.** Removed. Empty/error states now exercised via real UI interactions (search with no matches, route abort).
- **Screenshot paths referenced wrong worktree (`studio-billing-audit`).** Fixed to current worktree paths.

## Findings

### 1. [HIGH] Horizontal overflow on mobile-light populated

- **Category:** Visual
- **Viewport:** mobile
- **Theme:** light
- **State:** populated
- **Description:** Scroll width 491 exceeds client width 390
- **Screenshot:** `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-light-populated.png`

### 2. [HIGH] Horizontal overflow on mobile-dark populated

- **Category:** Visual
- **Viewport:** mobile
- **Theme:** dark
- **State:** populated
- **Description:** Scroll width 491 exceeds client width 390
- **Screenshot:** `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-dark-populated.png`

## Screenshots Captured

- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/desktop-dark-empty.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/desktop-dark-error.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/desktop-dark-populated.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/desktop-light-empty.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/desktop-light-error.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/desktop-light-populated.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-dark-empty.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-dark-error.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-dark-populated.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-light-empty.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-light-error.png`
- `/root/workspace/aftergraph/studio-ledger-qa-repair/tests/ledger-visual-output/screenshots/mobile-light-populated.png`

## Coverage Gaps (Honest)

- Invoice creation/review/approval/payment flows not exercised — requires multi-step authenticated mutations beyond smoke scope.
- Dark mode toggle persistence across navigation not verified.
- Contrast ratio measurements require axe-core integration (not included).
- Performance metrics (LCP, CLS, INP) not measured.
- Empty state simulated via search with no matches, not via true zero-data fixture. A dedicated empty-fixture endpoint would be more deterministic.
- Error state simulated via route abort, not via server-side error response. A dedicated error-fixture endpoint would be more realistic.

## Methodology

1. Local fixture server started with `billingFixtureState()` (5 customers, 11 visits, Danish locale) and `requireAuth: false`.
2. Synthetic magic token generated using dev HMAC secret and injected into Playwright localStorage before page load.
3. Dashboard authentication verified: login form absent, billing summary/queue-nav present.
4. Playwright navigated to `/billing/` at 1440×1000 (desktop) and 390×844 (mobile).
5. Each viewport tested in light and dark themes.
6. Horizontal overflow, unlabeled interactives, and console errors checked programmatically.
7. Empty state exercised via search tab with non-matching query.
8. Error state exercised via Playwright route abort on billing API.
9. All evidence captured locally against real authenticated fixture responses; no fabrication.