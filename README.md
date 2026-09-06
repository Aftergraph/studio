# Aftergraph Studio — Unified Intelligence Operating Environment

The sovereign operating environment for governed AI intelligence, durable work, and verified outcomes (Aftergraph Workspace v5 foundation, V6 Unified Intelligence OS).

V5 preserves the low-chrome Chat/Work experience from V4 and adds **Space** as a first-class spatial work mode for durable objects, active agents, evidence, replay and multimodal intent.

> **Objects persist. Surfaces adapt. Capabilities extend. Agents act. Humans retain control.**

## Primary product model

The permanent human-facing modes stay intentionally small:

- **Chat** — conversation-first.
- **Work** — outcome-first.
- **Space** — composition-first.

Projects and Unified Recents provide continuity. The canonical ownership domains remain internal/contextual:

`NOW · CHAT · WORK · AGENTS · BRAIN · OUTPUT · CONTROL · CONNECT · SYSTEM`

## V5 inhouse package boundary

The product API and visible interaction language are Aftergraph-owned:

- `packages/ui` — semantic product components and control surfaces.
- `packages/motion` — lifecycle-bound semantic motion and reduced-motion policy.
- `packages/tokens` — semantic color, type, density, depth and motion tokens.
- `packages/icons` — Aftergraph icon vocabulary.
- `packages/runtime-ui` — contextual UI composition.
- `packages/spatial` — `AGSpace`, `AGRegion`, dock/focus/peek/stack primitives and semantic zoom.
- `packages/presence` — human/agent presence and follow-agent semantics.
- `packages/interaction` — normalized interaction commands.
- `packages/visualization` — trajectory, evidence and replay visualizations.
- `packages/composer` — multimodal intent, capability and context composition.

Low-level/headless primitives may be used behind this boundary in production, but the visible product consumes Aftergraph semantics rather than exposing a third-party design system.

## Spatial interaction

Space is durable state, not a decorative canvas:

- dock typed Artifact / Agent / Evidence / Replay surfaces;
- pointer drag between regions with a keyboard-accessible **Move** alternative;
- focus and balanced/overview layouts;
- semantic zoom: Mission → Workstream → Task → Agent → Action → Evidence;
- follow active agents through presence;
- replay durable event history;
- restore spatial state from the local full-stack backend.

The V4 global Pulse Rail is intentionally suppressed in Space because Presence + Context + Time are the native peripheral intelligence there.

## Full-stack runtime

`npm start` runs the first-party Node backend and web shell on `127.0.0.1:8000` by default.

The backend provides:

- durable JSON workspace state;
- conversation/message writes;
- mission execution state and SSE live updates;
- approvals and Needs You;
- takeover / hand-back;
- context, memory and artifacts;
- canonical-domain resource reads;
- persistent spatial state;
- persistent replay cursor;
- multimodal attachment metadata.

Default state path:

`.runtime/workspace-state.json`

Override with `AFTERGRAPH_STATE_FILE` when needed.

## Run locally

Requires **Node.js 22+**.

```bash
./start.sh
# or
npm start
```

Open:

```text
http://127.0.0.1:8000
```

No `npm install` is required for the core web/runtime reference.

## Verification

```bash
npm test
npm run verify
npm run verify:browser
npm run verify:fullstack
npm run verify:upstreams
npm run verify:polyrepo
```

The release gate additionally runs the V4-in-V5 regression browser suite and archive integrity checks before packaging.

### Current verified release gate

- **151/151 Node tests passed**.
- Source/conformance and syntax checks passed.
- Expo TypeScript/source contracts passed.
- SwiftUI parse/source contracts passed.
- V4 behavior regression browser suite passed inside the V5 shell.
- V5 Space desktop/mobile browser suite passed, including pointer drag docking.
- Browser → V5 API client → real Node backend → durable state bridge passed.
- No uncaught browser page errors were observed in the release smoke flows.

See `QA-REPORT.md` for the exact scope and environment boundary.

## PWA / offline

The service worker caches the V4 Living Interface foundation plus all V5 first-party runtime packages and `v5.css`, while explicitly excluding live `/api/*` responses from the offline cache.

## Native reference layers

- `platforms/expo/`
- `platforms/swiftui/`

Both expose Chat / Work / Space and V5 spatial semantics. They are **source/type/parse verified only** in this container because Expo Go, Android Emulator, Xcode and iOS Simulator are not available here. No native device-runtime claim is made.

## Truth boundary

This is a deterministic local full-stack **reference build** aligned to the previously verified Aftergraph architecture. It is not represented as a byte-identical checkout of the upstream Aftergraph repositories and is not connected to production WORKS/AIE/provider credentials.

The local server/runtime is real and persistence-backed; external provider/tool integrations remain reference contracts rather than live production connections.

See:

- `SOURCE-OF-TRUTH.md`
- `QA-REPORT.md`
- `CHANGELOG-v5.md`
- `docs/superpowers/specs/2026-09-05-aftergraph-v5-agentic-operating-environment-design.md`
- `docs/superpowers/plans/2026-09-05-aftergraph-v5-implementation.md`


## V5.1 polyrepo integration

V5.1 connects the workspace to independently verified source-truth boundaries for Trust Gateway, WORKS, AIE, Work Intelligence V2, After Graph Governance and ISR. See `POLYREPO-INTEGRATION.md`.

The available container could not resolve `github.com`, so a normal `git clone` could not complete. The authenticated GitHub connector was used to verify default-branch heads and inspect the canonical contracts/source seams. Exact contracts are materialized under the sibling `upstreams/` directory, while reviewed interface notes are explicitly labelled as notes rather than source clones.

The runtime path is:

```text
V5 UI
  -> local V5 API / durable state
  -> source-specific adapters
     -> Trust Gateway: approvals / enforcement / audit
     -> WORKS: durable work / events / evidence / Brain
     -> AIE: authority-owned A2A task operations
     -> Work Intelligence: observations / proposals / explicit review+promotion
  -> Governance: canonical contract validation
```

`POST /api/v1/upstreams/sync` is read-only. Consequential writes are explicit and delegated to the canonical owning service. Background upstream/SSE updates cannot steal the user's local Chat/Work/Space or domain navigation.
