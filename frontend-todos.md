# V8.1 Frontend UI/UX Hardcode & Quality Audit TODOs

Revision: `7b5dafb9aaeba3bbee789aae828999554aafb849`
Scope: `151` frontend files under `src/`, `packages/`, `styles/`

Raw scan counts are evidence leads, not automatic refactor instructions. Each item below names canonical ownership and must be reviewed before edits.

## [P1] [HC-B] Raw color cluster bypasses semantic tokens

**Location:** `styles/views.css:1-600`

**Current behavior:** The largest view stylesheet contains hundreds of direct hex/rgba values; repeated values are not consistently expressed through semantic tokens.

**Problem:** Theme changes, contrast review and status consistency require editing many selectors and can drift.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Create a measured color inventory, map repeated values to existing tokens in styles/tokens.css or packages/brand, then migrate one semantic family at a time.

**Recommended change:** Create a measured color inventory, map repeated values to existing tokens in styles/tokens.css or packages/brand, then migrate one semantic family at a time.

**Dependencies:** styles/tokens.css; packages/brand; visual snapshots

**Acceptance criteria:**
- [ ] Repeated semantic colors have one owner
- [ ] No visual regression in V4/V5/V6 browser suites
- [ ] Axe contrast remains green
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** design-system

## [P1] [HC-B] Repeated spacing and dimensions lack an explicit scale

**Location:** `styles/components.css; styles/views.css; styles/shell.css`

**Current behavior:** Common values such as 8px, 10px, 12px and 18px recur hundreds of times beside one-off values such as 17px, 19px and 23px.

**Problem:** The codebase cannot distinguish intentional component dimensions from accidental rhythm drift.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Define a spacing and control-size scale, then migrate repeated clusters with component-level review rather than global search/replace.

**Recommended change:** Define a spacing and control-size scale, then migrate repeated clusters with component-level review rather than global search/replace.

**Dependencies:** design tokens; component visual baselines

**Acceptance criteria:**
- [ ] Duplicate clusters are mapped to token names
- [ ] One-off values have an explicit invariant comment or are removed
- [ ] Responsive smoke remains green
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** design-system

## [P1] [HC-B] Z-index values are not centrally owned

**Location:** `styles/components.css:121-130; styles/shell.css:113; styles/views.css`

**Current behavior:** Stacking values are distributed across reset, shell, component and view styles.

**Problem:** New dialogs, inspectors and toasts can accidentally render below or above the wrong layer.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Create a documented layer scale for base, sticky, popover, modal, toast and critical overlay; replace only values proven equivalent.

**Recommended change:** Create a documented layer scale for base, sticky, popover, modal, toast and critical overlay; replace only values proven equivalent.

**Dependencies:** overlay primitives; browser interaction tests

**Acceptance criteria:**
- [ ] Every stacking context maps to a named layer
- [ ] Popover/modal/toast order is tested
- [ ] No arbitrary 9999 values remain without rationale
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** design-system

## [P1] [HC-E] Breakpoints are duplicated across CSS layers

**Location:** `styles/responsive.css:4; styles/shell.css:114; styles/views.css:2,11,23`

**Current behavior:** The same 760px breakpoint is declared in multiple files while 940px and 1180px are locally owned.

**Problem:** A responsive change can update one layer while leaving shell or view behavior inconsistent.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Define shared breakpoint custom properties/documentation and keep component-specific container queries local where semantically required.

**Recommended change:** Define shared breakpoint custom properties/documentation and keep component-specific container queries local where semantically required.

**Dependencies:** responsive smoke; container-query feasibility

**Acceptance criteria:**
- [ ] Breakpoint ownership is documented
- [ ] Mobile/tablet/desktop states are verified at declared widths
- [ ] No duplicated global breakpoint definitions remain
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P1] [HC-C] API paths are embedded in clients and runtime helpers

**Location:** `src/api-client.mjs:54-; src/federation/browser-client.mjs:1`

**Current behavior:** Route strings and API version paths are spread through client methods.

**Problem:** API version changes, test transport substitution and same-origin/remote deployment rules require multi-file edits.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Keep endpoint ownership in the API client boundary with typed route builders and environment base URL configuration; do not move canonical server paths into UI components.

**Recommended change:** Keep endpoint ownership in the API client boundary with typed route builders and environment base URL configuration; do not move canonical server paths into UI components.

**Dependencies:** API contract tests; server route registry

**Acceptance criteria:**
- [ ] UI contains no endpoint literals
- [ ] Client tests cover every route builder
- [ ] Same-origin and configured-base-url tests pass
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P1] [HC-E] Navigation and domain metadata are split across registries

**Location:** `src/domain.mjs; src/workspace-shell.mjs; src/router.mjs; src/app/bootstrap.mjs`

**Current behavior:** Domain labels, icons, aliases, object ownership and renderers are defined in separate structures.

**Problem:** A new domain can become routable but lack a renderer, mobile entry or canonical object mapping.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Define one typed canonical domain manifest and derive aliases/renderers/navigation metadata with explicit capability filters.

**Recommended change:** Define one typed canonical domain manifest and derive aliases/renderers/navigation metadata with explicit capability filters.

**Dependencies:** route tests; mobile navigation contract

**Acceptance criteria:**
- [ ] One manifest owns domain id/label/icon/route/renderer
- [ ] Deep links and aliases round-trip
- [ ] Unknown domains fail to a documented fallback
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P0] [HC-F] Runtime mock data is mixed with initial production shell state

**Location:** `src/state.mjs:13-110`

**Current behavior:** Demo users, missions, agents, approvals, artifacts and telemetry are embedded in the runtime initial state.

**Problem:** Preview fixtures can be mistaken for canonical backend state and can leak into production behavior when backend data is unavailable.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Split explicit test/demo fixtures from production defaults and make fallback provenance visible; retain deterministic fixtures only in harnesses.

**Recommended change:** Split explicit test/demo fixtures from production defaults and make fallback provenance visible; retain deterministic fixtures only in harnesses.

**Dependencies:** offline shell contract; browser fixtures; backend reconciliation

**Acceptance criteria:**
- [ ] Production boot has no fake consequential records
- [ ] Test harness opts into fixtures explicitly
- [ ] Unavailable backend renders honest empty/degraded state
- [ ] Existing tests and visual behavior are verified

**Priority:** `P0`
**Scope:** `L`
**Auto-fix safe:** `no`
**Status:** DONE
**Owner:** backend

## [P1] [HC-D] Status strings and presentation mappings are distributed

**Location:** `src/state.mjs; src/live-runtime.mjs; src/views/*; packages/ui/*; styles/*`

**Current behavior:** The same lifecycle values are compared and styled in multiple local maps and ternaries.

**Problem:** A new or renamed state can render with no label, wrong color or incorrect action affordance.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Introduce schema-derived status definitions containing allowed transitions, label, icon, tone and accessibility text; consume it from domain and UI layers.

**Recommended change:** Introduce schema-derived status definitions containing allowed transitions, label, icon, tone and accessibility text; consume it from domain and UI layers.

**Dependencies:** journey state machines; existing V6/V7 invariants

**Acceptance criteria:**
- [ ] All status consumers use canonical definitions
- [ ] Unknown status renders safe fallback
- [ ] Transition and presentation tests cover every status
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P1] [HC-D] Currency and number formatting is locally formatted

**Location:** `src/ui-helpers.mjs:23; src/app/bootstrap.mjs:460; packages/ui/work/outcome-receipt.mjs`

**Current behavior:** Amounts use local toFixed/euro formatting rather than one domain formatter.

**Problem:** Currency, locale, cents precision and negative/large-value behavior can diverge between receipts and lists.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Use the V7.4 integer-cent formatter at a shared boundary with explicit currency and locale inputs.

**Recommended change:** Use the V7.4 integer-cent formatter at a shared boundary with explicit currency and locale inputs.

**Dependencies:** src/economy/outcome-economy.mjs; localization policy

**Acceptance criteria:**
- [x] All money displays use one formatter
- [x] Integer-cent precision is preserved
- [x] Locale/currency tests cover EUR and fallback
- [x] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P1] [HC-C] Direct localStorage ownership in bootstrap

**Location:** `src/app/bootstrap.mjs:72,75,608`

**Current behavior:** Storage key and persistence behavior are owned directly by the bootstrap module.

**Problem:** Schema versioning, migration, reset and test isolation are difficult when storage is accessed from render/runtime code.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Create a versioned storage adapter with key constants, migration and failure handling; keep bootstrap dependent on the adapter only.

**Recommended change:** Create a versioned storage adapter with key constants, migration and failure handling; keep bootstrap dependent on the adapter only.

**Dependencies:** state schema; offline shell

**Acceptance criteria:**
- [ ] No direct storage access outside adapter
- [ ] Old schema migration is tested
- [ ] Storage failures degrade without losing current UI state
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P2] [HC-H] Inline runtime styles bypass component tokens

**Location:** `src/app/bootstrap.mjs:274,283,298; packages/brand/react.mjs:41`

**Current behavior:** Dynamic style attributes mix layout/runtime values with presentation rules.

**Problem:** They are harder to audit, can bypass responsive CSS and often encode layout assumptions.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Keep only measured runtime variables inline; move static presentation to classes or component tokens and document legitimate dynamic values.

**Recommended change:** Keep only measured runtime variables inline; move static presentation to classes or component tokens and document legitimate dynamic values.

**Dependencies:** motion/runtime UI; visual baselines

**Acceptance criteria:**
- [ ] Each remaining inline style has runtime justification
- [ ] Static styles use canonical classes
- [ ] No accessibility or visual regression
- [ ] Existing tests and visual behavior are verified

**Priority:** `P2`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P1] [HC-I] Accessibility state coverage is not represented as a shared contract

**Location:** `scripts/a11y_smoke.py; src/views/control-view.mjs; packages/ui/*`

**Current behavior:** Automated checks cover current surfaces, but loading/empty/forbidden/degraded and focus restoration contracts are distributed.

**Problem:** Axe success does not prove keyboard recovery or truthful state semantics across all page states.

**Impact:** UX, accessibility, correctness

**Recommended ownership:** Create a page/component state matrix and add deterministic keyboard/focus assertions for each primary surface.

**Recommended change:** Create a page/component state matrix and add deterministic keyboard/focus assertions for each primary surface.

**Dependencies:** AVC accessibility audit; browser QA

**Acceptance criteria:**
- [ ] Every central page has loading/empty/error/offline/degraded/forbidden coverage
- [ ] Keyboard path and focus restoration are tested
- [ ] Axe and manual evidence are recorded
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P2] [HC-G] Hardcoded UI copy is embedded in render functions

**Location:** `src/app/bootstrap.mjs; src/views/*; packages/ui/*`

**Current behavior:** Labels, empty states, error text and status copy are written directly beside rendering logic.

**Problem:** Terminology, localization and content review require code edits and can drift across surfaces.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Create a small semantic copy catalog for shared terms/statuses/errors; keep object-specific titles runtime-owned.

**Recommended change:** Create a small semantic copy catalog for shared terms/statuses/errors; keep object-specific titles runtime-owned.

**Dependencies:** localization policy; status definitions

**Acceptance criteria:**
- [ ] Repeated UX terms have one owner
- [ ] User/runtime content is not incorrectly catalogued
- [ ] Copy tests cover labels and fallback states
- [ ] Existing tests and visual behavior are verified

**Priority:** `P2`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** docs

## [P1] [HC-G] State booleans permit invalid combinations

**Location:** `src/app/bootstrap.mjs:59-61, 568-590; src/app/ui-state.mjs`

**Current behavior:** Multiple independent booleans represent mutually exclusive surfaces, focus and runtime modes.

**Problem:** Impossible combinations can produce overlapping artifact, approval, inspector and replay surfaces.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Model major surface ownership as discriminated state modes while retaining independent user preferences only where valid.

**Recommended change:** Model major surface ownership as discriminated state modes while retaining independent user preferences only where valid.

**Dependencies:** render scheduler; visual QA; existing interaction tests

**Acceptance criteria:**
- [ ] Invalid surface combinations are unrepresentable or rejected
- [ ] Existing Chat/Work/Space flows remain unchanged
- [ ] State transition tests cover open/close/recovery
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P0] [HC-F] Backend response assumptions lack a single validation boundary

**Location:** `src/backend-reconciliation.mjs; src/runtime/*; src/federation/browser-client.mjs`

**Current behavior:** Consumers read nested response fields directly and each layer supplies partial fallback behavior.

**Problem:** Contract drift can produce plausible but incomplete UI state and hide data loss behind defaults.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Validate/normalize server payloads once at the API boundary with explicit degraded coverage semantics.

**Recommended change:** Validate/normalize server payloads once at the API boundary with explicit degraded coverage semantics.

**Dependencies:** API contract engineering; federation schemas

**Acceptance criteria:**
- [ ] Malformed payloads fail closed or become explicit degraded state
- [ ] Canonical owner/provenance is preserved
- [ ] Representative producers and consumers are tested
- [ ] Existing tests and visual behavior are verified

**Priority:** `P0`
**Scope:** `L`
**Auto-fix safe:** `no`
**Status:** DONE
**Owner:** backend

## [P0] [HC-I] Destructive action protection is not one shared primitive

**Location:** `src/app/bootstrap.mjs; src/views/control-view.mjs; packages/ui/trust/*`

**Current behavior:** Approval, deny, takeover, cancel and upstream decisions have separate interaction paths.

**Problem:** Confirmation, double-submit, loading and recovery semantics can diverge for consequential actions.

**Impact:** UX, accessibility, correctness

**Recommended ownership:** Define a canonical consequential-action state machine and shared action primitive; keep authority execution in the owner adapter.

**Recommended change:** Define a canonical consequential-action state machine and shared action primitive; keep authority execution in the owner adapter.

**Dependencies:** authority audit; API contracts; existing approval tests

**Acceptance criteria:**
- [ ] Every destructive action has pending/confirmed/failed/retry states
- [ ] Duplicate submit is blocked or idempotent
- [ ] No UI state implies authority success before readback
- [ ] Existing tests and visual behavior are verified

**Priority:** `P0`
**Scope:** `L`
**Auto-fix safe:** `no`
**Status:** DONE
**Owner:** backend

## [P1] [HC-E] Duplicate component primitives and local variants need consolidation review

**Location:** `packages/ui/*; src/views/*; styles/components.css; styles/views.css`

**Current behavior:** Buttons, rows, notices, agent cards, approval rows and surface sections have overlapping local markup/style variants.

**Problem:** Fixes for focus, touch targets and semantic states must be repeated and can drift.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Build a consumer matrix first; consolidate only exact semantic duplicates into existing first-party primitives.

**Recommended change:** Build a consumer matrix first; consolidate only exact semantic duplicates into existing first-party primitives.

**Dependencies:** component inventory; accessibility contract

**Acceptance criteria:**
- [ ] Candidates have consumer and behavior evidence
- [ ] Shared primitive preserves all required variants
- [ ] No abstraction created for one-off semantics
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `L`
**Auto-fix safe:** `no`

**Owner:** design-system

## [P2] [HC-J] Dead/legacy markers require classification before cleanup

**Location:** `styles/*; src/*; scripts/*`

**Current behavior:** The raw marker scan returns many matches, including legitimate words such as temporary CSS values and comments.

**Problem:** Blind deletion would remove intentional notes; leaving all markers hides real debt.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Parse markers with context, classify intentional vs actionable, and convert actionable items into owned backlog TODOs.

**Recommended change:** Parse markers with context, classify intentional vs actionable, and convert actionable items into owned backlog TODOs.

**Dependencies:** audit artifact; code ownership

**Acceptance criteria:**
- [ ] Every marker is classified
- [ ] Actionable markers have a TODO item or fix
- [ ] No broad regex-only cleanup
- [ ] Existing tests and visual behavior are verified

**Priority:** `P2`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** docs

## [P1] [HC-I] Responsive audit needs explicit narrow/tablet/wide evidence

**Location:** `styles/responsive.css; styles/shell.css; styles/views.css; scripts/browser_smoke.py`

**Current behavior:** Current automated coverage is strong for selected desktop/mobile flows but not a full component state matrix across narrow mobile, tablet and ultrawide.

**Problem:** Clipping, density and hidden actions can remain unobserved outside the smoke viewport set.

**Impact:** UX, accessibility, correctness

**Recommended ownership:** Add a declared viewport matrix and capture the critical Control, Agents, Output, Space and replay states at each width.

**Recommended change:** Add a declared viewport matrix and capture the critical Control, Agents, Output, Space and replay states at each width.

**Dependencies:** FIN visual QA; browser smoke harness

**Acceptance criteria:**
- [x] 320/390/768/1024/1440/1920 widths are checked
- [x] No horizontal overflow or clipped primary actions
- [x] Evidence is tied to exact revision
- [x] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `M`
**Auto-fix safe:** `no`

**Owner:** frontend

## [P1] [HC-E] Canonical ownership is undocumented for several frontend constants

**Location:** `styles/tokens.css; src/domain.mjs; src/state.mjs; src/api-client.mjs`

**Current behavior:** Token, domain, runtime fixture and endpoint ownership exists but is not declared in one audit-readable contract.

**Problem:** Future slices can move values to a constants file without improving ownership or can duplicate canonical definitions.

**Impact:** maintainability, correctness, UX consistency

**Recommended ownership:** Add an ownership map to the audit artifact and require each new shared value to name its owner category.

**Recommended change:** Add an ownership map to the audit artifact and require each new shared value to name its owner category.

**Dependencies:** V8.1 audit artifacts; review workflow

**Acceptance criteria:**
- [ ] Every P0/P1 finding names owner and consumers
- [ ] Ownership map is machine-readable
- [ ] New audit rerun detects drift
- [ ] Existing tests and visual behavior are verified

**Priority:** `P1`
**Scope:** `S`
**Auto-fix safe:** `yes`

**Owner:** docs

## P0/P1 queue

P0: V81-007, V81-015, V81-016. P1: V81-001, V81-002, V81-003, V81-004, V81-005, V81-006, V81-008, V81-009, V81-010, V81-012, V81-014, V81-017, V81-019, V81-020.

## Duplicate-value clusters

See `frontend-hardcodes.json` for the machine-readable cluster list. Values must not be globally replaced without semantic ownership review.

## Scope boundary

This slice produces the audit and backlog. It intentionally does not mass-refactor literals, move tokens, or delete code. Those are separate owner-approved slices.
