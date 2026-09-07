> ⚠️ **SUPERSEDED** — This V5.2 build status is archived. Current status: see `V6-IMPLEMENTATION-STATUS.md`.

# Aftergraph V5.2 Calm Intelligence — Current Build Status

**Build type:** current integrated development build, not final release freeze  
**Architecture:** V5 C + V5.1 polyrepo integration + V5.2 Calm Intelligence refactor  
**Package version inside app:** 5.1.0 (intentionally not bumped to 5.2.0 before the final accessibility/release gate)

## Fresh verification in this packaged tree

- Node test suite excluding only the unresolved vendored-axe contract: **197/197 PASS**.
- Full `npm test`: **198/199 PASS**; the sole failure is `v5-2-a11y-contract.test.mjs` because the local test-only axe-core bundle / a11y runner has not been materialized in this sandbox.
- Platform source checks: **PASS** for Expo and SwiftUI source contracts.
- Performance smoke: **PASS**.
  - Chat DOM: 366 nodes
  - Work DOM: 299 nodes
  - Space DOM: 435 nodes
  - Interaction p95: 8.4 ms, budget <100 ms
  - Progress tick full-shell render delta: 0
  - Progress patch delta: 1
  - Frame p95 is report-only in this environment.
- V5.2 CSS migration parity previously measured 13 reference views at SSIM 1.0000 / 0.0000% changed pixels before intentional redesign.

## Included V5.2 work

- Calm/minimal Chat, Work and Space presentation.
- Seven-layer local CSS architecture (`tokens/reset/shell/components/views/motion/responsive`).
- Tiny `src/main.mjs` bootstrap entry and decomposed app/runtime/view modules.
- Local-first motion correctness path.
- Render-scope scheduler with progress-only incremental patching.
- Focus/caret/selection preservation and concurrent composer + mission progress handling.
- Authoritative SSE reconnect refetch with resync timeout, payload and latency budgets.
- System/Control source-truth and consequential-write safety contracts.
- Mobile shell and 390px navigation behavior.
- Polyrepo adapters and exact-head contract materialization inherited from V5.1.
- Stale V4/V5 source-assertion tests updated to validate the current decomposed V5.2 architecture instead of deleted legacy CSS / monolithic `main.mjs` internals.

## Known open release gate

The automated WCAG browser gate is intentionally **not represented as passed**. Missing files are:

- `scripts/a11y_smoke.py`
- `scripts/vendor/axe.min.js`
- `scripts/vendor/AXE-LICENSE.txt`

This build therefore should be treated as a strong V5.2 development snapshot, not the final accessibility-certified V5.2 release.

## Evidence

See `qa/release-evidence-current/` for the fresh test and performance logs included with this bundle.
