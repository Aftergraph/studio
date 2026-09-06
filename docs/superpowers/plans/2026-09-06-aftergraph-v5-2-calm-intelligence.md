# Aftergraph V5.2 Calm Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Aftergraph V5.1 into V5.2 Calm Intelligence: a calmer Chat/Work/Space experience, a purpose-built mobile shell, maintainable frontend/server/UI/CSS boundaries, local-first motion, and measurable render/accessibility/visual regression gates without changing polyrepo authority ownership.

**Architecture:** Preserve V5 C and the V5.1 polyrepo service boundaries, but progressively replace the monolithic frontend/server presentation layer with explicit controller, render-scheduler, view, UI-package, CSS, and server-route modules. Runtime/source truth remains server-owned; navigation and presentation state remain human/client-owned. Structural migration is verified before intentional visual redesign.

**Tech Stack:** Node.js 22+ ES modules, zero-build browser runtime, native DOM/WAAPI/View Transitions, Node `node:test`, Python Playwright, Pillow + NumPy + scikit-image SSIM for visual diff, locally vendored axe-core for test-only automated accessibility checks, existing Node durable state/SSE backend and Aftergraph polyrepo adapters.

**Spec:** `docs/superpowers/specs/2026-09-06-aftergraph-v5-2-calm-intelligence-design.md`

## Global Constraints

- Primary principle: **Simple until complexity earns its place.**
- Preserve Chat / Work / Space V5 C semantics and the nine canonical domains.
- No React/Vite migration in V5.2.
- No authority changes: TG owns runtime enforcement/approvals/audit; WORKS owns durable execution/evidence/Brain; AIE owns authority/A2A admission; WI is detection/proposal-only; GOV owns canonical contracts; ISR remains research evidence.
- Background synchronization MUST NOT own navigation, active conversation/space, composer mode, theme, local panels, caret, focus, or scroll intent.
- Approval/execution writes that cannot reach their authority owner MUST fail visibly and MUST NOT be represented as successful local state.
- Production UI/motion startup has no network dependency.
- WCAG 2.2 AA is the target; automated checks are a release gate but do not constitute a standalone legal conformance claim.
- 390 px reference mobile width MUST have no horizontal overflow.
- Native Expo/SwiftUI claims remain source/type/parse-only unless simulator/device tooling is available.
- V5.1 ZIP remains immutable rollback artifact. This V5.2 directory is the isolated workspace; there is no `.git` metadata in the extracted release, so plan “commit” steps are recorded as logical checkpoints rather than falsely claiming VCS commits.

## Peer-Review Contract Decisions

### PR-1 — `RenderScopeContract`

**Mechanism:** dirty state-slice classification + stable keyed DOM patch targets. V5.2 does **not** introduce a virtual DOM. `classifyRenderChanges(previous, next, previousRuntimes, nextRuntimes)` returns an ordered set of render scopes. The scheduler applies registered patchers for patchable scopes and renders the active view only when any structural scope is dirty.

**Machine-checkable state-slice → render-scope matrix:**

| State slice | Scope | Kind | Required behavior |
|---|---|---|---|
| `missions[*].progress` | `mission.progress` | patch | Update progress labels/bars only |
| `runtimes[*].status` | `mission.runtime-status` | patch | Update live status/controls only |
| `runtimes[*].attention.type` | `attention.runtime` | patch unless surface appears/disappears | Patch attention indicator; structural only if Needs You/approval surface membership changes |
| `agents[*].status/progress/currentTask` | `agents.presence` | patch | Patch visible presence nodes only |
| `upstreams[*].status/latency/checkedAt` | `system.upstream-health` | patch | Patch visible source-truth service rows only |
| `replay.cursor/playing` | `replay.cursor` | patch | Patch scrubber/timeline cursor only |
| `conversations[*].messages` | `conversation.messages` | structural-view | Re-render Chat message stream, preserve composer focus/caret and scroll intent |
| `approvals` / `needsYou` membership | `trust.structure` | structural-view | Re-render active view/overlay because interaction structure changed |
| `artifacts` membership or selected artifact | `artifact.structure` | structural-view | Re-render relevant Work/Chat split only |
| `spaces[*].regions/surfaces/layout` | `space.structure` | structural-view | Re-render Space view, preserve focused keyed control when possible |
| `activeDomain/primaryMode/activeConversationId/activeSpaceId` | `navigation` | structural-shell | Explicit human navigation only; render current shell/view |
| `composerMode` / local intent attachments | `composer.structure` | structural-view | Explicit local user action; preserve caret by stable key |
| `theme/device` | `shell.presentation` | structural-shell | Render shell/layout intentionally |
| unknown canonical slice | `unknown.structural` | structural-view | Fail safe: structural render, never silently ignore |

**Focus/caret ownership:** `src/app/render-scheduler.mjs` snapshots and restores focused element identity and text selection using stable `data-focus-key` keys. `src/app/scroll-policy.mjs` owns scroll intent/state because it is human-controlled UI state, not runtime state. Views/components MUST assign stable keys to focusable controls whose identity persists across structural renders.

Named tests:
- `tests/v5-2-render-scope-contract.test.mjs`
- `tests/v5-2-focus-caret-contract.test.mjs`
- browser cases `render scope: progress tick does not replace shell`, `composer caret survives structural message render`, `background patch preserves focused control`.

### PR-2 — `VisualParityContract`

**Tooling:** Playwright captures PNGs; `scripts/visual_diff.py` compares reference/current images using:
1. SSIM on luminance via `skimage.metrics.structural_similarity`;
2. changed-pixel ratio after ignoring per-channel deltas ≤ 12/255.

**Parity threshold for structural-only CSS migration:** `SSIM >= 0.995` AND `changed_pixel_ratio <= 0.005` (0.5%). A failure writes a diff heatmap and JSON metrics. Intentional V5.2 redesigns establish new approved references only after functional/browser/a11y gates for that view pass; future regressions use the same thresholds.

**Reference viewports:**
- desktop-wide: `1440 x 1000`
- desktop-laptop: `1280 x 800`
- mobile: `390 x 844`

Reference views: Chat, Work, Space, System, Control; mobile Chat/Work/Space.

Named tests/scripts:
- `scripts/capture_v5_2_visuals.py`
- `scripts/visual_diff.py`
- `tests/v5-2-visual-contract.test.mjs` validates the manifest/threshold contract.

### PR-3 — `SSEResyncContract`

V5.2 uses **full authoritative state refetch on every SSE open/reopen**, not `Last-Event-ID` replay. Reason: the current server sequence is process-memory-only and there is no retained SSE journal guaranteeing replay. Pretending otherwise would turn a transport hint into false durability.

Protocol:
1. connection error → mark backend session `stale`, retain last-known data, visibly label affected service-backed surfaces;
2. EventSource `open` → set `resyncing`, immediately `GET /api/v1/state`;
3. successful refetch → reconcile server-owned state while preserving all client-owned view state, set `current`, then accept live events;
4. failed refetch → remain `stale`; do not accept incoming event payload as proof of full currency;
5. writes while authority owner/session unavailable fail visibly and remain unapplied locally.

The server MAY emit event IDs for observability but clients do not claim replay semantics until a durable event journal exists.

Named tests:
- `tests/v5-2-sse-resync-contract.test.mjs`
- full-stack browser case `disconnect -> stale -> reconnect -> refetch -> current`.

### PR-4 — `InteractionSafetyContract`

- Controller public actions return `{ok:true,value}` or `{ok:false,error}` through a single `runControllerAction()` boundary. Unexpected exceptions are caught, logged as a local diagnostic event, and projected to explicit degraded/error UI. No silent rejection.
- Consequential remote writes are non-optimistic by default. Local canonical state changes only after authority-owner success. If an existing flow must be optimistic, it MUST provide a tested rollback callback.
- `scroll-policy.mjs` lives in `src/app/`, not `src/runtime/`, because follow-latest and scroll position are human-controlled presentation state.
- `packages/ui` remains an **internal first-party package inside the product workspace** for V5.2. It is not promoted to a new polyrepo member and does not acquire independent release/version authority in this wave. The public barrel is stable for internal consumers.
- Automated accessibility: a **test-only local axe-core bundle** is injected by Playwright. `scripts/a11y_smoke.py` fails on axe `critical` or `serious` violations for WCAG 2.0/2.1/2.2 A/AA tags. Additional project checks cover 44px-equivalent mobile touch targets, 390px overflow, reduced motion, focus visibility, and status-not-color-only. Axe runs are evidence toward the WCAG target, not a claim of complete conformance.

---

## Target File Structure

```text
src/main.mjs                         # compatibility entry; calls app/bootstrap only
src/app/
  bootstrap.mjs                      # lifecycle/bootstrap/orchestration
  controller.mjs                     # explicit user actions + error boundary
  ui-state.mjs                       # purely client presentation state
  selectors.mjs                      # pure view selectors
  navigation.mjs                     # route/deep-link + explicit navigation ownership
  events.mjs                         # delegated DOM events -> controller calls
  render-scheduler.mjs               # dirty scopes, patchers, focus/caret snapshots
  scroll-policy.mjs                  # follow-latest + scroll snapshot/restore
src/views/
  chat-view.mjs
  work-view.mjs
  space-view.mjs
  system-view.mjs
  control-view.mjs
  domain-view.mjs
src/runtime/
  backend-session.mjs                # SSE health/resync lifecycle
  background-reconciliation.mjs      # server-owned state merge only
  live-projection.mjs                # patchable runtime/source projections

packages/ui/
  index.mjs
  primitives/{button,icon-button,input,menu,notice}.mjs
  conversation/{turn,composer,response-status}.mjs
  work/{work-summary,outcome-receipt,artifact}.mjs
  trust/{approval,need-you,evidence,risk}.mjs
  agents/{agent-card,agent-presence}.mjs
  system/{upstream-service-row,source-truth-badge,event-row}.mjs

styles/
  tokens.css
  reset.css
  shell.css
  components.css
  views.css
  motion.css
  responsive.css

server.mjs                           # composition root only
server/
  app-server.mjs
  http-utils.mjs
  static-handler.mjs
  api-router.mjs
  sse-broker.mjs
  workspace-routes.mjs
  mission-routes.mjs
  approval-routes.mjs
  space-routes.mjs
  upstream-routes.mjs

scripts/
  capture_v5_2_visuals.py
  visual_diff.py
  a11y_smoke.py
  performance_smoke.py
  vendor/axe.min.js                  # test-only third-party bundle
  vendor/AXE-LICENSE.txt
```

---

### Task 1: Freeze V5.1 Behavior and Add Peer-Review Contract Tests

**Files:**
- Create: `tests/v5-2-render-scope-contract.test.mjs`
- Create: `tests/v5-2-focus-caret-contract.test.mjs`
- Create: `tests/v5-2-sse-resync-contract.test.mjs`
- Create: `tests/v5-2-visual-contract.test.mjs`
- Create: `tests/v5-2-controller-error-contract.test.mjs`
- Create: `tests/v5-2-a11y-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: V5.1 current behavior only.
- Produces: executable contract expectations that later tasks must satisfy.

- [ ] **Step 1: Write failing render-scope tests** importing the not-yet-created `RENDER_SCOPE_MATRIX`, `classifyRenderChanges`, and `isStructuralScope` from `src/app/render-scheduler.mjs`. Assert that mission progress maps only to `mission.progress`, message membership maps to `conversation.messages`, and unknown canonical changes map to `unknown.structural`.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER_SCOPE_MATRIX, classifyRenderChanges, isStructuralScope } from '../src/app/render-scheduler.mjs';

test('progress-only mission tick is machine-classified as a patch scope', () => {
  const prev={missions:[{id:'m1',progress:10}],conversations:[],approvals:[],needsYou:[],artifacts:[],spaces:[],agents:[],upstreams:[]};
  const next={...prev,missions:[{id:'m1',progress:11}]};
  const scopes=classifyRenderChanges(prev,next,{},{});
  assert.deepEqual(scopes,['mission.progress']);
  assert.equal(isStructuralScope(scopes),false);
  assert.equal(RENDER_SCOPE_MATRIX['missions[*].progress'].kind,'patch');
});
```

- [ ] **Step 2: Run those tests and confirm RED** because `src/app/render-scheduler.mjs` does not exist.

Run: `node --test tests/v5-2-render-scope-contract.test.mjs tests/v5-2-focus-caret-contract.test.mjs`

Expected: module-not-found or named export failure from missing V5.2 modules.

- [ ] **Step 3: Write failing SSE resync tests** against `createBackendSession()` expecting state transitions `offline -> resyncing -> current`, and `current -> stale -> resyncing -> current` with a full `api.state()` call on each open/reopen.

- [ ] **Step 4: Run SSE test and confirm RED.**

Run: `node --test tests/v5-2-sse-resync-contract.test.mjs`

- [ ] **Step 5: Write visual contract test** asserting exact viewport manifest and thresholds `0.995`, `0.005`, `12` from a future `scripts/visual-contract.json`.

- [ ] **Step 6: Write controller/a11y contract tests** asserting `runControllerAction` result shape and the presence of a local axe bundle in the final release tree.

- [ ] **Step 7: Run the entire new V5.2 contract group and confirm every failure is caused by missing implementation, not test syntax.**

Run: `node --test tests/v5-2-*.test.mjs`

- [ ] **Step 8: Add package scripts** `verify:v5.2:contracts`, `verify:v5.2:visual`, `verify:v5.2:a11y`, `verify:v5.2:performance` with commands populated by later tasks; keep existing V5.1 scripts intact until final migration.

- [ ] **Step 9: Logical checkpoint:** record Task 1 completion in this plan once RED evidence has been observed.

---

### Task 2: Implement UI State, Scroll Policy, Render Scheduler, and Focus/Caret Preservation

**Files:**
- Create: `src/app/ui-state.mjs`
- Create: `src/app/scroll-policy.mjs`
- Create: `src/app/render-scheduler.mjs`
- Modify: `tests/v5-2-render-scope-contract.test.mjs`
- Modify: `tests/v5-2-focus-caret-contract.test.mjs`

**Interfaces:**
- Produces:
  - `createUIState(canonicalState, device): UIState`
  - `captureScrollIntent(container): ScrollSnapshot`
  - `restoreScrollIntent(container, snapshot, {forceFollowLatest=false})`
  - `RENDER_SCOPE_MATRIX`
  - `classifyRenderChanges(previousState,nextState,previousRuntimes,nextRuntimes): string[]`
  - `createRenderScheduler({root,renderShell,renderView,patchers,getState,getUIState}): Scheduler`
  - `captureFocusSnapshot(root): FocusSnapshot|null`
  - `restoreFocusSnapshot(root,snapshot): boolean`

- [ ] **Step 1: Keep Task 1 render/focus tests RED and add exact focus fixture behavior:** an input with `data-focus-key="composer-input"`, selection `[4,7]`, structural DOM replacement, then restoration to same key/selection.

- [ ] **Step 2: Implement `src/app/ui-state.mjs`** by moving the existing `ui` defaults from `main.mjs` into a pure factory. Do not import DOM or backend modules.

- [ ] **Step 3: Implement `src/app/scroll-policy.mjs`** with the existing 32px near-bottom threshold and explicit `followLatest/forceFollowLatest/messageScrollTop` semantics.

- [ ] **Step 4: Implement render scope classification** using stable projections, not generic deep-diff of all fields. Unknown changed top-level keys become `unknown.structural`.

- [ ] **Step 5: Implement focus/caret snapshots** for `HTMLInputElement`/`HTMLTextAreaElement` selection and generic focusable keyed elements. Restore only when the key still exists and element is enabled/visible.

- [ ] **Step 6: Implement scheduler** so patch-only scopes invoke patchers and never call `renderShell`/`renderView`; structural-view invokes only the active view; structural-shell may render shell + active view.

- [ ] **Step 7: Run focused tests GREEN.**

Run: `node --test tests/v5-2-render-scope-contract.test.mjs tests/v5-2-focus-caret-contract.test.mjs`
Expected: all pass.

- [ ] **Step 8: Run legacy reconciliation tests.**

Run: `node --test tests/backend-reconciliation-v4.test.mjs tests/polyrepo-reconciliation.test.mjs tests/v5-ui-integration.test.mjs`
Expected: all pass.

- [ ] **Step 9: Logical checkpoint.**

---

### Task 3: Implement Controller Error Boundary and Explicit Navigation Ownership

**Files:**
- Create: `src/app/controller.mjs`
- Create: `src/app/navigation.mjs`
- Create: `src/app/selectors.mjs`
- Modify: `tests/v5-2-controller-error-contract.test.mjs`
- Create: `tests/v5-2-navigation-ownership.test.mjs`

**Interfaces:**
- `runControllerAction(name, fn, {onError,diagnostics}): Promise<{ok:boolean,value?:unknown,error?:Error}>`
- `createController(deps): AppController`
- `applyExplicitNavigation(state, route): state`
- selectors for current mission/conversation/artifact/approval/agent/space.

- [ ] **Step 1: Add RED test** proving `runControllerAction('approve', async()=>{throw new Error('offline')})` returns `{ok:false}`, invokes diagnostic callback once, and never throws through the delegated DOM event layer.

- [ ] **Step 2: Add RED test** proving a failed consequential write does not mutate canonical approval state before remote success.

- [ ] **Step 3: Implement `runControllerAction`** with structured diagnostic `{type:'controller.error',action,message,ts}` and no silent catch.

- [ ] **Step 4: Implement pure selectors** migrated from `main.mjs` (`currentMission`, `chatMission`, etc.).

- [ ] **Step 5: Implement navigation module** wrapping route/deep-link writes. Background reconciliation is not imported here.

- [ ] **Step 6: Implement the first controller slice** for navigation, approval, Need resolution, and upstream sync. Remote consequential writes apply server response only after success.

- [ ] **Step 7: Run Task 3 tests GREEN and legacy approval/polyrepo tests GREEN.**

Run: `node --test tests/v5-2-controller-error-contract.test.mjs tests/v5-2-navigation-ownership.test.mjs tests/api-client-polyrepo.test.mjs tests/polyrepo-reconciliation.test.mjs`

- [ ] **Step 8: Logical checkpoint.**

---

### Task 4: Implement Backend Session + SSE Full-Refetch Resync Contract

**Files:**
- Create: `src/runtime/backend-session.mjs`
- Create: `src/runtime/background-reconciliation.mjs`
- Create: `src/runtime/live-projection.mjs`
- Modify: `src/api-client.mjs`
- Modify: `tests/v5-2-sse-resync-contract.test.mjs`
- Create: `tests/v5-2-backend-session.test.mjs`

**Interfaces:**
- `createBackendSession({api,onState,onStatus,onRuntime,onError}): {start,stop,status}`
- `reconcileAuthoritativeState(localState,serverState): state`
- `patchLiveProjection(root,{state,runtimes,scopes})`
- API `subscribe(onMessage,onError,{onOpen}={})` supports open notification.

- [ ] **Step 1: Verify SSE tests are RED** against missing session implementation.

- [ ] **Step 2: Extend API client `subscribe`** to expose `source.onopen` through the options callback without changing existing callers.

- [ ] **Step 3: Implement session state machine** `offline|resyncing|current|stale`. On every open call `api.state()` before marking current.

- [ ] **Step 4: Gate live payloads while `resyncing/stale`** so an event after reconnect cannot falsely mark the state current before full refetch succeeds.

- [ ] **Step 5: Move `reconcileBackgroundState` semantics into `src/runtime/background-reconciliation.mjs`** while preserving V5.1 client-owned keys and adding local panel/focus/scroll fields through UI state rather than canonical state.

- [ ] **Step 6: Implement live patcher facade** wrapping mission progress/presence/upstream/replay patch helpers.

- [ ] **Step 7: Run SSE/session tests GREEN.**

Run: `node --test tests/v5-2-sse-resync-contract.test.mjs tests/v5-2-backend-session.test.mjs tests/api-client-v4.test.mjs tests/v5-api-client.test.mjs`

- [ ] **Step 8: Run full-stack API regression.**

Run: `npm run verify:fullstack`

- [ ] **Step 9: Logical checkpoint.**

---

### Task 5: Split UI Package into Focused Semantic Modules Without Changing Output

**Files:**
- Create all `packages/ui/{primitives,conversation,work,trust,agents,system}/*.mjs` listed in Target File Structure.
- Replace: `packages/ui/index.mjs` with barrel exports only.
- Modify: `tests/polyrepo-ui-components.test.mjs`
- Create: `tests/v5-2-ui-package.test.mjs`

**Interfaces:**
- Existing named exports remain source-compatible.
- New modules render strings/semantic DOM only and contain no fetch/persistence imports.

- [ ] **Step 1: Write RED source-architecture test** asserting `packages/ui/index.mjs` contains only imports/exports and each semantic module exists.

- [ ] **Step 2: Add contract test** that no file below `packages/ui/` imports `api-client`, `server-store`, integrations, `fetch`, or `localStorage`.

- [ ] **Step 3: Move one semantic family at a time**, beginning primitives, running existing UI tests after each family.

- [ ] **Step 4: Preserve stable `data-*`, roles, labels, and markup during this structural task. No redesign yet.**

- [ ] **Step 5: Run UI package and existing workspace tests GREEN.**

Run: `node --test tests/v5-2-ui-package.test.mjs tests/polyrepo-ui-components.test.mjs tests/ui-kernel-v4.test.mjs tests/v5-ui-integration.test.mjs`

- [ ] **Step 6: Logical checkpoint.**

---

### Task 6: Split Views, Events, and Bootstrap; Reduce `src/main.mjs` to Compatibility Entry

**Files:**
- Create: `src/views/chat-view.mjs`, `work-view.mjs`, `space-view.mjs`, `system-view.mjs`, `control-view.mjs`, `domain-view.mjs`
- Create: `src/app/events.mjs`, `src/app/bootstrap.mjs`
- Modify: `src/main.mjs`
- Create: `tests/v5-2-source-architecture.test.mjs`

**Interfaces:**
- each view exports `renderXView({state,ui,selectors,capabilities}): string`
- `bindAppEvents({root,controller,getUIState,setUIState,scheduler}) => unsubscribe`
- `bootstrapAftergraph({window,document,apiClient?})`

- [ ] **Step 1: Add RED architecture test:** `src/main.mjs` must be ≤80 nonblank lines, must import `bootstrapAftergraph`, and must not contain view markup strings, `addEventListener`, `EventSource`, or route implementations.

- [ ] **Step 2: Extract pure view render functions without changing markup.** Use existing helper/component calls; do not redesign in this task.

- [ ] **Step 3: Extract delegated event handling** into `events.mjs`; handlers call controller methods and scheduler, not arbitrary state mutation.

- [ ] **Step 4: Build bootstrap composition** wiring state/UI/controller/session/scheduler/views.

- [ ] **Step 5: Replace `main.mjs`** with imports + one bootstrap call and explicit fatal-bootstrap diagnostic rendering.

- [ ] **Step 6: Run source architecture + full Node suite.**

Run: `node --test tests/v5-2-source-architecture.test.mjs && npm test`

- [ ] **Step 7: Run V4/V5 browser regression before any visual redesign.**

Run: `npm run verify:browser`

- [ ] **Step 8: Logical checkpoint.**

---

### Task 7: Split Server Composition and Preserve API/SSE Behavior

**Files:**
- Create all `server/*.mjs` files listed in Target File Structure.
- Modify: `server.mjs`
- Create: `tests/v5-2-server-architecture.test.mjs`
- Modify or reuse: `tests/server.test.mjs`, `tests/fullstack-api-v4.test.mjs`, `tests/upstream-server-integration.test.mjs`

**Interfaces:**
- `createAppServer(options)` remains exported by root `server.mjs` for backward compatibility.
- `createSSEBroker(): {attach(req,res,initialPayload),broadcast(payload),closeAll(),sequence}`
- route modules receive explicit dependencies and return `true` when handled.

- [ ] **Step 1: Add RED architecture test** requiring root `server.mjs` ≤100 nonblank lines and prohibiting route path literals other than composition/CLI setup.

- [ ] **Step 2: Extract HTTP JSON/body/static helpers** with behavior-preserving tests.

- [ ] **Step 3: Extract SSE broker** preserving event IDs and initial snapshot but documenting no replay guarantee.

- [ ] **Step 4: Extract workspace/mission/approval/space/upstream route modules** without changing paths/status/error payloads.

- [ ] **Step 5: Compose in `server/app-server.mjs`; root `server.mjs` re-exports/starts it.**

- [ ] **Step 6: Run server/full-stack/polyrepo regressions GREEN.**

Run: `node --test tests/v5-2-server-architecture.test.mjs tests/server.test.mjs tests/fullstack-api-v4.test.mjs tests/upstream-server-integration.test.mjs && npm run verify:polyrepo`

- [ ] **Step 7: Logical checkpoint.**

---

### Task 8: Capture V5.1 Visual Baseline and Consolidate CSS with Measured Parity

**Files:**
- Create: `scripts/visual-contract.json`
- Create: `scripts/capture_v5_2_visuals.py`
- Create: `scripts/visual_diff.py`
- Create: `visual-baselines/v5.1-structural/*`
- Create: `styles/*.css`
- Modify: `index.html`
- Delete from production loading, then delete after gate: `styles.css`, `v4.css`, `v5.css`

**Interfaces:**
- visual manifest contains viewports, views, thresholds.
- `visual_diff.py baseline current --json result.json --diff diff.png` exits nonzero if either threshold fails.

- [ ] **Step 1: Materialize the visual contract JSON** with viewports `1440x1000`, `1280x800`, `390x844`, `ssim_min=0.995`, `changed_pixel_ratio_max=0.005`, `channel_ignore_threshold=12`.

- [ ] **Step 2: Capture V5.1 structural baselines before changing CSS.** Use deterministic seeded local state and disabled nonessential animations.

- [ ] **Step 3: Implement visual diff script** using PIL/NumPy and `skimage.metrics.structural_similarity`; write SSIM, changed ratio, dimensions, baseline/current paths to JSON and a heatmap on failure.

- [ ] **Step 4: Create CSS layer files and migrate tokens/reset first.** Run visual parity after each layer migration.

- [ ] **Step 5: Migrate shell/components/views/motion/responsive rules**, deduplicating only when parity remains within threshold.

- [ ] **Step 6: Update `index.html` to load only the seven V5.2 layer files.**

- [ ] **Step 7: Remove legacy CSS files only after all structural reference views pass parity contract.**

- [ ] **Step 8: Run structural browser regressions and parity gate GREEN.**

Run: `npm run verify:browser && npm run verify:v5.2:visual -- --baseline v5.1-structural`

- [ ] **Step 9: Logical checkpoint.**

---

### Task 9: Remove Remote Motion Dependency and Make Motion Local-First

**Files:**
- Modify: `packages/motion/index.mjs`
- Modify: `styles/motion.css`
- Modify: `sw.js`
- Create: `tests/v5-2-motion-local.test.mjs`

**Interfaces:**
- semantic motion exports remain source-compatible.
- no `http:`, `https:`, `esm.sh`, dynamic network `import()` in production motion source.

- [ ] **Step 1: Add RED test** scanning production source for `esm.sh`/remote Motion import and asserting current source fails.

- [ ] **Step 2: Remove remote loader/module promise.** Keep WAAPI transition behavior synchronous; optionally use `document.startViewTransition` behind feature detection for semantic surface continuity.

- [ ] **Step 3: Add reduced-motion test** proving semantic actions still complete and final styles/state are equivalent.

- [ ] **Step 4: Update PWA cache list** for new local style/module graph.

- [ ] **Step 5: Run motion/offline/browser tests GREEN.**

Run: `node --test tests/v5-2-motion-local.test.mjs tests/v5-spatial-motion-lifecycle.test.mjs tests/v5-offline-platform.test.mjs && npm run verify:browser`

- [ ] **Step 6: Logical checkpoint.**

---

### Task 10: Calm Intelligence Chat Redesign

**Files:**
- Modify: `src/views/chat-view.mjs`
- Modify: conversation UI modules.
- Modify: `styles/views.css`, `styles/components.css`, `styles/responsive.css`
- Create: `tests/v5-2-chat-contract.test.mjs`
- Modify: browser smoke to add V5.2 Chat cases.

**Interfaces:**
- Chat readable column CSS token resolves between 760–820px desktop.
- trajectory/evidence/telemetry are progressive disclosures, not simultaneous default chrome.

- [ ] **Step 1: Add RED contract test** for exactly one primary navigation surface and calm Chat markup containing one primary composer, one compact trajectory summary maximum, and no default evidence/telemetry panels.

- [ ] **Step 2: Redesign Chat view** preserving message semantics/data and approval visibility when risk requires it.

- [ ] **Step 3: Add stable `data-focus-key="composer-input"` and relevant `data-scroll-key="conversation-stream"`.**

- [ ] **Step 4: Add browser test** typing into composer, selecting a caret range, triggering a structural message update, and asserting focus/caret + scroll intent survive.

- [ ] **Step 5: Capture V5.2 Chat references at three viewports and establish new intentional-design baselines after functional checks pass.**

- [ ] **Step 6: Run Chat contract/browser/a11y checks GREEN.**

- [ ] **Step 7: Logical checkpoint.**

---

### Task 11: Outcome-First Work and Direct Spatial Space Redesign

**Files:**
- Modify: `src/views/work-view.mjs`, `space-view.mjs`
- Modify: work/agent UI modules.
- Modify: `styles/views.css`, `styles/components.css`, `styles/responsive.css`
- Create: `tests/v5-2-work-space-contract.test.mjs`

**Interfaces:**
- Work starts outcome/current-state first; trajectory collapsed.
- artifact split opens only when requested or substantial artifact context is selected.
- Space has direct canvas + compact edge controls, no hero/dashboard frame.

- [ ] **Step 1: Add RED Work contract tests** proving trajectory is collapsed by default and artifact split is absent until state/UI requests it.

- [ ] **Step 2: Add RED Space contract tests** proving no hero block and keyboard-equivalent move/focus controls remain.

- [ ] **Step 3: Implement Work redesign** using `AGWorkSummary`, `AGOutcomeReceipt`, artifact/evidence adjacency.

- [ ] **Step 4: Implement Space simplification** retaining docking, drag, resize, semantic zoom, replay, presence and keyboard fallback.

- [ ] **Step 5: Ensure progress ticks are patch-only** by browser instrumenting shell/view render counters during a running mission.

- [ ] **Step 6: Capture/establish V5.2 Work/Space visual references and run visual gate.**

- [ ] **Step 7: Run Work/Space browser + spatial regressions GREEN.**

- [ ] **Step 8: Logical checkpoint.**

---

### Task 12: Product-Quality System and Control Surfaces

**Files:**
- Modify: `src/views/system-view.mjs`, `control-view.mjs`
- Modify: trust/system UI modules.
- Create: `tests/v5-2-system-control-contract.test.mjs`

**Interfaces:**
- System groups source truth by service + authority role, with inspectable provenance.
- Control uses What / Why / Impact / Risk / Evidence / Rollback / Authority and explicit approve/modify/reject/inspect actions where supported.

- [ ] **Step 1: Add RED tests** that credentials/token-like values never render and service exact-head details are collapsed/inspectable rather than permanently repeated.

- [ ] **Step 2: Add degraded-state tests** for loading/current/stale/unavailable projection.

- [ ] **Step 3: Implement System hierarchy** with group/list markup on narrow screens rather than desktop table compression.

- [ ] **Step 4: Implement Control hierarchy** with pending approval/Needs You attention first and provenance secondary.

- [ ] **Step 5: Browser-test failed TG decision**: UI must show failure and approval remains pending locally.

- [ ] **Step 6: Capture/establish System/Control V5.2 visual references and run a11y checks.**

- [ ] **Step 7: Logical checkpoint.**

---

### Task 13: Purpose-Built Mobile Shell and Sheets

**Files:**
- Modify: `src/app/bootstrap.mjs`, `src/views/*` as needed for mobile composition.
- Modify: `styles/shell.css`, `styles/responsive.css`, `styles/components.css`
- Create: `tests/v5-2-mobile-contract.test.mjs`
- Modify browser smoke.

**Interfaces:**
- one bottom mode bar: Chat / Work / Space.
- context/artifact/approval/evidence/presence/replay use sheet/full-screen patterns.

- [ ] **Step 1: Add RED source/browser contract** requiring bottom nav at 390px and desktop primary nav hidden as an equal-priority control.

- [ ] **Step 2: Implement mobile shell** with safe-area-aware composer/nav spacing.

- [ ] **Step 3: Transform contextual surfaces into sheets/full-screen pushes** based on criticality.

- [ ] **Step 4: Add touch-target browser assertions**: primary interactive rectangles minimum 44 CSS px in either dimension unless inline/text-link exception is explicitly allowlisted.

- [ ] **Step 5: Assert no 390px horizontal overflow and keyboard/composer remains reachable.**

- [ ] **Step 6: Capture mobile Chat/Work/Space reference images and run visual gate.**

- [ ] **Step 7: Logical checkpoint.**

---

### Task 14: Automated Accessibility Gate with Local axe-core

**Files:**
- Create: `scripts/a11y_smoke.py`
- Create: `scripts/vendor/axe.min.js`
- Create: `scripts/vendor/AXE-LICENSE.txt`
- Modify: `package.json`

**Interfaces:**
- `python scripts/a11y_smoke.py` returns nonzero for serious/critical axe violations or project-specific interaction/overflow failures.

- [ ] **Step 1: Add the test-only axe-core distribution locally** with its upstream license; it MUST NOT be referenced from `index.html`, service worker production cache, or runtime modules.

- [ ] **Step 2: Implement Playwright axe injection** using `page.add_script_tag(path=...)`, run `axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}})`.

- [ ] **Step 3: Fail only on `serious` or `critical` violations initially**, print every violation id/impact/nodes, and record moderate/minor counts for trend visibility.

- [ ] **Step 4: Add project-specific checks** for focus visibility, reduced-motion, 390px overflow, mobile touch targets, named primary controls, landmark presence and color-independent status text.

- [ ] **Step 5: Run desktop Chat/Work/Space/System/Control + mobile Chat/Work/Space a11y gate GREEN.**

Run: `npm run verify:v5.2:a11y`

- [ ] **Step 6: Logical checkpoint.**

---

### Task 15: Performance and Render-Churn Budgets

**Files:**
- Create: `scripts/performance_smoke.py`
- Create: `tests/v5-2-performance-contract.test.mjs`
- Modify: `src/app/render-scheduler.mjs` instrumentation behind test/debug flag only.

**Interfaces:**
- test instrumentation exposes counts via `window.__AG_TEST_METRICS__` only when `?qa=1` or test flag is present.

- [ ] **Step 1: Add RED contract** defining metrics: `shellRenders`, `viewRenders`, per-scope patch counts, DOM count, local interaction latency samples.

- [ ] **Step 2: Instrument scheduler** without production logging/telemetry overhead when QA flag absent.

- [ ] **Step 3: Browser-run a mission progress sequence** and assert `shellRenders` unchanged for progress-only ticks, `mission.progress` patch count increases, focused composer node identity is stable.

- [ ] **Step 4: Record DOM counts for Chat/Work/Space** and fail on >20% unexplained increase relative to V5.2 reference budget manifest.

- [ ] **Step 5: Measure local control click-to-DOM-response** with `performance.now`; target p95 <100ms in this environment, report as environment-specific evidence rather than universal claim.

- [ ] **Step 6: Add frame-duration sampling for standard transitions where Chromium Performance APIs permit; report, do not fabricate 60fps when environment cannot measure reliably.**

- [ ] **Step 7: Run performance gate GREEN.**

- [ ] **Step 8: Logical checkpoint.**

---

### Task 16: Final V5.2 Full-Stack/Polyrepo Release Gate and Artifact Freeze

**Files:**
- Modify: `package.json`, `README.md`, `SOURCE-OF-TRUTH.md`, `QA-REPORT.md`
- Create: `CHANGELOG-v5.2.md`
- Modify: `sw.js`, `manifest.webmanifest` as necessary.
- Regenerate: `SHA256SUMS`
- Output: `/mnt/data/Aftergraph-V5.2-Calm-Intelligence-Polyrepo.zip`
- Output: `/mnt/data/Aftergraph-V5.2-Calm-Intelligence-Polyrepo.zip.sha256`

**Interfaces:**
- `npm run verify:release` becomes V5.2-canonical and includes contracts, standard verification, browser, full-stack, upstream/polyrepo, visual, a11y and performance gates.

- [ ] **Step 1: Bump package version to `5.2.0` and update descriptions only after behavior is implemented.**

- [ ] **Step 2: Run fresh unit/contract suite.**

Run: `npm test && npm run verify:v5.2:contracts`
Expected: 0 failures.

- [ ] **Step 3: Run source/platform/polyrepo gates.**

Run: `npm run verify && npm run verify:platforms && npm run verify:upstreams && npm run verify:polyrepo`
Expected: every command exit 0.

- [ ] **Step 4: Run browser/full-stack/a11y/visual/performance gates.**

Run: `npm run verify:browser && npm run verify:fullstack && npm run verify:v5.2:a11y && npm run verify:v5.2:visual && npm run verify:v5.2:performance`
Expected: every command exit 0.

- [ ] **Step 5: Update docs from measured evidence only.** Include exact test counts, browser cases, visual SSIM/pixel ratios, a11y serious/critical counts, performance measurements and environment limitations.

- [ ] **Step 6: Regenerate internal `SHA256SUMS`** excluding the checksum file itself and any transient test outputs not intended for release.

- [ ] **Step 7: Create final ZIP and external SHA-256.**

- [ ] **Step 8: Test archive integrity with `unzip -t`.**

- [ ] **Step 9: Extract ZIP into a clean temporary directory and run internal `sha256sum -c SHA256SUMS`.**

- [ ] **Step 10: From the extracted artifact rerun the full release gate or, if total sandbox timeout requires batching, rerun every constituent release command individually and record each exit code.**

- [ ] **Step 11: Verify final artifact contains no remote Motion runtime, legacy production CSS chain, credentials/secrets, or transient QA server state.**

- [ ] **Step 12: Mark all plan checkboxes complete only after evidence exists.**

---

## Plan Self-Review

### Spec coverage

- Experience architecture: Tasks 10–13.
- Frontend decomposition: Tasks 2, 3, 6.
- UI package split: Task 5.
- CSS consolidation: Task 8.
- Local-first motion: Task 9.
- Server decomposition: Task 7.
- Polyrepo authority preservation: Tasks 3, 4, 7, 12, 16 plus existing upstream gates.
- Error/degraded UX: Tasks 3, 4, 12.
- Accessibility: Tasks 10–14.
- Performance/render budgets: Tasks 2, 15.
- Migration order: Tasks are deliberately ordered structural-first, visual-second, release-last.
- Rollback: V5.1 release remains untouched; this directory is isolated.

### Peer-review coverage

- Render scheduler matrix + focus/caret ownership: PR-1, Tasks 1–3, 6, 10, 15.
- CSS screenshot diff tool/tolerance/viewports: PR-2, Tasks 1 and 8, then per-view baselines in 10–13.
- SSE reconnect semantics: PR-3, Tasks 1 and 4 plus final full-stack gate.
- Controller errors / scroll ownership / UI polyrepo topology / automated WCAG: PR-4, Tasks 1–5 and 14.

### Placeholder scan

The plan contains no placeholder markers or unspecified test steps. Any external axe artifact is explicitly test-only and must include its license. If the environment cannot retrieve the axe distribution, Task 14 is a blocker and must be reported rather than silently replaced with a weaker claim.
