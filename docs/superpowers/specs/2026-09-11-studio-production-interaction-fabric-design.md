# Aftergraph Studio Production Interaction Fabric

**Date:** 2026-09-11
**Status:** Approved for implementation planning; code changes not started
**Repository:** `Aftergraph/studio`
**Design baseline:** `390ef650ca9a807c8f03dafbe0757a82fbccc763` (`origin/main`)
**Governance baseline:** `1689e32ef124e595d3e71e960932093e0412194e` (`Aftergraph/after-graph-governance`, Platform Architecture V4)

## 1. Decision

Aftergraph Studio becomes the production Interaction Fabric and primary human-facing environment for the Aftergraph platform.

Conversation is the front door. Canonical truth and authority stay with their existing owners.

Studio presents a simple Chat / Work / Space product while composing Runtime, Trust Gateway, AIE, WORKS, Relay, Sentinel, ACC, skills, models, connectors, and specialist systems behind typed contracts.

Relay does not become a second general-purpose chat product. Relay remains the governed operator substrate for live terminals, machines, sessions, host verification, and fleet operations, surfaced contextually inside Studio.

This is a convergence program, not a demo, reference-only MVP, or isolated frontend redesign.

### 1.1 Relationship to existing Studio designs

This spec productionizes the Chat / Work / Space direction already established by Workspace v3, Calm Intelligence, V5 and V6. It does not create a second product architecture. Where older Studio documents model reference-local copies of upstream domains, this spec narrows those copies into experience-owned records or typed canonical references under V4 ownership.

### 1.2 Alternatives considered

**A. Relay-centered conversational product — rejected.** Relay would gain threads, general chat, artifacts, Projects, and agent orchestration. This duplicates the V4 Experience plane and splits human state across Studio and Relay.

**B. Keep Studio as a reference UI and bolt direct service calls onto it — rejected.** This is fast for demos but leaves persistence, causal identity, compatibility, reconnect, tenancy, and failure semantics fragmented across ad-hoc adapters.

**C. Studio Production Interaction Fabric — selected.** Studio owns the durable experience lineage and presentation contracts while canonical services retain domain truth. Runtime, Trust Gateway, WORKS, Relay and Sentinel integrate through versioned adapters with explicit degraded behavior.

A physical monolith that merges the platform repositories was also rejected: deployment convenience does not justify collapsing semantic ownership.

## 2. Why this program exists

The organization already contains most of the required semantics, but they are split across repositories and several current Studio integrations are reference-contract or projection implementations rather than production service composition.

Building another conversation runtime inside Relay would duplicate Experience ownership, fragment thread state, and create competing artifact, approval, and agent models.

The program therefore converts Studio from a verified reference experience into the production composition layer while preserving the seven-plane V4 ownership model.

## 3. User promise

A user can start with natural language and remain in one conversational workspace while Aftergraph plans, delegates, executes, asks for human judgment when required, presents artifacts, survives interruption, and returns evidence-backed outcomes.

The ordinary interaction should resemble the best parts of modern conversational products: low chrome at rest, persistent projects and recents, a powerful composer, streaming work, contextual artifacts, and deeper control only when the work requires it.

Aftergraph differs by making authority, durable execution, intervention, provenance, and independent verification real platform semantics rather than decorative UI states.

## 4. Canonical ownership

The Interaction Fabric composes existing owners. Studio must not become a shadow implementation of their truth.

| Concern | Canonical owner | Studio role |
| --- | --- | --- |
| Experience, Chat / Work / Space | `studio` | Primary product surface and durable experience references |
| Observations to WorkItems | `wi-backend` | Typed projections and review surfaces |
| Authority semantics | `aie` | Display and reference authority state |
| Tenant binding and approvals | `trust-gateway` | Present governed requests and results |
| Agent lifecycle and orchestration | `runtime` | Start and observe typed runs |
| Durable execution and evidence | `works-execution` | Present Work and evidence references |
| Operator sessions and hosts | `relay` | Present terminal, node, and operator-control surfaces |
| Independent verification | `sentinel` | Present exact-subject verdicts and freshness |
| Cross-runtime state transfer | `context-continuity` | Request and consume ACC capsules |
| Continuity verification | `continuum` | Present campaign evidence |
| Skill portability | `skill-abi` | Present compatibility and degradation |
| Skill evaluation research | `skillport` | Present bounded benchmark evidence |

### 4.1 Organization audit baseline

Governance topology `2.0` at `1689e32` registers 28 repositories. Only `studio`, `relay`, and `wi-frontend` are Experience-plane repositories. This program creates no new repository or plane.

Relevant support ownership remains outside Experience: `aftergraph-cron-fabric` is scheduled-observation fabric, `skills-vault` is capability supply, `skill-abi` is skill compatibility, `model-registry` is model lifecycle registry, `context-continuity` is continuity contract, and `continuum` is assurance. `autonomous-venture-company` remains a legacy migration source and receives no new canonical responsibility.

## 5. Product model

Studio keeps only three permanent human modes:

- **Chat** — conversation-first exploration, requests, questions, planning, and lightweight assistance.
- **Work** — outcome-first delegated work, long-running runs, artifacts, evidence, review, and verified completion.
- **Space** — composition-first work with multiple durable objects, agents, artifacts, evidence, and replay.

Projects and Unified Recents own continuity and navigation. Canonical platform domains remain contextual rather than becoming permanent navigation destinations.

The default screen must remain calm. Runtime, evidence, authority, and infrastructure detail expands only when it materially helps the current decision or task.

## 6. Core user journey

A user may write: `Continue Relay v0.9.1 and get it release-ready.`

Studio binds the turn to a Project and immutable tenant/session context, resolves relevant experience context, and classifies whether the turn is conversational-only or consequential platform work.

A conversational-only turn may use Runtime-backed model/tool computation without being represented as durable or independently verified work. Consequential platform work preserves the V4 lifecycle and its applicable owners: Experience -> Intelligence/Authority -> Trust -> Runtime -> Execution -> Evidence -> Verification.

When durable execution is required, Runtime links the run to WORKS. When admission or human approval is required, Trust Gateway remains the canonical enforcement source. If host-level intervention is needed, a Relay artifact appears in the same conversation. If completion is claimed, independent verification is displayed separately from execution completion.

The user does not navigate through infrastructure in order to make this happen. Infrastructure remains inspectable and addressable through artifacts, search, commands, and advanced views.

## 7. Interaction Fabric contracts

This program reuses the V4/Wave G Interaction Fabric vocabulary instead of creating a competing conversation model. The canonical concepts are:

- `InteractionSurface` — surface adapter; Studio is the primary general-purpose experience owner.
- `InteractionThread` — continuity identity for interaction; Runtime owns orchestration/continuity semantics.
- `InteractionTurn` — Runtime-orchestrated turn record.
- `Presence` — experience/runtime projection, never identity or authority.
- `AssistantProfile` — Studio product/experience state, never an authority profile.
- `HandoffCheckpoint` — continuity presentation/correlation object; it never transports authority.

The existing `voice-interaction/0.1` contract and `VOICE-INTERACTION-V1` binding remain normative for the realtime voice edge. Studio implements the surface experience; Runtime owns disposable session/turn orchestration; Trust Gateway owns admission/egress; WORKS owns durable effects/evidence.

Studio adds only experience-owned production state that V4 explicitly permits: Projects, Unified Recents, layout, spatial/view state, surface presentation state, user display preferences, pinned canonical references, and local draft state.

Canonical upstream objects are referenced through the existing V6 object-envelope/integration model and V4 correlation substrate rather than copied into new Studio-owned `Run`, `Work`, `Approval`, or `Verification` truth types.

## 8. Causal identity

For consequential work, the platform must preserve a chain equivalent to:

```text
thread_id
  -> turn_id
  -> intent_id
  -> authority_ref
  -> admission_ref
  -> runtime_run_id
  -> work_id
  -> attempt_id
  -> effect_ref
  -> evidence_ref
  -> verification_ref
```

Not every turn creates every downstream object, but any object that exists must preserve correlation to the originating intent where the upstream contract permits it.

A mismatch in causal identity is not silently repaired in the UI. It is exposed as incomplete, stale, conflicted, or unverifiable composition.

## 9. Conversation behavior

Conversation is a reading surface first. Tool activity, plans, run detail, and platform internals collapse by default into concise work status and expand on demand.

Streaming supports partial assistant output, durable run events, reconnect/resync, and explicit recovery after client sleep or network interruption. Browser reconnect must not invent missed success states.
Threads support continuation across desktop, web, and mobile; explicit branching; turn retry with lineage; project moves where policy permits; archival state; and search over experience-owned content plus federated canonical references.

Message edits create a new branch/revision rather than rewriting provenance needed by already-started work.

## 10. Composer

The existing `packages/composer` becomes the single multimodal intent entry point rather than a collection of always-visible modes.

The production composer supports:

- natural-language input as the default;
- files, images, and other supported attachments;
- contextual mentions such as project, repository, agent, skill, service, artifact, or prior turn;
- optional model/provider choice when meaningful;
- voice through the existing Interaction Fabric voice-edge contract; transcript/speaker/session never confer permission or durable identity;
- slash commands as accelerators, not required syntax;
- explicit context inspection and removal before sending;
- capability discovery that remains separate from permission.

Ask / Research / Build / Create / Delegate / Automate become inferred or low-chrome capability hints rather than six permanent tabs competing with the conversation.
## 11. Runtime-backed work

Studio never simulates an agent run in order to make the interface feel alive. A live run shown to the user must resolve to Runtime state or be explicitly labelled as local draft/reference state.

Runtime owns agent lifecycle, orchestration, model/tool invocation, checkpoints, resource metering, team topology, and operational recovery hooks.

The Interaction Fabric consumes a typed stream such as:

```text
run.started
run.status_changed
agent.started
agent.status_changed
tool.started
tool.completed
artifact.available
decision.required
checkpoint.created
run.completed
run.failed
```

The exact event schema is versioned. Unknown consequential event versions fail closed rather than being interpreted heuristically.

Studio may summarize noisy events into a compact run line, while an expandable activity surface preserves useful observable detail without exposing private model chain-of-thought.
## 12. Durable work escalation

Not every chat request becomes a WORKS record. Runtime may satisfy bounded conversational work directly when durability, external effects, or recoverable execution do not require WORKS.

When durability is required, Runtime links the run to canonical WORKS objects. The user remains in the same thread while Studio projects durable progress, attempts, evidence, and settlement from WORKS.

The escalation decision is observable and testable. Studio never silently copies a Runtime task into a second local mission object and calls it equivalent to Work.

Existing Studio mission concepts must converge toward canonical references rather than becoming an independent durable execution engine.

## 13. Trust, tenancy, and decisions

The current tenant-bound workspace experience is retained and strengthened. Tenant binding comes from Trust Gateway and is immutable from Studio's experience layer.

Studio may own experience state inside that binding, but it cannot create grants, widen scopes, reinterpret approval state, or treat an old approval as current authority.

Decision surfaces are contextual to the conversation and Work surface. A decision reference contains the owning service identity, exact subject, risk/reversibility presentation data, freshness, expiry where applicable, and evidence links.
## 14. Relay convergence

Relay remains independently deployable because host control must survive Studio availability and because local/private environments need a narrow operational interface.

Studio consumes Relay through a versioned operator contract rather than copying Relay implementation.

Initial operator capabilities are represented as typed operations for:

- session attach and live output;
- session input and interruption;
- session lifecycle review;
- host/node inspection;
- process inspection and reviewed process actions;
- operator takeover and hand-back;
- bring-up and host-verification evidence;
- fleet availability and capability state.

Relay owns transport, host/session safety, PTY semantics, reconnect behavior, and local operator enforcement. Studio owns how these appear in Chat / Work / Space.

The existing Relay terminal, node, bring-up, diff/evidence, and mobile control work becomes a component/contract donor. Generic Relay dashboard, mission, and chat-like experience must not grow into competing Studio ownership.
## 15. Artifact system

Artifacts are durable typed views, not arbitrary model-generated HTML.

Studio owns the visible artifact vocabulary and trusted renderers. Canonical payload truth remains with the artifact's declared owner.

The base envelope includes:

```text
artifact_ref
artifact_type
schema_version
canonical_owner
canonical_subject
version_or_digest
freshness
provenance
render_data
actions[]
```

Initial production renderer families include text/document, code, diff, table, comparison, evidence, verification, work/run, timeline, terminal, node, approval/decision, incident/recovery, research, and visualization.

Actions are separately validated semantic commands. Artifact content cannot inject privileged JavaScript or create authority through presentation metadata.
## 16. Needs You and human intervention

`Needs You` becomes an Interaction Fabric projection, not an authority source and not a separate task engine.

Items are derived from canonical or explicitly classified sources such as approval requests, missing user input, blocked durable work, failed verification, host intervention, authentication recovery, budget decisions, and contested completion claims.

Each item answers:

1. Why is a human needed?
2. What happens if nothing is done?
3. What source owns the underlying state?
4. What evidence is relevant?
5. Which actions are currently valid?

The same item can appear inline in the originating thread and in the cross-project Needs You inbox. Resolving it in one place updates the projection everywhere through the canonical owner.

## 17. Context, memory, and continuity

Conversation history, memory, Runtime checkpoints, WORKS Brain, and ACC capsules remain distinct objects.
Runtime owns InteractionThread continuity, InteractionTurn records, and operational checkpoints for live agent execution. Studio holds experience projections/references needed to render those interactions and does not silently promote conversation into long-term memory.

WORKS owns Company Brain knowledge and durable execution evidence under its contracts. ACC owns portable actionable state transfer across runtime/model/session boundaries.

When a run moves across model, host, session, or runtime boundaries, Studio may request an ACC capsule and record the resulting handshake reference. A readable summary may accompany it, but the summary is not a substitute for the state-transfer contract.

## 18. Skills, models, providers, and capabilities

The composer may discover agents, skills, models, providers, and tools, but discovery never grants permission.

Skill compatibility is evaluated through SABI-compatible semantics where available. Runtime resolves executable bindings. Trust Gateway evaluates admission and policy. Model Registry supplies model identity/metadata. Skillport remains evaluation evidence rather than an execution authority.

The UI must distinguish at least:

```text
discovered
compatible
available
admitted
running
verified
```

No label such as `installed` or `available` may imply authority to execute.

### 18.1 Proactivity, schedules, and suggestions

Studio is the presentation and interaction surface for proactive suggestions, scheduled work, awaited-condition notifications, and recurring workflows; it is not a scheduler.

The V4 Proactivity/Capability fabrics are reused: sensing/schedule observations may come from `aftergraph-cron-fabric`, capabilities from `skills-vault`, Runtime decides/coordinates agent behavior, Trust Gateway enforces consequential admission, and WORKS owns durable execution where required.

A proactive item enters the same thread/Needs You model with explicit source, reason, freshness, and action semantics. Low-value activity may be grouped or suppressed by the owning proactivity logic rather than becoming notification spam.

Creating or changing a recurring workflow produces a governed canonical reference; Studio never implements a second cron database just because the composer accepts phrases such as `every Friday`.

## 19. Production experience state

Studio's current JSON workspace file remains useful reference evidence but is not the target persistence model for a public multi-device product.

The production Studio state layer is transactional, versioned, tenant-bound, migratable, and recoverable. It stores only V4-permitted experience state and canonical references, never Runtime-owned InteractionTurn/InteractionThread truth or copied truth from upstream planes.

The storage interface supports two deployment classes:

- **Local/private deployment:** SQLite with WAL, migrations, backups, and deterministic recovery.
- **Managed/multi-tenant deployment:** PostgreSQL-compatible transactional storage with the same logical contracts and tenant isolation.

Project/Recent/layout/surface-state writes use idempotency keys and optimistic version checks where concurrent clients can race. InteractionThread/InteractionTurn writes go through the Runtime-owned Interaction adapter.

Multi-device sync composes Runtime interaction continuity with versioned Studio experience events and canonical references. A reconnecting device receives ordered deltas or an explicit resync requirement; missing ranges are never silently skipped.

## 20. Authentication and device continuity

Studio relies on Trust Gateway-owned tenant/session binding for governed identity. Device continuity uses revocable, scoped sessions and does not place long-lived platform credentials into browser-readable storage.
Desktop, web, and mobile clients see the same tenant-bound threads and Work references subject to policy.

## 21. Realtime transport

Studio uses a transport-neutral event client with SSE or WebSocket adapters as appropriate. Transport is not the source of state truth.

Required behavior includes sequence identifiers, heartbeat, bounded buffering, reconnect with last-seen cursor, explicit resync when history is unavailable, duplicate suppression, and per-source freshness.
The UI distinguishes current, reconnecting, degraded upstream, offline cached state, incompatible contract, and stale projection.

A global green dot is insufficient when one platform owner is healthy and another is degraded.

## 22. Failure and degraded behavior

Every adapter defines timeout, retry, idempotency, freshness, compatibility, and degraded behavior. Missing upstream data is not replaced by fixture success in production.

Examples:

- Runtime unavailable: conversation remains readable; new delegated runs are unavailable or queued only when a governed durable path explicitly supports it.
- Trust Gateway unavailable: consequential operations fail closed while safe reading may continue.
- WORKS unavailable: Studio does not claim durable progress from local projections.
- Relay unavailable: host-control artifacts show unavailable without converting cached status into current status.
- Sentinel unavailable: completion may be displayed, but independent verification remains unavailable or stale.
- ACC handoff failure: continuation remains blocked when the receiving runtime requires the handshake.

Recovery actions explain what is safe to retry and what state may already have changed.
## 23. Desktop and mobile experience

Desktop keeps conversation as the primary reading column. Artifacts open contextually in a split surface, Work may expand into richer progress/evidence views, and Space handles composition-heavy tasks.

Mobile is not a compressed desktop dashboard. It prioritizes conversation, Needs You, compact work state, artifact full-screen presentation, and short operator interventions.

Normal navigation remains small: Chat / Work / Space with Projects, Recents, search, and settings available through platform-appropriate navigation.

Relay's terminal and process surfaces become focused full-screen or sheet presentations on mobile and richer split views on desktop.

All critical interactions support keyboard access where relevant, visible focus, semantic labels, reduced motion, sufficient touch targets, text scaling, and status semantics that do not rely on color alone.

## 24. Search and navigation

Unified Search spans experience-owned threads/projects and federated canonical references. Search results always disclose owner and freshness when the distinction matters.

Selecting an object opens the correct contextual surface without copying the object into Studio ownership.
## 25. Existing code convergence

The current Studio packages are evolved rather than discarded:

- `packages/composer` becomes the production intent composer.
- `packages/runtime-ui` becomes the deterministic contextual composition layer.
- `packages/presence` consumes real Runtime/Interaction presence references.
- `packages/interaction` expands from spatial commands into normalized experience commands without becoming an authority engine.
- `packages/ui`, `tokens`, `motion`, and `icons` remain the visible first-party design boundary.
- `packages/visualization` renders evidence, trajectory, replay, and verification projections.
- `packages/spatial` remains the Space composition substrate.
- `src/workspace/workspace-experience.mjs` remains tenant-bound and render-oriented.

Existing local reference domains are audited one by one. They are either retained as experience-owned state, converted into typed upstream references, or retired when they duplicate a canonical owner.

## 26. Non-goals

This program does not create a new architecture plane, a new authority engine, a new durable execution engine, a new long-term memory system, a second verification owner, or another general-purpose chat product in Relay.

It does not declare Studio production-ready merely because the reference build has browser tests or because an integration contract exists on disk.

It does not require a framework rewrite before the contracts and production seams are proven.
## 27. Public-product readiness

The architecture must support private/local use and a future managed multi-tenant product without changing semantic ownership.

Managed deployment adds account lifecycle, organization membership, entitlements, quotas, billing integration, regional deployment choices, operational SLOs, and support tooling as separate product concerns. Payment status may affect entitlements but never rewrites authority or verification truth.

The first public release must have documented retention, export, deletion, backup/restore, incident response, abuse controls, rate limits, privacy boundaries, and tenant isolation tests.

Provider credentials remain server-side and scoped. Bring-your-own-provider and Aftergraph-managed-provider modes share the same Runtime model identity and Trust admission contracts.

## 28. Testing strategy

Testing is organized by evidence class rather than one giant `PASS` label.

### Contract tests

Validate Thread/Turn/reference schemas, version compatibility, tenant binding, causal IDs, artifact envelopes, event envelopes, and adapter failure semantics.

### Adapter tests

Exercise real producer/consumer adapters for Runtime, Trust Gateway, WORKS, Relay, Sentinel, and ACC against their published contracts.
### Composition tests

Prove exact-head end-to-end journeys across repository boundaries, including causal identity from a Studio turn through Runtime and any downstream Work, decision, Relay operation, evidence, and verification references.

### Adversarial tests

Cover replay, stale approval, revoked session, tenant mismatch, duplicate event, reordered event, stale verification, Runtime restart, WORKS restart, Relay disconnect, browser reconnect, ACC mismatch, unknown schema version, provider outage, and partial upstream availability.

### Product behavior tests

Use real browser automation for conversation streaming, Project/Recent continuity, contextual artifacts, approval surfaces, terminal artifacts, mobile layouts, keyboard operation, reduced motion, and reconnect/resync.

Source-grep tests do not count as behavioral proof when executable behavior can be tested.

### Live characterization

Measure latency, reconnect time, stream lag, run-start latency, artifact-open latency, multi-device recovery, upstream error rates, cost accounting, and long-running reliability in real target environments.

## 29. Required end-to-end journeys

1. Ask a normal question and receive a streamed answer with project/thread persistence.
2. Start long-running Work, close the client, reconnect on another device, and continue from canonical state.
3. Run parallel agents and inspect compact activity plus detailed observable events.
4. Encounter a governed decision inline, resolve it through the canonical owner, and continue without duplicating authority state.
5. Open a Relay-backed terminal artifact, observe a real session, perform a reviewed operator intervention, and hand control back without leaving the thread.
6. Produce a durable artifact, reopen a previous version, and preserve provenance to its producing turn/run.
7. Complete work without verification and show that state honestly; then attach a Sentinel verdict and update only the verification projection.
8. Transfer an active matter across runtime/model/device boundaries with ACC handshake evidence and no silent authority widening.
9. Lose one upstream while the rest of Studio remains usable with accurate degraded semantics.
10. Revoke a device/session and prove subsequent use fails while canonical work remains intact.

## 30. Delivery program

This program is intentionally staged, but the target architecture is full-size from the start. A wave is not a reduced product definition; it is a reviewable integration boundary.

### Wave 0 — truth and ownership baseline

Freeze exact repository revisions used for the design, inventory existing Studio reference state, classify every overlapping object by canonical owner, and establish a drift report.

### Wave 1 — Interaction owner implementation + missing experience contracts

Implement the Studio-owned side of existing V4/Wave G Interaction contracts and inventory which existing V6 object-envelope/integration contracts can carry canonical references without reinterpretation. Add only missing experience-owned schemas such as Project/Recent/surface state, and register any new cross-plane semantic seam through Governance before implementation.

Exit gate: Governance ownership check + Studio L1 contract conformance with no duplicate InteractionThread/InteractionTurn owner.

### Wave 2 — production experience store

Replace JSON-only production assumptions with the transactional experience-state interface, SQLite implementation, migrations, idempotent writes, recovery, and sync cursor model. Preserve the JSON reference path only as explicit fixture/reference support.
### Wave 3 — Runtime Interaction adapter

Bind Studio turns to real Runtime runs, typed streaming events, presence, checkpoints, model/tool metadata, reconnect/resync, and compact activity UI.

Exit gate: L2 real adapter conformance and restart/reconnect behavior.

### Wave 4 — WORKS durable composition

Bind long-running and externally consequential work to canonical WORKS objects, attempts, evidence, and settlement. Remove or demote Studio state that duplicates durable execution truth.

Exit gate: exact-head Studio → Runtime → WORKS composition with causal identity preserved.

### Wave 5 — Trust/AIE decision composition

Bind tenant/session state, admission, approval, budgets, and authority references to their canonical owners. Convert Needs You into a cross-project projection over real decision sources.

Exit gate: revocation, expiry, stale-decision, and cross-tenant adversarial tests.

### Wave 6 — Relay operator composition

Publish a versioned Relay operator contract and render terminal, node, session, bring-up, and operator-review artifacts inside Studio. Retire generic Relay surfaces that duplicate Studio after parity is proven.

Exit gate: real Windows/VDS/iPhone journey with reconnect and operator hand-back evidence.
### Wave 7 — artifacts, capabilities, and continuity

Converge trusted artifact renderers, skill/model/provider discovery, SABI compatibility presentation, ACC handoff, versioned artifacts, search, citations, and project context.

Exit gate: multi-runtime continuation and artifact provenance survive model/device/runtime transitions.

### Wave 8 — verification and public hardening

Bind Sentinel exact-subject verification, run the V4 L3/L4 composition/adversarial ladder, characterize live reliability at L5 scope, complete managed-storage and tenant-isolation tests, and perform desktop/mobile accessibility and performance acceptance.

No public readiness claim is allowed from reference fixtures alone.

## 31. Migration and compatibility rules

- New production contracts use Aftergraph names; no new AVC canonical responsibility is created.
- Existing Studio APIs remain compatible until a migration adapter and consumer cutover are proven.
- Reference-only objects receive an explicit `reference`, `fixture`, or `projection` classification during migration.
- An old UI may remain available during rollback windows, but there is one canonical experience contract family.
- Relay remains independently operable even after Studio becomes the normal front door.
- Upstream service unavailability never causes Studio to assume ownership of the missing truth.

## 32. Definition of done

The program reaches its first production-complete cut only when all following conditions hold against exact recorded revisions.
1. A new user can create a Project, start a thread, send multimodal intent, and return later with durable lineage.
2. A delegated run is backed by real Runtime state and survives client reconnect.
3. Durable work references real WORKS state rather than a copied Studio mission truth.
4. Tenant binding and governed decisions resolve through Trust Gateway/AIE semantics.
5. Relay terminals and host control are usable contextually from Studio while Relay remains independently operable.
6. Completion and independent verification remain visibly and mechanically separate.
7. ACC-backed continuation can move active work across at least two runtime/model environments with handshake evidence.
8. Typed artifacts are schema/version validated and rendered only by trusted components.
9. Search/Recents/Projects do not leak cross-tenant state and preserve canonical ownership metadata.
10. Desktop and mobile support reconnect, offline/degraded semantics, keyboard/touch accessibility, and reduced motion.
11. Revocation, replay, stale state, incompatible versions, duplicate events, and partial outages are exercised adversarially.
12. Exact-head L3 composition evidence exists across the applicable V4 path from Studio Experience through Authority/Trust, Runtime, WORKS/Relay effects and evidence, and Sentinel verification.
13. L4 failure campaigns pass for the public critical paths.
14. L5 live characterization records reliability, latency, cost, reconnect, and operational limits without turning measurements into universal claims.
15. No active production path depends on reference fixtures while presenting them as live canonical services.

## 33. Product rule

Aftergraph should match leading conversational products in simplicity at rest, then exceed them when work becomes consequential.

The interface should not make users understand the seven planes before they can ask for an outcome. The platform must preserve those planes precisely so the user does not have to.

**Simple conversation above. Explicit truth, authority, execution, and verification below.**
