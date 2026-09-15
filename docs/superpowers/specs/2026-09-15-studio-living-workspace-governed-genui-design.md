# Aftergraph Studio — Living Workspace + Governed Generative UI Design

**Date:** 2026-09-15  
**Status:** Design approved in chat; written specification pending final review before implementation planning  
**Target:** `Aftergraph/studio`  
**Primary surfaces:** `/studio/chat`, Chat, Work, Space, universal composer, command/search, Needs You/approvals  
**Supersedes:** visual and interaction assumptions in the current Studio shell where they conflict with this specification  
**Preserves:** V6 authority, evidence, federation, source-of-truth, durability, and fail-closed invariants

## 1. Purpose

Aftergraph Studio is already architected as a unified intelligence operating environment, but its current human interface still behaves too much like several separately designed application screens that share a theme. Chat, Work, Space, command/search, approval, and degraded-connectivity states do not yet feel like projections of one durable object graph.

This design upgrades Studio into a **Living Workspace**: one persistent human environment in which conversation, execution, composition, evidence, artifacts, agents, authority, and state remain continuous while the user changes view.

The second architectural addition is **Governed Generative UI**. Model- or agent-generated interfaces may adapt to the active task, but only through Aftergraph-owned component contracts and interaction semantics. A generated interface may propose presentation and interaction. It never grants itself authority, changes canonical ownership, upgrades stale state to fresh state, or bypasses a governed write path.

Canonical product statement:

> **One living workspace for intent, work, evidence, and verified outcomes — adaptive in presentation, fixed in authority.**

## 2. Problem statement

The current mobile Studio screenshots expose several systemic weaknesses rather than isolated styling issues:

1. **Chat, Work, and Space do not preserve one obvious active context.** The same mission changes representation and control structure enough that users must reconstruct the mental model when changing modes.
2. **Work under-represents execution.** Mission progress, agent name, budget, and evidence count are visible, but the trajectory area carries too little of the actual action graph, dependencies, evidence lineage, retries, or decisions that distinguish Aftergraph from a conventional AI assistant.
3. **Space is over-framed.** Nested rounded panels, card borders, mode chrome, object controls, and a separate composer compete with the content rather than making object relationships easier to understand.
4. **Chat is still message-first rather than durable-object-first.** Mission progress appears as an embedded card rather than as a first-class stateful object linked to the same mission that Work and Space project.
5. **Connection degradation is globally intrusive.** A persistent `Connection interrupted · showing last-known state` overlay correctly communicates stale state but visually dominates every surface and does not identify which objects are stale or which actions actually require live authority.
6. **Command/search exposes product nouns instead of resolving user intent.** Commands such as `Open Space`, `Create work`, and `Delegate to agent` are useful, but users should not need to know Aftergraph's internal taxonomy before expressing a goal.
7. **Mobile is largely compressed desktop semantics.** A true mobile interaction model requires contextual sheets, progressive disclosure, stable bottom composition, and fewer simultaneous regions.

The upgrade therefore cannot be a color, spacing, or card-polish pass. It is an interaction-architecture change that preserves the existing V6 system boundaries.

## 3. Non-negotiable invariants

The redesign MUST preserve the following invariants.

### 3.1 Authority

1. UI projection is never authority.
2. Generative UI is never authority.
3. Consequential operations route through canonical capability, authority, policy, approval, execution, evidence, and reconciliation paths.
4. Generated controls cannot create new capabilities or widen an existing capability.
5. Missing or unreachable authority fails visibly and does not produce optimistic success.
6. Destructive and privileged actions never execute solely because a model generated a button or form.

### 3.2 Canonical ownership

1. Canonical IDs remain unchanged.
2. Studio may project, compose, index, and relate objects but does not silently replace their owners.
3. A surface always has enough metadata to recover canonical owner, canonical object identity, freshness, and evidence state.
4. A visual relation does not imply a canonical semantic relation unless the relation exists in the object graph.

### 3.3 Evidence

1. Evidence classes remain distinct.
2. Generated summaries do not upgrade evidence status.
3. Verification language is only shown when supported by canonical verification evidence.
4. Evidence links remain inspectable from Chat, Work, and Space.

### 3.4 Freshness

1. Cached state must remain usable for reading where policy allows.
2. Stale state must be marked at object or surface level.
3. Actions requiring current authority state are disabled or blocked when required freshness is unavailable.
4. A global connectivity indicator may summarize degraded state, but it must not replace object-level freshness.

### 3.5 Human control

1. Take-over and hand-back remain explicit.
2. Approval remains a deliberate human decision where policy requires it.
3. The interface must distinguish recommendation, preparation, submission, execution, and verified completion.
4. The system must explain what will happen before a consequential action when the user requests explanation or policy requires it.

## 4. Product model

The permanent human-facing modes remain:

- **Chat** — conversation and intent first.
- **Work** — execution and outcome first.
- **Space** — composition and relationship first.

These are not independent applications. They are three projections of the same **Active Context**.

### 4.1 Active Context

Active Context is the durable set of objects currently in focus:

```ts
interface AGActiveContext {
  contextId: string
  project?: AGObjectRef
  mission?: AGObjectRef
  work?: AGObjectRef
  artifacts: AGObjectRef[]
  evidence: AGObjectRef[]
  agents: AGObjectRef[]
  selectedObjects: AGObjectRef[]
  freshness: AGFreshnessSummary
  authorityHints: AGAuthorityHint[]
  updatedAt: string
}
```

Changing Chat → Work → Space MUST NOT discard Active Context. A mission selected in Chat remains the mission shown in Work. Objects opened in Space remain addressable from Chat. An artifact created from Work is immediately available in the same context.

### 4.2 Context continuity rule

Mode switching changes **representation and available interaction density**, not canonical object identity.

A user should be able to answer these questions at any point:

- What am I working on?
- What is happening now?
- What changed?
- What needs me?
- What evidence exists?
- What is stale?
- What can I safely do next?

## 5. Global Studio shell

The shell must become calmer and more continuous.

### 5.1 Persistent top level

Desktop shell:

```text
┌──────────────────────────────────────────────────────────────┐
│ Aftergraph     Chat  Work  Space       Context      Status  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                     Active surface                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Universal composer                                           │
└──────────────────────────────────────────────────────────────┘
```

Mobile shell:

```text
┌────────────────────────────┐
│ Aftergraph            ●    │
│ Chat   Work   Space        │
├────────────────────────────┤
│                            │
│      Active surface        │
│                            │
├────────────────────────────┤
│ Contextual composer        │
└────────────────────────────┘
```

### 5.2 Global shell rules

- Top-level chrome must not contain status widgets that duplicate the active surface.
- Current mode is visually clear without oversized segmented-control chrome.
- Connectivity, attention, and approval indicators are compact and inspectable.
- Project and context navigation are accessible without forcing persistent sidebars on mobile.
- The universal composer is one system with mode-sensitive behavior, not separate per-screen implementations.
- Command/search is globally available.

## 6. Chat — Conversation Workspace

Chat becomes a conversation workspace capable of producing and manipulating durable objects.

### 6.1 Chat anatomy

```text
Conversation header
  ├─ active project / mission context
  ├─ agent / model activity summary when relevant
  └─ freshness / connection summary

Conversation stream
  ├─ human messages
  ├─ assistant reasoning summaries where product-appropriate
  ├─ generated read-only components
  ├─ interactive governed components
  ├─ artifact references
  ├─ mission/work events
  └─ evidence references

Composer
  ├─ natural-language intent
  ├─ attachments
  ├─ selected context
  ├─ capability preview when consequential
  └─ submit / stop / continue controls
```

### 6.2 Durable inline objects

A Chat response may include first-class objects such as:

- MissionPlan
- WorkSummary
- EvidenceList
- EvidenceComparison
- RepositoryDiff
- TestResults
- MetricTable
- Chart
- ClaimComparison
- RecommendationSet
- ApprovalRequest
- ArtifactPreview
- AgentActivity
- Timeline
- Decision

These objects are not decorative message cards. They retain object references and can be opened in Work or Space without recreating their identity.

### 6.3 Chat state transitions

A user request such as:

> Analyze the billing deployment failure and fix it.

may transition through:

```text
intent received
→ relevant context resolved
→ diagnosis / research activity
→ generated evidence comparison
→ proposed governed mission or action
→ user confirmation if required
→ execution
→ evidence and outcome
```

The assistant may explain the transition in prose, but the durable execution state belongs to Work and the object graph.

### 6.4 Chat must not

- become a feed of oversized cards;
- duplicate the entire Work interface inline;
- show generated success before canonical confirmation;
- hide source ownership behind conversational language;
- require slash commands for normal operation.

## 7. Work — Execution Workspace

Work is the primary surface for observable execution.

### 7.1 Work hierarchy

The default Work surface contains:

1. Mission header
2. Current activity
3. Execution trajectory
4. Evidence and artifacts
5. Decisions / blockers / Needs You
6. Contextual inspector

Example:

```text
Build Q4 business report                            RUNNING
65% · Data Analysis Agent · €3.20 / €8.00

NOW
Processing Q4 metrics
Working for 1m 42s
Next: Generate visualizations

EXECUTION
✓ Analyze sources
● Process Q4 metrics
│ ├ Revenue aggregation                      ✓
│ ├ Cohort normalization                     ●
│ └ Outlier review                           ○
○ Generate visualizations
○ Create recommendations
○ Compile report

Evidence 4       Artifacts 2       Decisions 1

Trajectory
intent → plan → action → evidence → verification → outcome
```

### 7.2 Execution nodes

Every execution node may expose:

- stable action/work/task identity;
- status;
- owning agent or worker;
- inputs;
- tool or capability;
- canonical owner;
- authority state;
- start/end timestamps;
- cost/resource usage;
- retry/recovery information;
- produced artifacts;
- produced evidence;
- verifier result;
- dependency edges.

### 7.3 Inspector behavior

Selecting a node opens a contextual inspector rather than navigating away.

Desktop: side inspector.  
Mobile: bottom sheet or full-height sheet.

Inspector sections are generated from registered object capabilities but follow a stable order:

1. Summary
2. Inputs / outputs
3. Evidence
4. Authority / policy
5. History / retries
6. Relations

### 7.4 Progress semantics

Progress percentages must be grounded in a known execution model. If progress cannot be meaningfully quantified, Work uses state language such as `3 of 5 stages` or `Analyzing` rather than manufacturing a percentage.

## 8. Space — Spatial Object Workspace

Space is a durable composition surface for relationships, not a card dashboard.

### 8.1 Desktop anatomy

```text
┌──────────────┬────────────────────────────┬───────────────┐
│ Object rail  │                            │ Inspector     │
│              │      Spatial canvas        │               │
│ Mission      │                            │ Evidence      │
│ Artifact     │   Mission ──▶ Artifact     │ Authority     │
│ Evidence     │       │                    │ History       │
│ Agent        │       ▼                    │ Relations     │
│              │     Evidence               │               │
└──────────────┴────────────────────────────┴───────────────┘
│ Universal composer                                        │
└────────────────────────────────────────────────────────────┘
```

### 8.2 Mobile Space

Mobile MUST NOT squeeze rail + canvas + inspector into one viewport.

- Canvas occupies the primary viewport.
- Object rail is a sheet.
- Inspector is a sheet.
- Object actions are contextual.
- Composer remains available without covering selected content.

### 8.3 Generative spatial composition

Agents may propose layouts based on the work:

```text
Deployment timeline
      │
 ┌────┴────┐
 ▼         ▼
Logs     Config diff
 └────┬────┘
      ▼
Root-cause hypothesis
      │
      ▼
Fix proposal
```

The proposal affects layout only. It does not create canonical relations that do not exist.

### 8.4 Spatial persistence

The system persists:

- object placement;
- regions;
- focus state;
- semantic zoom;
- selected objects;
- inspector context;
- replay cursor where applicable.

Generated rearrangement is explicit and reversible.

## 9. Universal Composer and Intent Compiler

The composer must accept natural language without requiring users to choose an internal product mode first.

Current action labels such as `Ask`, `Research`, `Build`, `Create`, `Delegate`, and `Automate` may remain as shortcuts or intent hints, but they must not be the primary conceptual boundary.

### 9.1 Intent resolution

```text
User intent
→ context resolution
→ candidate object targets
→ capability resolution
→ agent/worker selection
→ authority requirements
→ risk classification
→ execution preview when needed
→ execution or approval
```

### 9.2 Execution preview

For meaningful or consequential actions, the composer can show a compact preview:

```text
Create governed mission
Research Q4 → analyze → generate report
1 agent · €8 max · Drive read · approval before publishing

[Edit]  [Run]
```

The preview is a projection of the proposed execution chain, not a promise that all steps will succeed.

### 9.3 Composer context

The composer can include explicit selected context:

- mission;
- work;
- artifact;
- repository;
- evidence;
- selected Space objects;
- attachments.

Context chips or tokens must remain removable and inspectable without consuming excessive mobile space.

## 10. Command / Search — Intent-first command center

The current command palette evolves into universal search + command resolution.

A user can enter:

> compare the last two billing releases

and receive:

```text
Compare releases
8da6be5 ↔ febcc42

Sources
✓ Repository
✓ CI
✓ Release evidence

Will create
• Diff
• Test comparison
• Deployment delta

[Run]
```

### 10.1 Command result classes

- Navigate to object
- Open surface
- Search/query
- Create draft
- Start work
- Delegate
- Prepare consequential action
- Open Needs You
- Inspect system state

### 10.2 Command safety

The command palette never becomes a privileged bypass. Consequential results enter the same governed path as equivalent actions elsewhere.

## 11. Needs You and Approval

Approval is a first-class decision surface and one of the strongest current Studio interaction patterns. It is preserved and made more evidence-dense.

### 11.1 Approval anatomy

```text
Deploy release 4.8.0
PRODUCTION · DESTRUCTIVE

What changes
4 services · 17 containers
+32 / -11 configuration changes

Why now
✓ Build
✓ Security
✓ Staging
✓ Verification

Risk
LOW–MEDIUM
Expected interruption <20s

Rollback
Automatic → 4.7.3
Last verified 14 min ago

Evidence 12
View deployment diff →

Reject                                  Approve
```

### 11.2 Approval requirements

Approval surfaces MUST expose when available:

- requested operation;
- target;
- requester / agent;
- why now;
- impact;
- risk class;
- relevant policy;
- rollback or irreversibility state;
- freshness of supporting evidence;
- evidence count and inspection;
- expiration where applicable.

High-risk policy may require explicit second-step confirmation or hold-to-confirm. The UI component cannot choose the risk class itself.

## 12. Connectivity and freshness

Connectivity becomes a state model rather than a permanent overlay.

### 12.1 Global state

Normal compact forms:

- `● Live`
- `● Reconnecting`
- `● Last synced 43s ago`
- `● Partial connectivity`

### 12.2 Object-level state

Objects may display:

- `CURRENT`
- `STALE · observed 04:41`
- `DEGRADED`
- `UNAVAILABLE`
- `DRIFTED`

### 12.3 Action gating

If an action requires current authority state:

```text
Live authority state unavailable
This action requires current policy and authority state.

[Retry connection]
```

Read-only cached state remains visible where policy permits.

### 12.4 Removal of intrusive global toast

The persistent centered `Connection interrupted · showing last-known state` banner is removed as the normal degraded-state representation. A transient banner remains valid only when a state transition requires immediate attention.

## 13. Governed Generative UI architecture

### 13.1 OpenUI influence

OpenUI demonstrates a useful architecture for streaming, component-constrained generative UI:

```text
Component library
→ generated model instructions
→ model output
→ compact streamed UI language
→ parser
→ renderer
→ interactive UI
```

The implementation currently exposes a framework-agnostic `@openuidev/lang-core` package for parsing, prompt generation, runtime evaluation, and types, while React-specific rendering lives in separate packages.

Aftergraph should adopt the architectural pattern and evaluate `@openuidev/lang-core` behind an Aftergraph adapter. Studio MUST NOT migrate to React solely to consume OpenUI.

### 13.2 Ownership rule

OpenUI is not the Aftergraph design system.

```text
OpenUI-compatible language / parser boundary
                │
                ▼
      Aftergraph GenUI Adapter
                │
                ▼
Aftergraph Generative Component Registry
                │
                ├─ packages/ui
                ├─ packages/runtime-ui
                ├─ packages/visualization
                ├─ packages/spatial
                ├─ packages/composer
                ├─ packages/interaction
                └─ packages/motion
```

Aftergraph owns:

- component names;
- component schemas;
- visual implementation;
- action semantics;
- authority requirements;
- freshness behavior;
- evidence behavior;
- accessibility contract;
- interaction classes;
- supported contexts.

### 13.3 Dependency decision

The first implementation should use an adapter boundary that allows either:

1. `@openuidev/lang-core` as the parser / prompt-generation engine; or
2. an Aftergraph-native parser implementing the same local interface.

No application code may directly depend on OpenUI package internals outside this adapter boundary.

This preserves the ability to replace, pin, patch, or remove the dependency without redesigning Studio.

## 14. Aftergraph Generative Component Registry

### 14.1 Component contract

```ts
interface AGGenerativeComponent<Props = unknown> {
  id: string
  version: string
  schema: AGSchema<Props>
  allowedContexts: Array<'chat' | 'work' | 'space' | 'artifact'>
  interactionClass: 'read' | 'draft' | 'command' | 'consequential'
  requiredCapabilities: string[]
  freshnessPolicy: AGFreshnessPolicy
  authorityPolicy: AGAuthorityPolicy
  evidencePolicy: AGEvidencePolicy
  render: AGComponentRenderer<Props>
}
```

### 14.2 Initial registered component families

The initial registry should cover reusable primitives already justified by Studio workflows:

**Execution**
- `MissionPlan`
- `WorkSummary`
- `ExecutionGraph`
- `AgentActivity`
- `Timeline`
- `Decision`

**Evidence / verification**
- `EvidenceList`
- `EvidenceMatrix`
- `VerificationResult`
- `SourceComparison`

**Engineering**
- `RepositoryDiff`
- `TestResults`
- `ReleaseComparison`
- `DeploymentSummary`

**Research / analysis**
- `MetricTable`
- `Chart`
- `ClaimComparison`
- `RecommendationSet`

**Durable output**
- `ArtifactPreview`
- `DocumentPreview`

**Governed interaction**
- `ActionProposal`
- `ApprovalRequest`
- `StructuredInput`

The registry is intentionally finite. Generic presentation primitives may exist internally, but models receive the smallest useful component vocabulary for the current context.

### 14.3 No direct DOM generation in trusted surfaces

Trusted GenUI follows:

```text
model stream
→ parser
→ syntax validation
→ component allowlist
→ schema validation
→ interaction classification
→ authority/freshness/evidence annotation
→ safe renderer
```

Unknown components, unknown props, invalid nesting, unsupported action references, and unrecognized interaction classes fail closed.

## 15. Generated interaction model

Generated components do not call service endpoints directly.

### 15.1 Interaction envelope

```ts
interface AGGeneratedInteraction {
  interactionId: string
  componentId: string
  componentVersion: string
  contextId: string
  action: string
  targetRefs: AGObjectRef[]
  values?: Record<string, unknown>
  interactionClass: 'read' | 'draft' | 'command' | 'consequential'
  createdAt: string
}
```

### 15.2 Interaction flow

```text
Generated component interaction
→ packages/interaction normalized command
→ context validation
→ capability resolution
→ authority resolution
→ policy / risk classification
→ optional approval
→ canonical write
→ evidence
→ reconciliation
→ component state update
```

### 15.3 Optimistic behavior

Read-only local UI interactions may update optimistically where no canonical state changes.

Consequential actions MUST NOT show canonical success optimistically. Valid interim states include:

- prepared
- waiting for approval
- submitted
- executing
- reconciling

Canonical completion appears only after authoritative confirmation.

## 16. GenUI vs Artifacts

Studio adopts a clear product distinction:

### GenUI
Use when the interface is the answer or immediate interaction:

- comparison table;
- evidence selector;
- configuration form;
- chart;
- action proposal;
- filtered list.

### Artifact
Use when the output is a durable object the user returns to independently:

- report;
- code patch;
- design;
- generated application;
- presentation;
- research memo;
- long-running analysis output.

A conversation may create both. Artifact identity survives beyond the Chat message that introduced it.

## 17. Open-ended generated HTML/CSS/JS

OpenUI supports open-ended HTML experiences inside a sandbox. Aftergraph may expose an equivalent capability for prototypes and artifacts, but it is a lower-trust execution class.

### 17.1 Allowed uses

- prototype UI;
- temporary analysis dashboard;
- interactive report;
- visualization;
- generated microsurface;
- disposable experiment.

### 17.2 Prohibited implicit privileges

Sandboxed generated HTML MUST NOT directly receive:

- service credentials;
- privileged bearer tokens;
- Trust Gateway secrets;
- canonical mutation APIs;
- unrestricted repository write tokens;
- approval authority;
- browser access to privileged local storage.

### 17.3 Bridge model

A sandbox may communicate with Studio through a narrow message bridge containing allowlisted read data and explicit governed interaction requests.

```text
Sandbox
→ postMessage/request envelope
→ validation
→ interaction bus
→ capability/authority path
```

No bridge method is privileged by default.

## 18. State and persistence

### 18.1 Generated UI state

Generated component state is divided into:

1. **Ephemeral presentation state** — expansion, selected tab, local sort.
2. **Thread interaction state** — form draft, selected options, generated component revision.
3. **Durable object state** — canonical or Studio-owned object state.

The first two may be restored with a conversation/workspace. The third remains owned by the canonical system.

### 18.2 Generated surface identity

A generated component instance uses a stable instance ID within its thread/context so that streaming updates do not recreate unrelated local state.

### 18.3 Versioning

Persisted GenUI stores:

- component ID;
- component version;
- schema version;
- source message/event;
- object references;
- generated props;
- interaction history where policy allows.

Incompatible component versions render a safe migration or read-only fallback, never arbitrary legacy code.

## 19. Design system direction

The redesign preserves Aftergraph Brand OS and semantic tokens. It does not introduce an OpenUI visual identity.

### 19.1 Reduce

- nested rounded cards;
- borders around every region;
- decorative pills;
- duplicated headings;
- permanent status banners;
- glows without semantic meaning;
- desktop controls compressed onto mobile;
- competing primary actions.

### 19.2 Increase

- typography hierarchy;
- meaningful whitespace;
- open surfaces;
- execution density where useful;
- object continuity;
- evidence visualization;
- semantic state treatment;
- contextual inspectors;
- motion tied to state transitions;
- touch target quality;
- focus visibility.

### 19.3 Container model

Default surface model:

- open canvas;
- list / timeline;
- rail;
- inspector;
- sheet;
- modal only for blocking decisions;
- card only when an object genuinely benefits from bounded grouping.

## 20. Motion

Motion communicates state and continuity.

Allowed purposes:

- mode transition preserving active object position;
- generated component streaming / completion;
- execution node state change;
- object move into Space;
- inspector open/close;
- approval state transition;
- connection degradation / recovery.

Motion MUST respect `prefers-reduced-motion` and MUST NOT be required to understand state.

## 21. Accessibility

Minimum product requirements:

- WCAG 2.2 AA contrast;
- 44×44 CSS px minimum touch target for primary mobile interactions;
- full keyboard operation for Chat, Work, Space alternatives, command/search, approvals, and generated forms;
- accessible alternative to drag/drop in Space;
- semantic headings and landmarks;
- visible focus;
- status announcements for execution, connectivity, and approval changes without excessive live-region noise;
- generated components inherit the same accessibility contract as hand-authored components;
- invalid generated components never render inaccessible raw fallback markup.

## 22. Responsive behavior

### 22.1 Mobile

- single primary content region;
- contextual information opens as sheets;
- composer remains reachable with on-screen keyboard;
- mode controls remain visible but compact;
- approval actions stay above browser chrome / safe-area insets;
- execution trees use progressive disclosure;
- tables switch to horizontal scroll or purpose-built mobile representations without destroying semantics;
- no hover-dependent interactions.

### 22.2 Tablet

- optional inspector alongside primary surface;
- Space may expose object rail + canvas with inspector as sheet;
- composer remains stable.

### 22.3 Desktop

- side inspector and object rail available where useful;
- no forced three-column layout when information density does not justify it;
- generated components may expand into detail surfaces while preserving current context.

## 23. Performance and streaming

### 23.1 Goals

- shell usable before generative components complete;
- text and structured GenUI stream progressively;
- parser work must not block typing or scrolling;
- large evidence sets use virtualization or progressive loading;
- Space rendering avoids full-canvas rerender for unrelated object updates;
- connectivity recovery reconciles changed objects rather than blindly reloading the entire workspace.

### 23.2 Streaming safety

Partially streamed GenUI is treated as incomplete until the parser identifies a valid renderable boundary. Consequential controls remain disabled until the complete component validates.

## 24. Observability

The redesign adds structured telemetry for product/runtime diagnosis without logging secrets or unrestricted user content.

Useful events include:

- mode change;
- active context change;
- generated component parse success/failure;
- component validation failure reason;
- component render latency;
- generated interaction class;
- authority resolution result;
- approval requested/approved/rejected;
- stale-state action block;
- reconnect / reconciliation duration;
- sandbox bridge rejection;
- accessibility fallback activation.

Telemetry distinguishes product failure from canonical upstream failure.

## 25. Error handling

### 25.1 Generated UI parse failure

Show a safe text or structured fallback and retain diagnostic metadata for developers. Do not expose parser internals to normal users.

### 25.2 Unknown component

Reject the component. Never interpret unknown names as HTML tags or commands.

### 25.3 Schema failure

Reject invalid props and optionally request regeneration. Previously valid surrounding output remains usable.

### 25.4 Authority unavailable

Keep the proposed action visible as blocked/read-only with a clear explanation. Do not silently downgrade to a different operation.

### 25.5 Canonical owner unavailable

Show last-known data only when allowed, with freshness. Prevent writes requiring live state.

### 25.6 Reconciliation conflict

Prefer canonical state. Preserve the user's draft or proposal separately when useful; do not overwrite canonical state from a stale projection.

## 26. Security model

Threats explicitly covered by this design:

- prompt-driven generation of privileged-looking controls;
- generated component spoofing;
- schema injection;
- sandbox escape attempts;
- unauthorized endpoint calls from generated code;
- stale-state destructive writes;
- UI claiming success before canonical confirmation;
- capability widening through generated parameters;
- hidden actions attached to benign controls;
- cross-context object reference confusion;
- persisted malicious generated surface replay.

Mitigations:

- finite registry;
- strict schemas;
- normalized interaction bus;
- server-side authority checks;
- context-bound object references;
- explicit interaction classes;
- CSP / iframe sandbox for open-ended artifacts;
- versioned persisted GenUI;
- fail-closed unknowns;
- canonical reconciliation.

## 27. Implementation decomposition

This specification is intentionally one product architecture, but implementation is split into independently verifiable workstreams to reduce collision risk.

### Workstream A — Shell and Active Context

Delivers:

- unified shell;
- active context model;
- mode continuity;
- compact connectivity/status;
- mobile sheets foundation;
- shared composer placement.

### Workstream B — Chat + Governed GenUI Core

Delivers:

- parser adapter boundary;
- component registry;
- safe renderer;
- initial read-only components;
- thread persistence model;
- Chat durable-object embedding.

### Workstream C — Interaction + Composer + Command

Delivers:

- normalized generated interaction envelopes;
- intent preview;
- capability / authority handoff;
- command/search intent resolution;
- generated forms and command-class components.

### Workstream D — Work Execution Experience

Delivers:

- execution trajectory;
- node inspector;
- evidence/artifact/decision integration;
- meaningful progress semantics;
- mobile progressive disclosure.

### Workstream E — Space Composition Experience

Delivers:

- open spatial canvas;
- object rail;
- inspector;
- mobile sheets;
- generated layout proposals;
- reversible/persistent layout updates.

### Workstream F — Needs You + Freshness + Release Hardening

Delivers:

- upgraded approvals;
- object-level freshness;
- action gating;
- degraded/reconnect behavior;
- accessibility verification;
- performance verification;
- security verification;
- browser/mobile visual QA;
- release evidence.

No workstream may redefine another workstream's public contract without updating this specification and the implementation plan that consumes it.

## 28. Testing strategy

### 28.1 Contract tests

Verify:

- Active Context identity survives mode changes;
- registry rejects unknown components;
- schemas reject invalid generated props;
- interaction class cannot be escalated by component props;
- generated actions use the normalized interaction bus;
- consequential actions require authoritative confirmation;
- stale state blocks writes when freshness policy requires current state;
- generated object refs cannot escape context/tenant scope;
- persisted component version handling is deterministic.

### 28.2 Unit tests

Cover:

- parser adapter;
- registry lookup;
- schema validation;
- component prompt/export generation;
- freshness calculation;
- progress semantics;
- context transitions;
- interaction normalization;
- sandbox bridge validation.

### 28.3 Integration tests

Cover:

- Chat → create mission → Work;
- Work → inspect evidence → Space;
- Space → select artifact → Chat context;
- generated form → draft action;
- generated consequential action → approval → canonical response → reconciliation;
- disconnect → stale object → blocked action → reconnect → successful resync;
- generated component stream interrupted mid-response;
- invalid model output recovery.

### 28.4 Browser tests

Desktop + current mobile target must cover:

- Chat conversation with generated components;
- Work execution tree and inspector;
- Space rail/canvas/inspector;
- command/search;
- Needs You approval;
- keyboard navigation;
- mobile sheets;
- on-screen keyboard/composer interaction;
- offline/degraded state;
- reduced motion.

### 28.5 Visual fidelity tests

Before implementation, produce approved design concepts for:

1. Chat default + active mission
2. Chat generated evidence/action response
3. Work running mission
4. Work inspector
5. Space desktop
6. Space mobile
7. Command/search intent result
8. Needs You approval
9. Degraded connectivity
10. Mobile composer + sheets

Implementation screenshots must be compared to those accepted concepts at representative desktop and mobile dimensions.

## 29. Release acceptance criteria

The upgrade is releasable only when all of the following are true:

1. Chat, Work, and Space share one Active Context and preserve canonical object identity across mode changes.
2. Work exposes a useful execution trajectory with inspectable evidence and current activity.
3. Space has a genuine mobile interaction model rather than compressed desktop panels.
4. The global persistent connection-interrupted overlay is replaced by compact global state plus object-level freshness.
5. Command/search accepts natural intent and can preview resolved actions.
6. Generated UI only renders registered Aftergraph components in trusted surfaces.
7. Unknown or malformed generated UI fails closed.
8. Consequential generated controls cannot bypass capability, authority, policy, or approval checks.
9. Sandboxed open-ended HTML has no implicit privileged bridge.
10. Generated component persistence is versioned and deterministic.
11. Accessibility gates pass for hand-authored and generated components.
12. Mobile touch targets and safe-area behavior pass.
13. Reduced motion behavior passes.
14. Browser flows pass on desktop and mobile viewports.
15. Existing canonical backend/federation invariants remain green.
16. No public product claim describes reference/mock behavior as live canonical execution.
17. Visual implementation matches approved concepts without unresolved material drift.
18. Release evidence records the exact tested commit.

## 30. Explicit non-goals

This upgrade does not:

- migrate Studio to React solely for OpenUI;
- make OpenUI the visible Aftergraph design system;
- allow arbitrary model-generated DOM in trusted product surfaces;
- merge canonical repositories or services into Studio;
- replace Trust Gateway, WORKS, AIE, governance, or other canonical authorities;
- invent a new top-level mode beyond Chat, Work, and Space;
- remove specialist apps before parity and rollback gates exist;
- guarantee that every user prompt becomes generated UI;
- generate UI when normal text or an existing deterministic component is simpler;
- turn sandboxed generated artifacts into privileged runtime extensions.

## 31. Decisions locked by this specification

1. **Direction:** Living Workspace + Governed Generative UI.
2. **Primary modes:** Chat / Work / Space remain.
3. **Continuity primitive:** Active Context.
4. **GenUI ownership:** Aftergraph component registry and interaction semantics.
5. **OpenUI role:** architecture and optional framework-agnostic parser/prompt-generation dependency behind an adapter; not brand or authority.
6. **Frontend migration:** no React rewrite required.
7. **Trusted rendering:** finite registered components only.
8. **Open-ended HTML:** sandboxed artifact/prototype class only.
9. **Writes:** normalized interaction bus → capability → authority → policy → approval → canonical write → evidence → reconciliation.
10. **Freshness:** object-level plus compact global state.
11. **Mobile:** sheets/progressive disclosure, not compressed desktop.
12. **Visual direction:** fewer containers, stronger hierarchy, more execution/evidence density where it serves the task.

## 32. External technical references

OpenUI sources reviewed for this design:

- `https://github.com/thesysdev/openui` — renderer-agnostic OpenUI Lang architecture, component-library prompt generation, streaming model, package boundaries.
- `https://github.com/thesysdev/openui/blob/main/docs/content/docs/agent/core-concepts/generative-ui.mdx` — generative UI, interactivity, GenUI vs artifacts, open-ended HTML.
- `https://github.com/thesysdev/openui/blob/main/docs/content/docs/openui-cloud/how-it-works.mdx` — validation boundary between model output and renderable UI.

The external architecture is an input, not the source of truth. Aftergraph's existing V6 contracts, Brand OS, authority model, evidence model, and repository ownership remain authoritative for Studio.
