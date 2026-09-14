# Ledger Visual QA Acceptance Report

**Generated:** 2026-09-14T02:47:28.528707Z
**Base URL:** http://127.0.0.1:8765
**Branch:** test/ledger-visual-qa
**Screenshots:** 12
**Findings:** 2

## Executive Summary

| Severity | Count |
|----------|-------|
| HIGH | 2 |

## Live Blockers

- **Login disabled on insecure HTTP**: The live billing UI at `http://100.71.253.52:8000/billing/` requires authentication but login is disabled over plain HTTP. No authenticated flow testing was possible against the live deployment.
- **Vision tool unavailable for local files**: Baseline screenshots at `/tmp/ledger-visual-baseline/` could not be analyzed via `vision_analyze` (tool returned inability to process local paths). Browser-based visual analysis used instead.

## Fixture vs Live Evidence

All screenshots below are from a **local fixture server** (`scripts/ledger-visual-qa-server.mjs`) running with `billingFixtureState()` data. These are NOT live production captures.

## Findings

### 1. [HIGH] Horizontal overflow on mobile-light

- **Category:** Visual
- **Viewport:** mobile
- **Theme:** light
- **State:** populated
- **Description:** Scroll width 479 exceeds client width 390
- **Screenshot:** `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-light-populated.png`

### 2. [HIGH] Horizontal overflow on mobile-dark

- **Category:** Visual
- **Viewport:** mobile
- **Theme:** dark
- **State:** populated
- **Description:** Scroll width 445 exceeds client width 390
- **Screenshot:** `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-dark-populated.png`

## Screenshots Captured

- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/desktop-dark-empty.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/desktop-dark-error.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/desktop-dark-populated.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/desktop-light-empty.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/desktop-light-error.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/desktop-light-populated.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-dark-empty.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-dark-error.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-dark-populated.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-light-empty.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-light-error.png`
- `/root/workspace/aftergraph/studio-billing-audit/tests/ledger-visual-output/screenshots/mobile-light-populated.png`

## Coverage Gaps

- Invoice creation/review/approval/payment flows require authenticated session — not exercisable on live HTTP endpoint.
- Dark mode toggle persistence across navigation not verified (requires auth).
- Contrast ratio measurements require axe-core integration (not included in this smoke harness).
- Performance metrics (LCP, CLS, INP) not measured — no ROI/performance claims made.

## Methodology

1. Local fixture server started with `billingFixtureState()` (5 customers, 11 visits, Danish locale).
2. Playwright navigated to `/billing/` at 1440×1000 (desktop) and 390×844 (mobile).
3. Each viewport tested in light and dark themes.
4. Horizontal overflow, unlabeled interactives, focus visibility, and console errors checked programmatically.
5. Empty and error states simulated via window overrides.
6. All evidence captured locally; no fabrication.