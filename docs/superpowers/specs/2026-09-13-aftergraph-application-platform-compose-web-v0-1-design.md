# Aftergraph Application Platform + Compose Web v0.1 Design

Date: 2026-09-13
Status: Design direction approved in conversation; written spec pending final review
Repository: `Aftergraph/studio`
Base: `feat/compose-mobile-v0-1`
First reference product: **Aftergraph Compose**

## 1. Purpose

This design turns the existing Aftergraph Compose vertical slice into a production-grade web/PWA product surface while creating the first reusable layer of an Aftergraph Application Platform.

The objective is not to build another temporary frontend. The objective is to make the already-working Compose intelligence usable immediately from iPhone and desktop, while establishing reusable UI contracts for future Aftergraph products.

The product promise remains:

> You write the way you think. Aftergraph Compose turns it into the way an AI agent should be instructed.

The default user experience must stay dramatically simpler than the infrastructure underneath it.

## 2. Current reality to preserve

The design starts from code and infrastructure that already exist.

### 2.1 Existing Compose capability

The current Compose branch already contains:

- canonical `aftergraph/intent-ir/v0.1`;
- target renderers;
- Studio `POST /api/v1/intent/compile`;
- isolated Hermes Compose inference boundary;
- Expo capture/result/refine/copy/share/recents flow;
- local mobile persistence;
- fail-closed authority handling;
- target overrides and refinements;
- tests and CI coverage.

This work is not replaced. Web Compose consumes the same semantic core and API.

### 2.2 Existing Studio application primitives

Studio already contains package-level UI and platform concepts including:

- `packages/tokens`;
- `packages/ui`;
- `packages/ui/conversation`;
- `packages/ui/trust`;
- `packages/ui/agents`;
- `packages/interaction`;
- `packages/motion`;
- `packages/icons`;
- existing web/PWA files (`manifest.webmanifest`, `sw.js`, service-worker registration).

The new work must extend and modernize these concepts rather than creating an unrelated design system beside them.

### 2.3 Existing Aftergraph boundaries

Compose must remain a user interaction and intent-compilation product. It does not become the execution authority.

Long-term consequential work remains:

```text
Compose / Studio UI
        |
        v
Intent Compiler
        |
        v
Trust Gateway
        |
        v
Relay
        |
        v
Runtime / Works Execution
```

Confidence never grants authority. UI affordances must never silently widen permissions.

## 3. Product scope

### 3.1 Immediate v0.1 goal

Deliver a private, installable, high-quality Compose web/PWA that is usable from iPhone Safari/Home Screen and desktop without waiting for Expo Go or native development-build work.

Primary flow:

```text
open Compose
  -> type or paste rough thought
  -> submit
  -> receive improved instruction artifact
  -> optionally refine
  -> copy/share
  -> continue conversation
  -> reopen from history later
```

### 3.2 What v0.1 includes

- chat-first experience;
- adaptive assistant responses;
- instruction artifact cards;
- target selection;
- refinement actions;
- version lineage;
- copy/share;
- local conversation history;
- desktop artifact split view;
- mobile fullscreen artifact view;
- mobile bottom sheets;
- private HTTPS/PWA installation path;
- accessibility, performance and visual-regression gates;
- exact reuse of the existing intent compile API and semantic kernel.

### 3.3 What v0.1 does not include

- direct Run/Execute/Send-to-agent authority;
- public signup/onboarding;
- cloud conversation sync;
- billing;
- collaboration/workspaces;
- marketplace;
- public internet deployment as a release requirement;
- replacing Trust Gateway, Relay, Runtime or Context Continuity;
- rewriting the existing native Expo client.

## 4. Experience principle

The application is **chat-first, artifact-native, card-driven, sheet-based, versioned and adaptive**.

Chat is the navigation and interaction spine, not the only visual primitive.

A user should never need to understand Intent IR, route plans, trust graphs or provider boundaries to use the product effectively.

The product should feel comparable in finish to top consumer AI tools while remaining recognizably Aftergraph rather than visually cloning another company.

## 5. Interaction vocabulary

The reusable Application Platform begins with a small vocabulary of typed interaction objects.

### 5.1 Core types

```text
Message
Artifact
Decision
Boundary
Status
Source
VersionEvent
Diff
Handoff
Approval (future consequential flows)
```

Each type has a stable semantic contract independent of its web/native renderer.

### 5.2 Renderer principle

Backend and semantic packages return structured application data. They do not return HTML, React component names or presentation instructions tied to one client.

Example:

```text
Intent / result data
       |
       v
Presentation model
       |
       +--> ChatMessage
       +--> InstructionArtifact
       +--> DecisionCard
       +--> BoundaryCard
       +--> VersionEvent
       +--> StatusCard
```

This creates a future seam for native Expo and other Aftergraph clients to render the same logical interaction differently.

## 6. Primary mobile UI

The iPhone experience opens directly into Compose.

### 6.1 Top bar

Minimal chrome:

- history/navigation control;
- `Compose` identity;
- optional lightweight context/target affordance when appropriate;
- no Studio dashboard controls or infrastructure jargon.

### 6.2 Conversation canvas

The main viewport is an open conversation surface with restrained spacing, strong typography and low visual noise.

User turns and assistant turns do not need identical speech bubbles. User text may be visually grouped, while system/assistant output can use open text plus typed artifacts.

### 6.3 Composer

The composer is the most important control in the product.

Required behavior:

- fixed near the bottom, respecting iOS safe areas;
- grows naturally from one line to a bounded multiline state;
- preserves unsent draft;
- immediate visual response on submit;
- target selector available with low prominence;
- `+` opens contextual actions rather than permanently occupying the screen;
- submit remains reachable when the software keyboard is open;
- no accidental submit from composition/IME states;
- desktop: Enter submits, Shift+Enter creates a newline;
- touch target size follows the platform accessibility bar.

Primary placeholder/copy should remain human and simple, for example:

> Skriv som du tænker…

## 7. Artifact experience

### 7.1 Instruction artifact

A successful Compose result is primarily an `InstructionArtifact`, not a wall of assistant text.

Collapsed chat card shows:

- artifact kind;
- concise title or goal;
- selected/recommended target;
- short preview;
- Copy;
- Share;
- Open/Expand;
- applicable refinements.

### 7.2 Mobile artifact mode

Opening the artifact transitions to a focused fullscreen view.

Sections can include:

- Objective;
- Context;
- Constraints;
- Completion criteria;
- Output expectations;
- relevant authority boundary summary;
- final target-ready instruction.

Internal canonical IR remains behind an advanced `Details` affordance, not in the normal flow.

### 7.3 Desktop artifact mode

On wider viewports, opening an artifact uses a split workspace:

```text
conversation | artifact
```

The conversation remains interactive while the selected artifact stays inspectable.

This split view is a reusable Application Platform primitive, not Compose-only markup.

## 8. Refinement and versioning

Refinement must be understandable, reversible and semantically traceable.

### 8.1 Behavior

Selecting `Safer`, `More autonomous`, `Clearer`, `More detailed`, `Shorter` or `Execution-ready` creates a derived artifact version.

A refinement does not overwrite history.

### 8.2 Conversation representation

Do not dump every complete version into the chat stream.

Instead, render a compact `VersionEvent`, for example:

```text
Refined · Safer
v1 -> v2

Authority boundary made explicit
No new permissions added

Open v2   Compare
```

### 8.3 Version lineage

Each derived artifact records:

- parent version id;
- refinement operation;
- timestamp;
- target;
- semantic source intent id;
- material differences when available.

Restoring an earlier version changes the active version pointer. It does not delete newer versions.

## 9. Decision and ambiguity interactions

Material ambiguity should not be hidden inside generated prose.

When compilation identifies ambiguity that prevents a confident execution-ready output, the UI renders a `DecisionCard` with concise choices.

Example:

```text
Which scope did you mean?

[Only this repository]
[All Aftergraph repositories]
[Let Compose recommend]
```

The answer becomes conversation context and produces a new derived result.

Avoid turning every small uncertainty into a modal question. Only material ambiguity should interrupt the flow.

## 10. Boundary and trust interactions

The normal v0.1 path has no execution authority, but authority remains visually representable.

If a result includes a meaningful safety or authority constraint, a compact `BoundaryCard` or artifact section can state it in human terms, for example:

```text
No execution access
No merge permission
Approval required for destructive actions
```

The user-facing layer must avoid pretending that a model suggestion is an enforced runtime permission when it is merely a compiled instruction constraint.

Future Trust Gateway-backed actions may use approval cards, but those are outside v0.1.

## 11. Visual direction

The visual system should borrow proven interaction qualities, not brand identity, from leading AI products.

### 11.1 Product qualities

From strong conversational AI products, preserve:

- low cognitive load;
- excellent composer ergonomics;
- strong long-form typography;
- progressive disclosure;
- clear information hierarchy;
- high-density information only when the task requires it;
- smooth but restrained transitions;
- excellent mobile behavior.

### 11.2 Aftergraph identity

Aftergraph-specific visual character comes from:

- existing Brand OS/tokens where valid;
- high-clarity typography;
- precise spacing;
- quiet surfaces rather than excessive chrome;
- evidence/provenance treatments;
- subtle version/state markers;
- deliberate motion;
- a coherent icon language.

Avoid:

- generic dashboard card grids;
- gratuitous gradients/glows;
- excessive rounded containers;
- fake status pills;
- infrastructure labels in user-facing UI;
- permanently visible advanced controls;
- visual imitation of ChatGPT, Claude or Perplexity branding.

### 11.3 Theme

Support system/light/dark behavior from the start. Theme is token-based and must not require component-specific hardcoded color forks.

### 11.4 Visual concept gate

Before production UI implementation, generate and approve coordinated visual concepts for at least:

1. iPhone main chat;
2. iPhone artifact fullscreen;
3. iPhone target/refinement bottom sheet;
4. desktop conversation + artifact split view;
5. loading/error/decision states where needed to clarify component anatomy.

The approved concepts become visual implementation specifications and are verified against browser screenshots during implementation.

## 12. Frontend technology direction

### 12.1 Long-term web foundation

Use:

- Next.js;
- React;
- TypeScript with strict settings.

Rationale: this is the long-term Aftergraph consumer/product surface, not a disposable PWA shim. The platform should support route-level composition, future authenticated product surfaces, server/client boundaries, incremental loading, production deployment options and a mainstream React ecosystem.

### 12.2 Compatibility with existing Studio server

The existing Studio API remains authoritative for Compose semantics in v0.1.

Do not rewrite the intent compiler/API into Next.js route handlers merely because Next.js exists.

The first web application calls the existing same-origin/proxied Studio API contract:

```text
POST /api/v1/intent/compile
```

Deployment may place the Next application behind the same private origin or reverse proxy so browser code does not require provider credentials or permissive CORS.

### 12.3 Styling and design system

Use:

- CSS custom properties for canonical runtime design tokens;
- Tailwind CSS as a styling utility/compiler where it improves implementation speed;
- reusable Aftergraph components rather than exposing Tailwind vocabulary as the product design API.

Existing `packages/tokens`, `packages/ui`, `packages/icons`, `packages/motion` and related packages are audited first. Valid contracts are preserved or evolved; duplicated systems are not created casually.

### 12.4 Accessible interaction primitives

Prefer semantic native HTML wherever it gives correct behavior.

For complex interactions such as dialogs, sheets, popovers, listboxes and focus management, use a mature accessibility-oriented primitive layer such as React Aria where it fits the accepted visual specification.

The primitive layer must remain visually unopinionated. Aftergraph owns the presentation.

### 12.5 State

Separate state by responsibility:

- server state: TanStack Query or equivalent query abstraction;
- transient product UI state: small local stores/hooks, with Zustand only where cross-tree state justifies it;
- durable local data: IndexedDB, with a thin repository abstraction;
- schema/runtime validation: Zod at API/storage boundaries.

Do not put all application data in a single global store.

### 12.6 Rendering and rich content

- Markdown must be parsed safely, not injected as arbitrary HTML;
- code blocks use a high-quality syntax renderer such as Shiki when code is present;
- long histories/artifact lists use virtualization only when actual profiling shows it is needed;
- React Suspense/transitions may be used where they improve responsiveness without making state behavior opaque.

### 12.7 Motion

Use a production React motion library for layout/sheet/artifact transitions when native CSS is insufficient.

Motion rules:

- never delay access to content merely to animate it;
- honor `prefers-reduced-motion`;
- no fake token-by-token typing animation when the server did not stream;
- transitions communicate hierarchy/state changes rather than decorate idle screens.

## 13. Application package direction

The platform should converge toward reusable package ownership such as:

```text
@aftergraph/tokens
@aftergraph/icons
@aftergraph/ui
@aftergraph/conversation
@aftergraph/artifacts
@aftergraph/agent-ui
@aftergraph/api-client
@aftergraph/contracts
```

This is a direction, not permission for a speculative package explosion in v0.1.

Only extract a package when Compose implementation proves a real reusable boundary.

Existing Studio package locations are preferred when they already own the capability.

## 14. Data model

### 14.1 Conversation

A local conversation contains:

```text
id
createdAt
updatedAt
title
activeArtifactId
turns[]
```

### 14.2 Turn

A turn contains:

```text
id
role
createdAt
content blocks[]
status
```

A content block may reference typed presentation objects rather than storing all content as one markdown string.

### 14.3 Artifact

Minimum artifact record:

```text
id
conversationId
kind
sourceIntentId
version
parentVersionId
target
createdAt
content
metadata
```

### 14.4 Local storage rule

Local history is private-device state in v0.1. It must not be labeled or represented as Context Continuity synchronization until that integration exists.

Provide bounded retention controls and explicit deletion behavior.

## 15. Data flow

Primary compile path:

```text
user submit
   |
   v
optimistic local turn creation
   |
   v
compile mutation
   |
   v
Studio /api/v1/intent/compile
   |
   v
Intent Compiler -> Hermes/model -> normalized Intent IR -> renderer
   |
   v
validated API response
   |
   v
presentation mapper
   |
   +--> assistant text
   +--> InstructionArtifact
   +--> boundary/ambiguity metadata
   |
   v
persist local conversation/artifact version
```

The source draft and submitted user turn are persisted before a model failure can destroy them.

## 16. Loading and response behavior

The application must react immediately to submit.

Use honest states such as:

```text
Understanding
Compiling
Refining
Ready
```

Only expose stages that correspond to real observable application/provider state. Do not fabricate fake internal chain-of-thought or pretend to show model reasoning.

If real streaming becomes available through the API, the UI may render streamed response content. Until then, use state transitions and progressive artifact appearance without fake streaming.

## 17. Error handling

Errors are local, recoverable and source-preserving.

### 17.1 Compile failure

- keep user turn;
- keep draft/source;
- render compact error state in the conversation;
- provide Retry;
- do not create a successful artifact record.

### 17.2 Validation failure

- reject malformed API payloads at the client boundary;
- show a safe generic failure state;
- log structured diagnostic information without exposing secrets.

### 17.3 Offline

- existing conversation/history stays readable;
- composer may save drafts;
- compile is disabled or produces an explicit offline retry state;
- never imply that generation occurred offline unless an actual supported local model path exists.

### 17.4 Share/copy failure

The artifact remains selectable and readable. Clipboard/share errors never destroy state.

## 18. PWA and private distribution

The usable-now distribution target is a private HTTPS web application reachable from the user’s iPhone and desktop.

Initial private distribution may use Tailscale HTTPS/reverse proxying or another already-approved private deployment boundary.

Requirements:

- secure context;
- installable manifest;
- correct application icons and apple-touch metadata;
- service-worker lifecycle with safe update behavior;
- offline application shell/history reading where appropriate;
- no provider secrets in client JavaScript, manifest, storage or cache;
- same-origin/proxied API where practical.

The global Studio PWA must not accidentally change its default landing behavior merely to support Compose. Compose should own a stable direct route and product installation behavior.

## 19. Routing

Minimum web routes:

```text
/compose
/compose/c/:conversationId
```

Artifact selection should be deep-linkable when practical without forcing every artifact version into a permanent top-level route.

Desktop/mobile rendering adapts responsively under the same product routes.

## 20. Accessibility

Target WCAG 2.2 AA as the minimum quality bar.

Application-specific requirements:

- sensible 44px-class mobile hit areas for primary touch controls;
- visible keyboard focus;
- full keyboard operation for desktop controls;
- correct accessible names and relationships;
- announcements for generation completion/error without noisy live regions;
- focus containment/return for sheets/dialogs;
- reduced-motion support;
- sufficient contrast in both themes;
- no color-only meaning;
- dynamic viewport and mobile keyboard behavior tested on iOS Safari;
- semantic buttons/links/inputs preferred over div-based controls.

## 21. Performance budgets

Performance is a product requirement.

Initial goals:

- fast first usable render on a normal modern phone over private network;
- composer input must never visibly lag during long conversations;
- artifact opening should feel immediate after data exists;
- avoid loading syntax highlighting, diff engines or heavy artifact modules until needed;
- route/component code splitting for non-primary surfaces;
- monitor Core Web Vitals and interaction latency;
- no unbounded DOM growth for extremely long histories.

Exact numeric budgets are finalized during implementation planning after measuring the current Studio/Next baseline.

## 22. Security and privacy

- provider/model credentials remain server-side only;
- browser persistence contains user conversation data and derived artifacts, not backend secrets;
- API inputs/outputs are validated;
- rendered markdown/code cannot execute arbitrary HTML/script;
- service worker must not cache authenticated API payloads indiscriminately;
- diagnostics redact authorization material;
- no execution authority is introduced in Compose v0.1;
- future consequential actions require explicit Trust Gateway/Relay integration rather than frontend-only controls.

## 23. Observability

For private v0.1, capture useful product diagnostics without creating invasive analytics.

Useful events include:

- compile started/succeeded/failed;
- target changed;
- refinement applied;
- artifact opened;
- copy/share outcome;
- local persistence failure;
- PWA update failure;
- response/compile latency.

Do not log raw user prompt/artifact content by default merely for analytics convenience.

## 24. Testing strategy

### 24.1 Contract/unit

Test:

- presentation mapping from compile responses;
- authority/boundary preservation;
- version lineage;
- target/refinement state;
- local repository behavior;
- schema validation;
- reducer/store invariants.

### 24.2 Component

Test:

- composer behavior;
- artifact cards;
- version events;
- decision cards;
- target/refinement sheets;
- copy/share fallbacks;
- error/retry states;
- accessibility semantics.

### 24.3 Browser/E2E

Playwright coverage must exercise at least:

```text
new conversation
 -> submit rough thought
 -> compile fixture/live-safe request
 -> artifact appears
 -> target override
 -> refinement
 -> artifact version changes
 -> copy/share path
 -> history reopen
 -> reload persistence
```

Also verify desktop split-view and mobile-sized viewport behavior.

### 24.4 Visual regression

Approved concept images become the visual source of truth.

Capture browser screenshots at agreed iPhone and desktop sizes and compare:

- layout;
- typography;
- spacing;
- palette;
- controls;
- artifact anatomy;
- sheet behavior;
- loading/error states.

Implementation is not visually complete merely because tests pass.

### 24.5 Physical-device gate

Before calling the private PWA usable:

- open it in physical iPhone Safari;
- complete the primary Compose flow;
- verify keyboard/safe-area behavior;
- verify Copy;
- verify Share;
- verify Home Screen installation/launch if supported by the selected distribution path;
- verify history after reload/relaunch;
- capture any iOS-specific visual/interaction defects.

This gate is independent of Expo Go.

## 25. Implementation boundary with Expo

Expo remains the native product track.

Web and native share:

- semantic contracts;
- Intent IR;
- target definitions;
- API client contracts;
- validation schemas;
- design tokens where practical;
- artifact/interaction data types.

They do not need to share every rendered UI component.

Web should use excellent DOM/browser primitives. Native should use excellent native primitives.

## 26. Rollout sequence

### Phase A: visual and frontend foundation

- final visual concept set;
- Next/React/TypeScript application boundary;
- token audit and design-system baseline;
- conversation shell and composer.

### Phase B: usable Compose vertical slice

- compile API integration;
- instruction artifact;
- target selection;
- refinements;
- version events;
- copy/share;
- local history.

### Phase C: PWA/private release

- private HTTPS route;
- installable manifest/icons;
- service-worker lifecycle;
- iPhone Safari/Home Screen QA;
- exact-SHA release evidence.

### Phase D: Application Platform extraction

After the vertical slice proves component boundaries:

- extract/revise reusable conversation primitives;
- extract artifact primitives;
- formalize agent UI contracts;
- connect Studio/Sentinel surfaces only when a concrete consumer justifies the change.

### Phase E: native convergence

Continue Expo development-build work using shared contracts and product semantics, not by delaying the web release.

## 27. Fastest path to usefulness

The fastest path is intentionally narrower than the complete future platform:

```text
approved visual concepts
 -> conversation shell
 -> existing compile API
 -> instruction artifact
 -> refinement/version flow
 -> local history
 -> private HTTPS PWA
 -> physical iPhone Safari gate
```

The following must not block first usefulness:

- cloud sync;
- Runtime execution;
- generalized marketplace/integrations UI;
- organization management;
- billing;
- full migration of every Studio screen into Next.js;
- completion of the native Expo distribution path.

## 28. Migration principle

Do not perform a big-bang rewrite of Studio.

The new React/Next surface is introduced behind explicit product routes and consumes existing APIs/contracts.

Existing Studio surfaces continue to operate while reusable primitives are proven and migrated deliberately.

This avoids turning a user-facing Compose release into an unrelated months-long frontend rewrite.

## 29. Acceptance criteria

Compose Web/PWA v0.1 is release-ready when:

1. `/compose` opens directly into a polished conversation surface on iPhone and desktop.
2. A rough thought can be submitted without exposing internal architecture jargon.
3. The existing compile backend returns a validated result and an instruction artifact renders.
4. Target override works from the same canonical source intent.
5. Refinements create reversible derived versions without widening authority.
6. Copy works.
7. Native Web Share is used where available, with a safe fallback.
8. Local conversation history survives reload/relaunch and can be deleted.
9. Failure never erases the user’s source input.
10. No provider credential is present in browser assets or local storage.
11. No direct execution/write authority is introduced.
12. Mobile sheets and desktop split view work at their intended breakpoints.
13. WCAG-oriented accessibility checks pass and critical interactions are keyboard/screen-reader sane.
14. Unit/component/E2E/visual gates pass on the exact release SHA.
15. The primary flow is observed on a physical iPhone Safari/Home Screen path.
16. The implementation matches the approved visual concept closely enough for agency-level design sign-off.

## 30. Architectural decision summary

We choose:

- Compose as a real product, not a prompt form;
- chat as the interaction spine;
- artifacts/cards/sheets as adaptive UI primitives;
- versioned refinement instead of destructive replacement;
- Next.js + React + strict TypeScript as the long-term web application foundation;
- reuse of existing Studio API/Intent Compiler rather than backend duplication;
- private HTTPS/PWA as the fastest usable distribution path;
- Expo as a parallel native track, not a blocker;
- reusable Application Platform contracts extracted from proven Compose needs;
- fail-closed authority and explicit Aftergraph trust boundaries.

The resulting system should feel simple at first contact and become progressively more powerful only when the user asks it to.
