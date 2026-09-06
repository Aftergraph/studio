# Aftergraph Workspace V5 — QA Report

## Scope

V5 is verified as a local full-stack reference through Node behavioral/integration tests, source/conformance checks, native-source contracts, rendered Playwright Chromium regression/Space QA, and a browser-to-real-backend persistence bridge.

The Browser plugin is not available in this execution environment, so rendered QA uses Playwright Chromium. Chromium is administratively blocked from direct localhost navigation in this sandbox; the full-stack browser test therefore bridges only the browser network hop while exercising the **real Node HTTP backend, API client and durable state store**.

Expo/SwiftUI are source/type/parse verified only. No simulator/device claim is made.

## Fresh release evidence

- **151/151 Node tests passed**.
- `npm run verify` passed all syntax, source/conformance, PWA, CSP, secret-pattern and platform checks.
- V4 interaction-regression browser suite passed inside the V5 shell.
- V5 Space browser suite passed on desktop and 390px mobile.
- V5 full-stack browser bridge passed against a real ephemeral Node server/state file.
- Browser smoke flows reported **0 uncaught page errors**.

## V5 Space interaction coverage

Rendered V5 QA verifies:

- Chat / Work / Space are the only permanent primary modes;
- durable spatial objects restore;
- semantic zoom changes level and object context;
- Evidence docks as a typed surface;
- pointer drag moves Evidence between spatial regions;
- keyboard-accessible Move remains available;
- surface entrance motion settles and does not restart on stable rerenders;
- intent composer changes capability mode;
- agent presence and Follow Agent work;
- Replay opens as a spatial time surface with scrub control;
- focused surface state is singular/durable;
- Space focus mode changes layout;
- Chat morphs to Space without reload;
- 390px Space has no page-level horizontal overflow;
- mobile retains durable spatial objects.

## V4 regression coverage retained in V5

The regression suite verifies that V5 did not break the V4 Living Interface contracts:

- Projects + Unified Recents;
- artifact closed by default;
- lifecycle-stable artifact morphing;
- live trajectory and progress;
- pause/resume;
- user-owned chat scroll preservation;
- command palette focus/search;
- context inspector;
- immersive mode;
- focused approval + attention gravity + evidence reveal;
- takeover / hand-back;
- mobile fullscreen artifact and approval sheet;
- all contextual canonical-domain surfaces.

## Full-stack bridge coverage

The browser-to-real-backend flow verifies:

1. UI connects through the V5 API client.
2. Chat write persists server-side.
3. Browser enters Space.
4. Semantic zoom persists server-side.
5. Evidence docking persists server-side.
6. Local file attachment metadata appears in the composer.
7. Attachment metadata persists through browser → API → durable store.
8. Replay cursor persists server-side.
9. Deterministic reset restores the V5 spatial seed.

## Accessibility / interaction evidence

The current reference gate includes:

- semantic native buttons/inputs;
- explicit accessible names for rendered Space buttons;
- keyboard artifact resizing;
- keyboard Move alternative for spatial drag;
- focus delivery to command palette;
- ARIA state on expandable Pulse Rail;
- reduced-motion source/runtime contracts;
- mobile no-overflow checks.

This is **not** represented as a complete third-party WCAG certification or exhaustive assistive-technology audit.

## Material issues found and fixed during V5 closure

- Pointer-drag browser test targeted the fixed topbar because the target Space region extended above the viewport after scroll. The harness now drops inside the region/viewport intersection and proves the real pointer flow.
- The V4 regression harness removed new V5 imports while bundling, producing a blank page. It now boots all V5 packages while checking preserved V4 behavior.
- The release verifier incorrectly required `AGRegion` to be absent even though V5 explicitly defines it as a first-party spatial primitive. The verifier now matches the approved V5 contract.
- Legacy V4 Pulse Rail overlapped V5 Presence in Space. Space now owns its own peripheral intelligence.
- Server-owned progress ticks previously risked structural chat rerenders; progress-only updates use incremental reconciliation while structural transitions still rerender truthfully.

## Environment boundary

- Web UI: rendered and interaction-tested in Chromium.
- Node backend: real HTTP/SSE and persistence integration-tested.
- Browser direct localhost: blocked by sandbox policy; bridged for browser integration only.
- Native Expo/SwiftUI: source/type/parse verified, not emulator/simulator tested.
- External production WORKS/AIE/provider integrations: not connected in this local reference.


## V5.1 polyrepo integration QA

Additional verification covers:

- six pinned readable source-truth repositories and roles;
- exact mission-state, policy.token and Work Intelligence boundary contracts;
- release failure on pinned HEAD drift;
- read-only multi-service synchronization;
- Trust Gateway identity, approvals, Needs You and audit projection;
- WORKS Work and Company Brain projection;
- AIE task projection through the reviewed A2A HTTP+JSON surface;
- Work Intelligence proposals rendered explicitly as proposal-only;
- explicit TG approval delegation;
- WI promotion fail-closed without human actor + confirmation;
- credentials absent from state/UI projections;
- background server/SSE source-truth updates preserve client-owned navigation;
- rendered System, Work, Brain and Control source-truth surfaces in Chromium.

`python scripts/polyrepo_bridge_smoke_v5.py` uses real HTTP upstream adapters against isolated contract-faithful services and the real V5 Node server/durable state. It does not use production credentials.

Git clone itself remains environment-blocked by container DNS. The exact contract and source-review materialization boundary is recorded in `../upstreams/SOURCE-MATERIALIZATION.json`.
