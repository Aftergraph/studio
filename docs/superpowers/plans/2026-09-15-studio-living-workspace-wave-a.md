# Studio Living Workspace — Workstream A Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD and review each diff before continuing.

**Goal:** Make Chat, Work, and Space visibly share one Active Context, replace intrusive connection state with compact inspectable freshness, and establish the shared composer/mobile-shell foundation.

**Architecture:** Add a pure Active Context projection under `src/workspace/` and render it through first-party UI components. Keep canonical state untouched; mode changes only change representation. Backend phase becomes compact global status plus object-level freshness metadata.

**Tech Stack:** Node.js 22+, ES modules, first-party HTML string renderers, CSS design tokens, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-15-studio-living-workspace-governed-genui-design.md`

## Global Constraints

- Preserve Chat / Work / Space as the only permanent primary modes.
- Projection is never authority; no new write path is introduced.
- Active Context must preserve canonical IDs across mode changes.
- Stale/offline state remains readable but visibly marked.
- Actions requiring live authority remain fail-closed.
- No React rewrite and no OpenUI visible design-system dependency.
- Mobile uses progressive disclosure and touch targets >= 44 CSS px where interactive.

---
### Task 1: Active Context projection

**Files:**
- Create: `src/workspace/active-context.mjs`
- Create: `tests/living-workspace-active-context.test.mjs`
- Modify: `src/app/bootstrap.mjs`

**Produces:** `deriveActiveContext(state, ui, backendPhase)` returning stable project/mission/work/artifact/evidence/agent refs plus freshness summary.

- [ ] Write tests proving the mission/artifact IDs are unchanged when primary mode changes Chat → Work → Space.
- [ ] Verify RED because `active-context.mjs` does not exist.
- [ ] Implement pure derivation without mutating canonical state.
- [ ] Integrate the derived context into Studio rendering.
- [ ] Run the focused tests and existing workspace/chat contracts.

### Task 2: Compact context + freshness shell

**Files:**
- Create: `packages/ui/system/active-context-bar.mjs`
- Modify: `packages/ui/index.mjs`
- Modify: `src/app/bootstrap.mjs`
- Modify: `styles/shell.css`
- Modify: `styles/responsive.css`
- Test: `tests/living-workspace-shell.test.mjs`

- [ ] Define failing shell contract for canonical context label, evidence count and compact freshness state.
- [ ] Remove the persistent connectivity overlay behavior; backend phases update the compact shell status instead.
- [ ] Preserve `aria-live` status semantics without overlaying the active surface.
- [ ] Verify desktop and mobile CSS contracts.
### Task 3: Shared contextual composer contract

**Files:**
- Modify: `packages/ui/conversation/composer.mjs`
- Modify: `src/app/bootstrap.mjs`
- Modify: `styles/views.css`
- Test: `tests/living-workspace-composer.test.mjs`

- [ ] Write failing tests for selected-context chips, intent hint, and one stable composer DOM contract across modes.
- [ ] Extend `AGComposer` with context refs and optional intent preview while retaining current submit/focus hooks.
- [ ] Keep consequential execution as preview-only; do not introduce direct writes.
- [ ] Ensure mobile composer remains operable with safe-area padding and 44px primary controls.
- [ ] Run composer, chat, focus/caret and mobile shell contracts.

### Task 4: Workstream A verification

**Files:**
- Modify only if verification exposes defects in Workstream A files.

- [ ] Run focused Node contracts for Active Context, shell, composer, Chat/Work/Space continuity and accessibility.
- [ ] Run `npm run verify`.
- [ ] Start Studio on an isolated port and run existing browser smoke plus a mobile viewport smoke.
- [ ] Confirm no new console/runtime errors and no overlay obscures Chat, Work or Space.
- [ ] Record the exact tested commit and remaining environment-only blocker (Pillow visual-diff dependency).

## Acceptance

Workstream A is complete when the same mission/artifact identity is visible across Chat, Work and Space; connection degradation is peripheral and inspectable; the composer has one contextual contract; mobile controls meet the interaction floor; and focused verification is green apart from the pre-existing Pillow-only visual test environment failure.
