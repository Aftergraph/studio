# Aftergraph V5.2 — Calm Intelligence Design

**Status:** Design approved in chat; written-spec review required before implementation plan and code changes.  
**Date:** 2026-09-06  
**Baseline:** Aftergraph V5.1 Polyrepo Integrated  
**Primary principle:** *Simple until complexity earns its place.*

## 1. Purpose

V5.2 improves the existing V5 C Agentic Operating Environment without replacing its architecture. The product keeps Chat, Work, Space, semantic zoom, presence, replay, approvals, evidence, durable state, SSE, and polyrepo service boundaries. V5.2 changes how that power is presented and how the source code is structured so the default experience is calm, legible, responsive, and maintainable.

The core behavioral rule is:

> Runtime state may change continuously. The interface should change only when the human benefits from seeing that change.

The existing architectural rule remains:

> Objects persist. Surfaces adapt. Capabilities extend. Agents act. Humans retain control.

## 2. Baseline findings

The V5.1 baseline is functional but carries presentation and implementation debt:

- `src/main.mjs` is 744 lines and currently combines bootstrap, view rendering, navigation, event handling, runtime reconciliation, approvals, Space interactions, and UI-local state.
- `server.mjs` is 477 lines and combines HTTP transport, static serving, persistence wiring, SSE, API routing, runtime state, and upstream integration.
- `packages/ui/index.mjs` is a single product-component module rather than a composable component package.
- CSS is split across three generational layers: `styles.css` (595 lines), `v4.css` (264 lines), and `v5.css` (101 lines), so new design rules depend on overrides rather than a single source of truth.
- `@aftergraph/motion` contains an optional network import of Motion from `esm.sh`. Correctness already falls back to WAAPI, but V5.2 removes the remote runtime dependency entirely from the product path.
- Desktop surfaces expose too many simultaneous navigation and status affordances. Mobile is still too close to stacked desktop rather than a purpose-built mobile interaction model.

These are targeted refactors serving V5.2. Unrelated platform rewrites are explicitly out of scope.

## 3. Scope and non-goals

### In scope

1. Calm/minimal Chat default experience with progressive disclosure.
2. Outcome-first Work mode with artifact split only when useful.
3. Space as a direct spatial workspace rather than a dashboard/hero page.
4. Mobile-specific shell and sheet patterns.
5. Product-quality System and Control surfaces.
6. Frontend decomposition into isolated controllers, views, selectors, and reconciliation modules.
7. UI package decomposition into semantic modules.
8. CSS consolidation into one layered design system.
9. Server decomposition into transport, routing, runtime, persistence, upstream, and static-serving modules.
10. Local-first semantic motion with reduced-motion parity.
11. Performance, accessibility, focus, scroll, and render-churn verification.
12. Preservation of exact-head/source-truth and polyrepo authority boundaries.

### Non-goals

- No React/Vite migration in V5.2.
- No new backend authority model.
- No merging of TG, WORKS, AIE, WI, GOV, or ISR responsibilities.
- No replacement of durable state formats solely for code aesthetics.
- No new multiplayer protocol.
- No arbitrary generative HTML/CSS runtime.
- No visual redesign that hides approval, evidence, authority, interrupt, rollback, or source provenance.

## 4. Experience architecture

### 4.1 Primary navigation

The human-facing primary modes remain:

- **Chat** — conversation-first.
- **Work** — outcome-first.
- **Space** — composition-first.

Projects and Recents remain secondary navigation. AGENTS, BRAIN, OUTPUT, CONTROL, CONNECT, and SYSTEM remain canonical domains but are opened contextually, by command, object links, or deep links rather than competing with the three primary modes at all times.

The UI MUST NOT display more than one primary navigation system simultaneously. Desktop may have a compact left rail or top mode control, but not both as equal-priority navigation. Mobile uses a bottom mode bar.

### 4.2 Chat

Chat is the calmest surface in the product.

Default presentation:

- 760–820 px readable conversation column on desktop.
- Stronger type hierarchy and more vertical rhythm.
- User messages may use restrained bubbles; assistant/system content remains open-form.
- Agent progress is summarized into a compact, interruptible trajectory strip.
- Evidence, cost, plan, raw agent detail, and telemetry are hidden until requested or required by risk/state.
- The composer uses one primary input region with contextual capability/context affordances that appear only when relevant.

Chat MUST preserve scroll position during background state changes. Follow-latest occurs only when the user is already near the end or has explicitly requested it.

### 4.3 Work

Work defaults to outcome and current mission state, not operational telemetry.

- A substantial artifact opens into a split only when it materially helps the task.
- Evidence and approvals appear adjacent to the object they govern rather than forcing a domain navigation.
- Trajectory remains available but starts collapsed.
- Verified outcomes settle into durable receipts and remove transient execution chrome.

### 4.4 Space

Space is a workspace, not a landing dashboard.

- Remove large hero framing and permanent explanatory chrome.
- The spatial canvas begins immediately below the shell.
- Add Surface, zoom, focus, presence, and replay become compact edge controls.
- Dock/drag/resize remain available with keyboard-equivalent actions.
- Presence is peripheral. It expands on demand or when attention is required.
- Semantic zoom changes object detail level without changing routes.

### 4.5 System and Control

System and Control must read as product surfaces rather than debug dashboards.

System:

- Source-truth health grouped by service and authority role.
- Clear healthy/degraded/unavailable states.
- Exact-head provenance is inspectable, not permanently repeated.
- Credentials and secret material never render.

Control:

- Pending approvals and Needs You dominate when present.
- Decision context uses What / Why / Impact / Risk / Evidence / Rollback / Authority.
- Approval actions remain explicit and non-manipulative.
- Audit/source provenance is inspectable below the decision surface.

## 5. Mobile interaction model

Mobile is not the desktop layout collapsed vertically.

Required behavior:

- Bottom navigation for Chat / Work / Space.
- Context, artifact, approval, evidence, presence, and replay use sheets/full-screen pushes depending on importance.
- Composer remains reachable above the safe area and keyboard.
- No horizontal overflow at 390 px reference width.
- Long system tables become grouped lists rather than miniature desktop tables.
- Critical Needs You may interrupt; routine runtime progress may not.
- Touch targets satisfy accessibility target-size requirements.

## 6. Frontend source architecture

`src/main.mjs` becomes bootstrap/orchestration only. Target modules:

```text
src/app/
  bootstrap.mjs
  controller.mjs
  ui-state.mjs
  selectors.mjs
  navigation.mjs
  events.mjs
  render-scheduler.mjs

src/views/
  chat-view.mjs
  work-view.mjs
  space-view.mjs
  system-view.mjs
  control-view.mjs
  domain-view.mjs

src/runtime/
  backend-session.mjs
  background-reconciliation.mjs
  live-projection.mjs
  scroll-policy.mjs
```

Existing domain, router, state, integration, live-runtime, surface-lifecycle, spatial-lifecycle, replay, and API-client modules are reused where their boundaries are already clean.

### Ownership rules

- **State domain modules** own canonical product state transitions.
- **UI state** owns purely client presentation state.
- **Background reconciliation** may patch runtime/source truth but MUST NOT take ownership of navigation, active conversation/space, composer mode, theme, local panels, or other human-controlled view state.
- **Views** are deterministic functions of state + UI state + capabilities.
- **Event handlers** call explicit controller methods instead of mutating global state from arbitrary DOM branches.
- **Render scheduler** decides full render versus incremental patch. Runtime progress MUST NOT cause whole-workspace rerenders unless the surface structure changes.

## 7. UI package architecture

`packages/ui/index.mjs` becomes a thin public export surface. Components are split by semantic family:

```text
packages/ui/
  index.mjs
  primitives/
    button.mjs
    icon-button.mjs
    input.mjs
    menu.mjs
    notice.mjs
  conversation/
    turn.mjs
    composer.mjs
    response-status.mjs
  work/
    work-summary.mjs
    outcome-receipt.mjs
    artifact.mjs
  trust/
    approval.mjs
    need-you.mjs
    evidence.mjs
    risk.mjs
  agents/
    agent-card.mjs
    agent-presence.mjs
  system/
    upstream-service-row.mjs
    source-truth-badge.mjs
    event-row.mjs
```

Components render semantic DOM and expose stable `data-*` contracts for testing. Components do not fetch, persist, or own application state.

## 8. CSS architecture

The legacy `styles.css`, `v4.css`, and `v5.css` dependency chain is replaced with a single layered V5.2 style architecture:

```text
styles/
  tokens.css
  reset.css
  shell.css
  components.css
  views.css
  motion.css
  responsive.css
```

`index.html` loads these in explicit order. V3/V4/V5 override rules are migrated, deduplicated, and deleted only after visual/browser regression coverage proves parity or intentional change.

Rules:

- no `!important` unless required for an external/user-agent constraint and documented;
- semantic state attributes preferred over long class combinations;
- consistent spacing/type/radius tokens;
- default surfaces use low visual noise;
- status color is semantic, never decorative;
- motion styles obey reduced-motion preferences.

## 9. Motion architecture

V5.2 removes the `esm.sh` Motion import and network-loading path.

`@aftergraph/motion` remains the semantic API and uses local browser capabilities:

- WAAPI for component/state transitions;
- View Transitions only where supported and where route/surface continuity benefits;
- CSS transitions for simple visual states;
- no animation library required for correctness.

Semantic names remain stable across platforms, for example:

- `control.press`
- `state.change`
- `surface.expand`
- `surface.collapse`
- `attention.focus`
- `outcome.settle`

Reduced motion maps semantic transitions to immediate or low-motion equivalents without changing functionality.

## 10. Server architecture

`server.mjs` becomes composition/root wiring. Target modules:

```text
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
```

Existing `server-store.mjs`, `server-runtime-hub.mjs`, and upstream integration modules remain authoritative for their concerns.

Server behavior MUST remain backward-compatible with V5.1 API clients unless a change is explicitly versioned. API responses continue to fail closed on invalid JSON, oversized bodies, unknown routes, missing authority, or unavailable upstream services.

## 11. Polyrepo and authority invariants

V5.2 MUST preserve these ownership boundaries:

- Trust Gateway: runtime enforcement, approvals, operator control, audit.
- WORKS: durable execution, mission journal, evidence, Brain.
- AIE: authority/delegation/A2A admission semantics.
- Work Intelligence: detection/observation/proposal only; no implicit execution authority.
- Governance: canonical cross-repo contracts and mission lifecycle.
- ISR: research and human-experience evidence; not a runtime dependency.

Exact-head/source-truth verification remains a release gate. V5.2 UI refactoring may change projections but not these authority assignments.

## 12. Error and degraded-state UX

Every remote/service-backed surface supports four explicit states:

1. loading/synchronizing;
2. healthy/current;
3. degraded/stale, with last-known information clearly marked;
4. unavailable/error, with a safe recovery action.

Background synchronization errors appear as restrained status indicators unless they block the user’s current action. An approval or execution write that cannot reach its authority owner MUST fail visibly and MUST NOT be represented as successful local state.

## 13. Accessibility

Required V5.2 gates:

- WCAG 2.2 AA target.
- keyboard access for all primary actions and spatial alternatives;
- visible focus that survives animated/layout transitions;
- semantic headings, landmarks, lists, controls, and status regions;
- appropriate `aria-live` only for user-relevant state changes;
- reduced-motion parity;
- 200% zoom/reflow without lost functionality;
- touch target sizing on mobile;
- no status communicated by color alone.

## 14. Performance and render-budget gates

V5.2 adds measurable product budgets:

- no full shell rerender for a progress-only runtime tick;
- no network dependency for local UI/motion startup;
- no horizontal overflow at 390 px;
- lazy or deferred rendering for heavy visualization/replay detail;
- background ambient animation paused when hidden or reduced motion is enabled;
- DOM count and view render count recorded in browser smoke for Chat, Work, and Space;
- no repeated surface-enter animations from ordinary state reconciliation;
- interaction feedback targeted below 100 ms for local controls;
- 60 fps target for standard transitions on reference browser hardware, assessed by frame-duration instrumentation where available.

These are regression budgets, not marketing claims. A gate reports measured evidence and environment limitations.

## 15. Testing strategy

Implementation uses TDD. Each behavior change begins with a failing test that names the regression or desired contract.

### Unit/contracts

- selectors and client-owned UI-state boundaries;
- background reconciliation does not steal navigation;
- render scheduler distinguishes structural versus progress-only updates;
- semantic component output contracts;
- motion has no remote import/network dependency;
- server route modules preserve API behavior;
- authority boundaries remain fail closed.

### Browser

- calm Chat default and progressive disclosure;
- composer focus and keyboard flow;
- scroll preservation during live updates;
- Work artifact split lifecycle;
- Space dock/resize/focus and keyboard alternatives;
- System and Control degraded/healthy states;
- approval evidence reveal without re-enter animation;
- reduced-motion flows;
- 390 px mobile shell, sheets, and no overflow;
- no background event navigation theft;
- visual reference screenshots for desktop Chat, Work, Space, System, Control, and mobile.

### Full stack

- browser → API → durable Node state → UI;
- TG approval write delegated to TG owner;
- WORKS mission/evidence/Brain projections;
- WI proposal remains non-executable without explicit review/promotion;
- AIE authority/A2A projection failures are safe;
- source-truth drift gate;
- persistence/reload and reconnect behavior.

### Platform parity

Expo and SwiftUI contracts follow the same interaction semantics. Native claims remain source/type/parse-only unless simulator/device tooling is available during verification.

## 16. Migration order

1. Freeze V5.1 behavior with new regression tests.
2. Introduce frontend module boundaries without visual changes.
3. Introduce server module boundaries without API changes.
4. Split UI component package while preserving exports.
5. Consolidate CSS one layer at a time under visual/browser regression.
6. Remove remote Motion loader and verify local-first transitions.
7. Apply Calm Intelligence Chat redesign.
8. Apply Work redesign.
9. Apply Space simplification.
10. Apply System/Control redesign.
11. Apply mobile shell redesign.
12. Add performance/render budgets.
13. Run full V5.2 + polyrepo release gates.
14. Update docs, screenshots, checksums, ZIP, SHA-256, and fresh-archive verification.

This order intentionally separates structural refactoring from visual redesign so regressions remain attributable.

## 17. Acceptance criteria

V5.2 is releasable only when all of the following are evidenced from the final tree:

- Chat, Work, Space remain functional and retain V5 C semantics.
- Default Chat materially reduces simultaneous chrome and remains fully keyboard accessible.
- Mobile uses a dedicated bottom-nav/sheet model and passes 390 px no-overflow checks.
- `src/main.mjs` no longer owns view-specific rendering/event logic; it is bootstrap/orchestration only.
- `server.mjs` no longer owns route implementations; it is composition/root wiring only.
- `packages/ui/index.mjs` is a public barrel over focused semantic modules.
- legacy V4/V5 CSS override chain is removed from production loading.
- remote Motion import is absent from production source.
- progress-only background updates do not whole-render the application shell.
- source-truth and authority gates remain green.
- TG/WORKS/AIE/WI/GOV integration contracts remain correct.
- all unit, browser, full-stack, accessibility-contract, platform-source, and polyrepo gates pass with fresh evidence.
- final ZIP is checksummed, extracted to a clean directory, and release verification is rerun from the extracted artifact.

## 18. Rollback strategy

The V5.1 ZIP remains the immutable rollback artifact. V5.2 changes are developed in a separate worktree/directory. Migration commits are kept logically separable by wave: structural frontend, structural server, UI package, styles, motion, each view redesign, mobile, performance/tests. If a redesign wave fails acceptance, the preceding structural state remains releasable without forcing the visual change.
