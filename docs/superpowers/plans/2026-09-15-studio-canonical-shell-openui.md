# Studio Canonical Shell + Governed OpenUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one canonical Aftergraph Studio shell at `/studio/*` with ChatGPT-style mobile navigation, base-aware routing, and governed OpenUI preserved as the dynamic content layer.

**Architecture:** Keep the existing Studio runtime and authority boundaries. Add a base-aware route/navigation contract, split desktop versus mobile primary navigation, add a mobile sidebar sheet, and restyle shell chrome without replacing the existing Chat/Work/OpenUI internals. Deploy backend and Cloudflare static Studio from the same exact merged SHA.

**Tech Stack:** Node.js 22+, native ES modules, HTML/CSS, Playwright browser QA, Cloudflare Workers static assets, systemd backend.

**Spec:** `docs/superpowers/specs/2026-09-15-studio-canonical-shell-openui-design.md`

## Global Constraints

- One interactive application shell: `aftergraph.org/studio/*`.
- Mobile permanent primary modes are exactly Chat and Work.
- Space is contextual on mobile, persistent/reachable on desktop.
- OpenUI cannot own shell/navigation/authority/endpoints/raw HTML.
- Preserve Billing authority and all existing canonical owner boundaries.
- Production backend and static artifact must expose the same exact Studio SHA.

---
### Task 1: Base-aware Studio router

**Files:**
- Modify: `src/router.mjs`
- Test: `tests/canonical-shell-router.test.mjs`

**Interfaces:**
- Produces: `appBasePath(locationLike)`, `withAppBase(pathname, locationLike)`, base-aware `routeFromLocation(locationLike)`.

- [ ] Write tests proving local `/chat|work|space` and deployed `/studio/chat|work|space` resolve identically.
- [ ] Add tests for `/studio/plugins`, `/studio/projects`, `/studio/remote`, `/studio/settings`, `/studio/billing` contextual surfaces.
- [ ] Run the test and confirm RED.
- [ ] Implement path normalization and base-preserving URL builder without changing typed deep-link semantics.
- [ ] Run router tests GREEN and commit.

### Task 2: Canonical navigation registry

**Files:**
- Modify: `src/workspace-shell.mjs`
- Test: `tests/canonical-shell-navigation.test.mjs`

**Interfaces:**
- Produces: `PRIMARY_MODES`, `MOBILE_PRIMARY_MODES`, `SIDEBAR_DESTINATIONS`, `canonicalDomainForNav(id)`.

- [ ] Write tests that mobile modes equal `chat,work` and sidebar destinations include `space,billing,plugins,projects,remote,settings`.
- [ ] Run RED.
- [ ] Implement the finite navigation registry with canonical domain/route metadata.
- [ ] Run GREEN and commit.
### Task 3: Mobile drawer + shell routing

**Files:**
- Modify: `src/app/ui-state.mjs`
- Modify: `src/app/bootstrap.mjs`
- Test: `tests/canonical-shell-bootstrap.test.mjs`

**Interfaces:**
- Consumes: navigation registry and `withAppBase`.
- Produces: mobile drawer state/actions; base-preserving navigation for Chat/Work/Space/contextual destinations.

- [ ] Write source/integration tests for mobile menu action, drawer state, two-mode mobile switch, and `/studio`-preserving history paths.
- [ ] Run RED.
- [ ] Add `mobileSidebarOpen` UI state and toggle/close actions.
- [ ] Render Chat/Work only in the mobile segmented control; keep Space in sidebar/command paths.
- [ ] Route Plugins -> Connect, Settings -> System, Projects -> Work collection, Billing -> canonical billing entry, Remote -> Connect/System capability surface.
- [ ] Close the mobile drawer after destination selection.
- [ ] Run GREEN and commit.

### Task 4: Calm canonical shell styling

**Files:**
- Create: `styles/canonical-shell.css`
- Modify: `index.html`
- Modify: `sw.js`
- Test: `tests/canonical-shell-style.test.mjs`

**Interfaces:**
- Produces: final override layer for desktop sidebar, mobile topbar/segmented control, mobile drawer/backdrop, and calm surfaces.

- [ ] Write tests for the stylesheet link, service-worker cache entry, 44px controls, drawer safe-area rules, and removal of bottom-fixed mobile mode switch.
- [ ] Run RED.
- [ ] Implement neutral/light+dark shell overrides with reduced glow and one mobile drawer sheet.
- [ ] Keep Active Context compact and connectivity visually peripheral.
- [ ] Run GREEN and commit.
### Task 5: Browser acceptance for canonical shell

**Files:**
- Modify: `scripts/v5_2_browser_qa.py`
- Test: rendered Chromium through existing harness

**Interfaces:**
- Consumes: canonical shell behavior.
- Produces: release evidence for desktop/mobile navigation and base-aware behavior.

- [ ] Add mobile assertions for exactly two primary tabs, visible menu trigger, drawer open/close, Space/Plugins/Settings reachability, >=44px touch targets, and no horizontal overflow.
- [ ] Add a deployed-base simulation asserting `/studio/chat|work|space` choose the intended mode.
- [ ] Preserve governed GenUI prepare-only assertions.
- [ ] Run browser QA GREEN and commit.

### Task 6: Full regression and Cloudflare build compatibility

**Files:**
- Verify Studio repo plus `Aftergraph/aftergraph.org` build scripts; modify site verifier only if required by a discovered contract gap.

**Interfaces:**
- Produces: exact-SHA deployable Studio artifact.

- [ ] Run focused canonical-shell + Living Workspace + GenUI tests.
- [ ] Run `npm test`; allow only the pre-existing local Pillow-only visual diff failure until the CI/venv harness runs.
- [ ] Run `npm run verify:release` in the configured QA environment.
- [ ] Build Studio through `site/studio-build.cjs` using the exact candidate SHA and run `site/verify-studio.cjs build`.
- [ ] Run `git diff --check` and secret scan.

### Task 7: Integrate, deploy, verify, rollback-ready

**Files:**
- GitHub: `Aftergraph/studio` main through PR/merge queue.
- Runtime: `/opt/aftergraph-studio/releases/<sha>` and `current` symlink.
- Cloudflare: `aftergraph-studio` Worker through the existing `aftergraph.org` production workflow.

- [ ] Push feature branch and open PR with verification evidence.
- [ ] Merge through repository policy after required checks are green.
- [ ] Materialize exact merged Studio SHA into a new versioned backend release and install locked dependencies.
- [ ] Atomically activate backend, restart service, verify `/healthz` + `/readyz`, retain previous release target for rollback.
- [ ] Trigger `Studio Production Deploy` with the same exact Studio SHA.
- [ ] Verify public `/studio/`, `/studio/chat`, `/studio/work`, `/studio/space`, `/studio/version.json`, `/studio/healthz` and 390px browser smoke.
- [ ] If any public verification fails, rollback backend symlink and Cloudflare Worker; otherwise record the release SHA as final evidence.
