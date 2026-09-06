# Aftergraph V6 — Unified Intelligence Operating Environment

**Date:** 2026-09-06  
**Status:** Design approved in chat; written spec pending user review  
**Supersedes:** V5.2 Calm Intelligence as the target product architecture; V5.2 remains the migration baseline  
**Primary principle:** **Everything is available in one environment. Authority stays where it belongs.**

## 1. Purpose

Aftergraph V6 turns the current multi-repository Aftergraph ecosystem into one human-facing intelligence operating environment for intent, work, agents, research, capabilities, evidence, control, connections, outcomes, and system health.

V6 is **not** a code monolith and does not make one repository the canonical owner of all data. It is a federated product and runtime projection layer over independently governed engines and repositories.

The human should be able to start from a single conversation or workspace and move through research, planning, capability selection, approval, execution, verification, and outcome inspection without switching products or manually copying context between systems.

The canonical product statement is:

> **One workspace for intent, research, work, agents, capabilities, control, and verified outcomes.**

## 2. Scope

V6 integrates all currently identified Aftergraph organization repositories as first-class participants:

| Repository | V6 role | Canonical authority retained by repository/system |
| --- | --- | --- |
| `Aftergraph/trust-gateway` | Control, approvals, policy, audit, secrets, budgets, provider health | Runtime enforcement and approval truth |
| `Aftergraph/works-execution` | Durable Work, WorkGraph, trajectory, workers, evidence, settlement, Brain | Durable execution truth |
| `Aftergraph/work-intelligence-v2` | Observations, WorkItems, review, explicit promotion | Work Intelligence state and proposal truth |
| `Aftergraph/work-intelligence-web` | Surface donor for workspace connectors, review, activity, evidence graph | No canonical backend state; WI-v2 remains authoritative |
| `Aftergraph/aie` | Delegation, authority attenuation, lifecycle, revocation, conformance | Normative authority/delegation semantics |
| `Aftergraph/autonomous-venture-company` | Agents, Company Kernel, missions, Product Cells, incidents, evaluations, organizational memory | AVC company/runtime truth |
| `Aftergraph/skills-vault` | Curated skills and capability discovery | Vault-owned skill provenance; AVC-specific canonical skills remain AVC-owned |
| `Aftergraph/intelligence-systems-research` | Programs, studies, experiments, benchmarks, claims, replications, papers | Scientific claim/evidence/publication lineage |
| `Aftergraph/after-graph-governance` | Cross-repo terminology, contracts, evidence layers, compatibility, exact-head truth | Canonical cross-repo governance contracts |
| `Aftergraph/.github` | Organization front door, ecosystem metadata, brand assets | Organization presentation only; no runtime authority |

Future Aftergraph repositories MUST integrate through the same manifest and object contracts rather than requiring a new product architecture.

## 3. Non-goals

V6 does not:

1. physically merge all repositories into one source repository;
2. duplicate or replace TG, WORKS, AVC, AIE, WI, ISR, or Governance authority;
3. make research evidence equivalent to runtime evidence;
4. turn `WorkItem` into `WORKS Work`;
5. expose service credentials or repository tokens to browser code;
6. require a React/Vite rewrite of the V5.2 shell;
7. retire specialist applications until explicit parity and rollback gates pass;
8. allow an agent, skill, UI surface, or research artifact to grant itself authority;
9. infer success from UI state when the authority owner is unavailable;
10. silently substitute fixtures for failed canonical services.

## 4. Product model

### 4.1 Primary human modes

V6 keeps the V5.2 Calm Intelligence rule that the default product stays simple until complexity earns its place.

The persistent primary modes are:

- **Chat** — conversation and intent first;
- **Work** — mission, execution, artifact, and outcome first;
- **Space** — composition first.

The following are first-class domains but appear contextually through objects, command/search, inspectors, side sheets, or Space surfaces rather than as permanent top-level chrome:

- NOW
- Research
- Agents
- Brain
- Capabilities
- Control
- Connect
- Output
- System

### 4.2 NOW

NOW is the unified current-state projection. It answers four questions:

1. What is active?
2. What changed?
3. What needs the human?
4. What completed with evidence?

NOW may aggregate across systems, but every item displays its canonical owner and freshness state.

### 4.3 Universal search and command

A single search/command surface resolves objects across missions, Work, WorkItems, agents, research, claims, evidence, artifacts, decisions, incidents, capabilities, skills, providers, repositories, and connections.

Search results are projections. Selecting or acting on a result never changes its authority owner.

## 5. V6 Federation Kernel

The Federation Kernel is the new architectural center of V6. It is responsible for composition, identity mapping, capability discovery, projections, health, and compatibility. It is not an authority engine.

The kernel contains:

1. **Integration Registry**
2. **Unified Object Graph**
3. **Capability Registry**
4. **Surface Registry**
5. **Authority Graph**
6. **Evidence Graph**
7. **Federated Search Index**
8. **Event and State Reconciler**
9. **Composition Engine**
10. **Compatibility and Drift Monitor**

### 5.1 Integration manifest

Every integration MUST expose or be represented by a typed manifest equivalent to:

```ts
interface AGIntegrationManifest {
  schema: 'aftergraph.integration/v1'
  id: string
  repository: string
  integrationVersion: string
  repositoryRevision: string
  serviceVersion?: string

  roles: IntegrationRole[]
  objects: ObjectTypeDeclaration[]
  relations: RelationDeclaration[]
  capabilities: CapabilityDeclaration[]
  surfaces: SurfaceDeclaration[]
  events: EventDeclaration[]

  reads: EndpointDeclaration[]
  writes: EndpointDeclaration[]
  authority: AuthorityDeclaration[]
  evidence: EvidenceDeclaration[]
  health: HealthDeclaration

  degradedBehavior: DegradedBehavior
  compatibility: CompatibilityContract
}
```

The manifest MUST distinguish repository revision from running service version. A matching repository HEAD does not prove the deployed service is at that revision.

### 5.2 Manifest validation

Unknown manifest fields may be tolerated only when explicitly declared forward-compatible. Missing authority, degraded behavior, evidence ownership, or compatibility declarations are fail-closed validation errors.

An integration may be:

- `current`
- `stale`
- `degraded`
- `drifted`
- `unavailable`
- `incompatible`

`current` is the only state that may present fresh canonical projections.

## 6. Unified Object Graph

### 6.1 Global identity

V6 MUST NOT replace canonical IDs. It wraps them in globally unique projection IDs:

```text
<integration-id>:<object-type>:<canonical-id>
```

Examples:

```text
works:work:wrk_...
wi:work_item:wi_...
avc:mission:mis_...
isr:claim:C-017
tg:approval:apr_...
aie:delegation:del_...
```

### 6.2 Object envelope

Every projected object uses an envelope equivalent to:

```ts
interface AGObjectEnvelope<T> {
  graphId: string
  type: string
  canonicalId: string
  canonicalOwner: string
  sourceIntegration: string
  sourceRevision?: string

  status: string
  freshness: 'current' | 'stale' | 'degraded' | 'drifted'
  authority: AGAuthorityRef[]
  evidence: AGEvidenceRef[]
  relations: AGRelation[]

  observedAt: string
  updatedAt?: string
  payload: T
}
```

The envelope may add projection metadata but MUST NOT rewrite canonical payload semantics.

### 6.3 Core object types

V6 initially supports:

- Human
- Agent
- Team
- Mission
- Work
- WorkItem
- Task
- Approval
- Action
- Capability
- Skill
- ResearchProgram
- ResearchQuestion
- Hypothesis
- Study
- Experiment
- Benchmark
- Claim
- Replication
- Evidence
- Artifact
- Decision
- Incident
- ProductCell
- Memory
- Outcome
- Repository
- Service
- Provider
- Connection

Additional object types are registered through manifests.

### 6.4 Relation vocabulary

The first canonical relation vocabulary includes:

- `observed_from`
- `suggests`
- `promoted_to`
- `fulfills`
- `executes`
- `assigned_to`
- `requires`
- `authorized_by`
- `approved_by`
- `produces`
- `supported_by`
- `derived_from`
- `verifies`
- `contradicts`
- `supersedes`
- `belongs_to`
- `uses_capability`
- `uses_skill`
- `related_to`

Relations are directional and carry source/provenance. V6 MUST NOT infer irreversible semantic relations such as `verified_by` or `promoted_to` from visual adjacency.

## 7. Authority Graph

Authority is resolved independently from object discovery.

### 7.1 Rules

1. A projection never becomes authority.
2. An authority declaration names an owner and permitted operation class.
3. Every consequential write is routed to the authority owner.
4. No optimistic success is permitted for consequential writes.
5. Missing or unreachable authority fails visibly.
6. An agent cannot approve its own privileged action unless the canonical authority contract explicitly permits that case.
7. Cross-system delegation must preserve attenuation and revocation semantics.

### 7.2 Consequential write flow

```text
Human or agent intent
→ capability resolution
→ target object resolution
→ authority owner resolution
→ policy/risk classification
→ approval if required
→ canonical write
→ canonical response/evidence
→ projection reconciliation
→ UI success
```

The UI may show `pending`, `waiting`, `submitted`, or `resyncing` before canonical confirmation. It MUST NOT show `approved`, `executed`, `published`, `verified`, or equivalent success before authoritative confirmation.

## 8. Evidence Graph

V6 provides one evidence navigation experience while preserving evidence classes and provenance.

Each evidence reference includes:

```ts
interface AGEvidenceRef {
  id: string
  owner: string
  class: string
  provenance: string
  method?: string
  integrity?: string
  observedAt?: string
  verifiedAt?: string
  scope: string[]
}
```

The UI MUST visibly distinguish at least:

- runtime audit evidence;
- execution evidence;
- verifier evidence;
- conformance evidence;
- deterministic/simulated research evidence;
- live research evidence;
- methodological pilot evidence;
- external interoperability evidence;
- human review/approval evidence;
- publication evidence.

Evidence never changes class merely because it appears on another surface.

## 9. Research as a first-class domain

### 9.1 Research object model

ISR is projected into V6 as:

```text
Research Program
├── Questions
├── Hypotheses
├── Studies
│   ├── Protocols
│   ├── Amendments
│   ├── Runs
│   └── Results
├── Experiments
├── Benchmarks
├── Claims
├── Evidence
├── Replications
├── Papers
└── Publication / Promotion Gates
```

### 9.2 Research authority boundary

Research artifacts have scientific status and evidence provenance, but do not receive runtime authority by being displayed in V6.

A research result may create a `PromotionProposal` object. It may not directly invoke deployment or privileged runtime mutation unless a separate governed capability explicitly authorizes that operation.

Canonical flow:

```text
Research result
→ PromotionProposal
→ candidate specification / contract
→ Governance review
→ capability declaration
→ authority resolution
→ governed execution
→ runtime evidence
→ research feedback / replication
```

### 9.3 Claim presentation

Every claim surface MUST show:

- claim status;
- evidence class;
- source study/experiment;
- replication status;
- scientific owner;
- runtime authority, normally `none`;
- known objections or limitations when present;
- related specifications and runtime objects.

A simulated finding MUST never be styled as a live production result.

## 10. AVC integration

AVC is projected as V6's company, agent, venture, and organizational-runtime engine.

First-class AVC surfaces include:

- Company state
- Humans and identities
- Agents and teams
- Missions
- Product Cells
- Goals and opportunities
- Budgets
- Incidents
- Evaluations
- Organizational memory
- Evidence and outcomes
- Runtime health

V6 may progressively absorb Mission Control UX patterns. AVC remains authoritative for AVC state and Company Kernel decisions.

The existing AVC distinction between owner intent, Kernel authorization, execution, independent verification, append-only evidence, and reconciled company state remains binding.

## 11. WORKS integration

WORKS remains the durable execution engine and owner of `Work`.

V6 surfaces:

- Work
- WorkGraph/DAG
- scheduler state
- worker assignments
- leases
- retry/recovery
- trajectory
- budget/resource use
- evidence
- settlement/quittance
- Company Brain objects and mounts

WORKS Brain content may be linked to AVC memory, research evidence, and governance decisions. Linking does not merge those stores or their promotion rules.

## 12. Work Intelligence and Connect

WI-v2 remains canonical for observations and WorkItems.

The V6 Connect domain absorbs the useful workspace-facing capabilities currently exposed by Work Intelligence Web:

- Gmail
- Drive
- Calendar
- Docs
- Sheets
- activity
- review queue
- evidence graph
- integration status

Google/provider credentials remain server-side or memory-scoped according to provider contract. Browser code never receives backend service bearer credentials.

Canonical promotion flow remains:

```text
Observation
→ WorkItem
→ human review
→ explicit promotion
→ WORKS Work
```

`WorkItem != WORKS Work` is a release invariant.

## 13. Trust Gateway integration

Trust Gateway provides V6 Control with:

- Needs You
- approvals
- policy decisions
- RBAC/identity projection
- budgets
- rate limits
- secrets status
- audit chain
- artifacts
- provider/model health
- governed skills
- kill/freeze controls where supported

V6 MUST preserve TG's fail-closed behavior. Unknown or destructive actions never become silently executable because they are initiated from V6.

## 14. AIE integration

AIE contributes portable authority and delegation semantics:

- delegation
- attenuation
- revocation
- task lifecycle
- budget semantics
- evidence semantics
- interoperability/conformance status

AIE conformance evidence is displayed as AIE evidence and does not automatically establish scientific or runtime claims elsewhere.

V6 authority adapters MUST NOT invent an authentication contract AIE does not own.

## 15. Skills and Capability Graph

### 15.1 Capability object

Capabilities unify discoverability without unifying authority.

```ts
interface AGCapabilityDescriptor {
  id: string
  owner: string
  source: string
  version: string
  description: string
  compatibleSubjects: string[]
  tools: string[]
  inputs: string[]
  outputs: string[]
  requiredAuthority: string[]
  riskClass: string
  evidenceRequirements: string[]
  costModel?: string
  availability: 'available' | 'degraded' | 'unavailable'
}
```

### 15.2 Source rules

- AVC-specific canonical skills remain AVC-owned.
- Curated generic skills remain Skills Vault-owned.
- TG governed skills remain TG-owned runtime capabilities.
- V6 may index and compose them but MUST display owner/version/source.
- A capability version drift invalidates cached compatibility until revalidated.

### 15.3 Composer resolution

The universal composer may resolve a user goal into candidate capabilities and agents, but execution requires explicit authority resolution.

Example:

```text
"Research this and build a prototype"
→ research capability
→ source/repository access
→ relevant coding/research skills
→ candidate AVC/Hermes agent
→ WORKS execution plan
→ TG/AIE authority requirements
→ approval if required
→ execution
→ evidence
```

The composer may explain the proposed chain before execution.

## 16. Universal Space

Space is the environment where objects from different systems can coexist without losing identity.

A Space may contain:

- conversation;
- mission;
- Work/WorkGraph;
- research study or claim;
- Git/repository object;
- agent/team;
- evidence;
- approval;
- artifact;
- incident;
- capability graph;
- provider/connection status.

Every surface declares its canonical owner and freshness. Surface composition cannot imply authority inheritance.

Semantic zoom remains first-class. A zoom level may change representation detail but not object semantics.

## 17. Federated search

### 17.1 Index model

V6 maintains an incremental projection index of object metadata and searchable content allowed by source policy.

The index stores references, source revision, freshness, and permitted excerpts. It is not canonical object storage.

### 17.2 Search requirements

Search MUST support:

- type filters;
- owner/source filters;
- status/freshness filters;
- evidence class filters;
- time filters;
- relationship traversal;
- exact canonical ID lookup;
- command/action discovery.

Secrets and policy-prohibited content are never indexed.

## 18. Event and state reconciliation

### 18.1 Ownership

Backend/runtime systems own canonical data. The human owns navigation, focus, caret, local draft, inspector state, and explicit layout choices.

Background reconciliation may update data surfaces. It MUST NOT steal navigation, focus, caret, selection, scroll, composer draft, or Space selection.

### 18.2 Sync strategies

Each integration declares one of:

- push/event stream + authoritative refetch;
- polling + version check;
- repository revision polling;
- read-on-demand;
- static contract materialization.

Reconnect strategies MUST explicitly document lost-event handling. Where event replay is not durable, V6 performs authoritative refetch before returning to `current`.

### 18.3 Drift

A compatibility pin mismatch produces `drifted`, not `current`.

Consequential writes are disabled when the required integration is incompatible unless that integration explicitly declares a safe compatibility window.

## 19. Server architecture

V6 extends the V5.2 server composition model with a federation layer.

Conceptual modules:

```text
server/v6/
├── registry/
├── adapters/
├── projection-cache/
├── graph/
├── search/
├── capabilities/
├── authority/
├── evidence/
├── health/
└── routes/
```

Browser code talks to the V6 server/BFF. Integration credentials remain server-side.

Adapters are isolated. One failing integration cannot crash the shell or falsely mark other integrations stale.

## 20. Client architecture

Conceptual modules:

```text
src/v6/
├── federation/
├── object-graph/
├── capabilities/
├── authority/
├── evidence/
├── search/
├── composition/
├── research/
├── agents/
├── brain/
├── control/
├── connect/
├── system/
└── surfaces/
```

V6 continues V5.2's render-scope discipline. Background progress or health ticks use targeted patches. Structural changes render only the affected view/surface scope.

No framework migration is required for V6. The architecture must remain compatible with the existing local-first ESM shell unless a separate migration spec later proves a framework change is necessary.

## 21. System domain

System is the V6 operational truth surface for the federation itself.

It displays:

- registered integrations;
- repository revision;
- running service version;
- compatibility pin;
- health;
- drift;
- stale/degraded state;
- adapter errors;
- last successful sync;
- object counts;
- capability counts;
- event lag;
- write availability;
- evidence owner status.

System is primarily diagnostic. It does not become a bypass around Control or authority policies.

## 22. Error and degraded behavior

A federated product must remain useful when only part of the federation is healthy.

### 22.1 Required states

Every integration and projected object supports visible freshness/degradation state.

### 22.2 Failure rules

- read failure: preserve last-known projection as `stale` when policy permits;
- authentication failure: show `unauthorized`, do not substitute fixtures;
- compatibility drift: mark `drifted`, disable unsafe writes;
- authority owner unavailable: consequential write fails visibly;
- partial federation outage: unaffected domains continue;
- search source unavailable: results identify incomplete coverage;
- stale evidence: may remain visible with stale metadata; may not be represented as newly verified;
- research source unavailable: no claim status promotion;
- reconnect timeout: explicit degraded fallback, never unbounded spinner.

## 23. Security and privacy

1. Browser code receives no backend bearer tokens, GitHub tokens, provider secrets, or signing material.
2. Each adapter receives least-privilege credentials for its integration.
3. Secrets are never indexed by federated search.
4. Audit/provenance references preserve original owner and integrity metadata.
5. Cross-tenant object relationships are forbidden unless explicitly authorized by both source policy and V6 tenant policy.
6. Capability discovery does not imply capability grant.
7. Cached projections are partitioned by tenant/identity scope.
8. Exported Spaces and outputs preserve provenance labels.
9. Prompt or content injection from research/files cannot directly alter authority metadata or capability grants.
10. Unknown consequential actions fail closed.

## 24. Accessibility and interaction

V6 retains the V5.2 accessibility target of WCAG 2.2 AA.

Requirements include:

- keyboard-first navigation across universal search, objects, Space, inspectors, approvals, and research;
- semantic headings/landmarks;
- accessible graph/list alternatives for visual topology;
- reduced-motion parity;
- focus/caret preservation during background reconciliation;
- sheet/dialog focus trapping and restoration;
- no color-only evidence/freshness/risk encoding;
- minimum readable secondary text instead of dashboard microtype;
- mobile controls sized for touch.

Automated accessibility checks remain a release gate, not a documentation aspiration.

## 25. Performance budgets

V6 adds federation without relaxing the V5.2 interaction contract.

Release budgets:

- local interaction feedback p95: **<100 ms**;
- no full shell render for progress, presence, health, or simple freshness ticks;
- shell usable before all integrations have synchronized;
- federation sync is non-blocking and concurrency-limited;
- search local-index response p95: **<150 ms** for indexed metadata;
- initial active-view DOM budget: **<700 nodes** desktop outside intentionally expanded Space visualizations;
- mobile active-view DOM budget: **<500 nodes**;
- large lists/histories/graphs use virtualization or progressive loading;
- an unavailable integration must not extend another integration's request timeout;
- animation correctness is independent of animation completion.

Network latency of external services is reported separately from local UI latency.

## 26. Testing strategy

### 26.1 Contract tests

Every integration must pass:

- manifest schema validation;
- authority owner validation;
- evidence owner validation;
- object identity collision tests;
- relation vocabulary tests;
- degraded behavior tests;
- exact revision / compatibility drift tests;
- credential projection tests;
- consequential write fail-closed tests.

### 26.2 Cross-system invariant tests

Named release tests include:

1. `WorkItemNeverBecomesWorksWorkImplicitly`
2. `ResearchEvidenceNeverBecomesRuntimeAuthority`
3. `ProjectionNeverGrantsAuthority`
4. `FailedAuthorityWriteNeverShowsSuccess`
5. `BackgroundSyncNeverStealsHumanNavigation`
6. `BackgroundSyncPreservesComposerFocusCaretAndDraft`
7. `SourceRevisionDriftDisablesUnsafeWrites`
8. `StaleEvidenceNeverAppearsNewlyVerified`
9. `CapabilityDiscoveryNeverEqualsCapabilityGrant`
10. `CrossTenantRelationFailsClosed`
11. `MissingIntegrationLeavesUnaffectedDomainsOperational`
12. `SearchReportsIncompleteCoverageDuringOutage`

### 26.3 End-to-end journeys

V6 release verification must exercise at least:

**Journey A — Research to governed work**

```text
question → research object → evidence inspection → PromotionProposal
→ governance review → capability selection → authority resolution
→ WORKS execution → verifier evidence → outcome → research feedback
```

**Journey B — Work Intelligence to execution**

```text
provider observation → WorkItem → human review → explicit promotion
→ WORKS Work → progress → evidence → outcome
```

**Journey C — AVC agent execution**

```text
owner goal → AVC mission → agent/capability resolution
→ TG/AIE authority → WORKS execution → independent evidence
→ AVC reconciled company state
```

**Journey D — Failure and recovery**

```text
active execution → integration degradation → stale projection
→ Needs You / incident → pause/cancel/recover → evidence
→ authoritative resync
```

**Journey E — Partial federation**

With ISR unavailable, Chat/Work/Control remain operational; research coverage is visibly incomplete and no research status is synthesized.

### 26.4 Visual/browser tests

Browser verification covers:

- Chat/Work/Space default calm state;
- NOW;
- Research;
- Agents;
- Control;
- Connect;
- System;
- universal search;
- mobile shell;
- reduced motion;
- keyboard paths;
- focus/caret/scroll preservation;
- object surface continuity across modes;
- visual regression reference viewports.

## 27. Migration from V5.2

V6 is built on the V5.2 tree rather than replacing it wholesale.

Migration order:

1. preserve V5.2 behavior and release tests;
2. add integration manifest schema and registry;
3. move existing V5 adapters behind registry contracts;
4. introduce unified object envelope and graph IDs;
5. adapt TG, WORKS, WI, AIE, Governance and ISR existing integrations;
6. add AVC and Skills adapters;
7. add Work Intelligence Web surface migration adapters;
8. add capability and authority graph;
9. add evidence graph;
10. add research surfaces;
11. add agent/venture surfaces;
12. add federated search;
13. add NOW;
14. add universal composer resolution;
15. expand Space composition;
16. run parity and authority/evidence leak gates before retiring any specialist UX.

No specialist application is removed merely because a V6 surface exists. Retirement requires measured functional parity, rollback coverage, and owner approval.

## 28. Repository and package topology

The initial V6 implementation remains inside the current Aftergraph workspace application as the human-facing federation layer.

`packages/ui` remains an internal first-party package during the V6 wave. New V6 contracts may be organized as focused internal packages/modules, but no new repository is required simply to satisfy package aesthetics.

Canonical specialist code remains in its existing repository.

If a shared contract becomes consumed by multiple repositories, its canonical home is selected through `after-graph-governance` rather than copied ad hoc.

## 29. Source-of-truth hierarchy

When sources disagree, V6 resolves truth in this order:

1. canonical runtime/service response for live operational state;
2. canonical repository contract/specification for normative semantics;
3. `after-graph-governance` for cross-repository contract allocation and compatibility;
4. signed/hash-attested evidence for claims about outcomes;
5. V6 local projection/cache;
6. UI state.

UI state is never a higher source of truth than a canonical service or evidence owner.

## 30. Release gates

V6 cannot be called production-ready until all of the following are green from a clean artifact extraction:

1. V5.2 regression suite;
2. V6 manifest/registry contract suite;
3. object graph and identity suite;
4. authority leakage suite;
5. evidence provenance suite;
6. research/runtime boundary suite;
7. capability ownership suite;
8. adapter compatibility and exact-revision suite;
9. partial-federation/degraded suite;
10. cross-system E2E journeys A–E;
11. browser interaction regression;
12. accessibility automation;
13. performance budgets;
14. visual regression;
15. secret/credential projection scan;
16. clean ZIP extraction plus external SHA-256 verification.

A failed source integration may block only the capabilities whose canonical owner is unavailable unless the failed integration is itself required for a global security/authority invariant.

## 31. Absolute V6 invariants

These rules are release-blocking:

### Invariant 1 — Projection never becomes authority

A V6 object, surface, cache, search result, or composition can display and route authority but cannot create it.

### Invariant 2 — Evidence provenance never mutates through composition

Evidence class, owner, method, integrity metadata, and limitations survive every surface and relation.

### Invariant 3 — Integration failure never becomes synthetic success

No fixture, cache, animation, optimistic mutation, or inferred state may represent a failed canonical operation as successful.

### Invariant 4 — Human-owned interaction survives background intelligence

Navigation, focus, caret, selection, composer draft, scroll position, and explicit layout selection are not stolen by background state changes.

### Invariant 5 — Object identity is stable across surfaces

The same canonical object has one V6 graph identity regardless of where it is rendered.

### Invariant 6 — WorkItem is not Work

Promotion is explicit, policy-gated, attributable, and independently testable.

### Invariant 7 — Research result is not runtime permission

Scientific evidence may inform a promotion proposal; it does not authorize execution.

### Invariant 8 — Capability discovery is not capability grant

Availability in the registry does not imply that the current human or agent may use the capability.

## 32. Success criteria

V6 is successful when a human can remain inside one product and:

- ask a question;
- find relevant research and evidence;
- inspect claims and limitations;
- compose a mission;
- resolve candidate agents and capabilities;
- understand required authority and risk;
- approve or modify consequential work;
- observe execution and recovery;
- inspect independent evidence;
- receive a verified outcome;
- navigate the underlying source objects and repositories;
- continue working when non-critical parts of the federation are unavailable;

without losing the canonical boundaries that make those outcomes trustworthy.

## 33. Source inputs reviewed for this design

This design is grounded in the current Aftergraph repository boundaries inspected through GitHub on 2026-09-06, especially:

- `Aftergraph/.github/profile/README.md`
- `Aftergraph/trust-gateway/README.md`
- `Aftergraph/works-execution/README.md`
- `Aftergraph/aie/README.md`
- `Aftergraph/autonomous-venture-company/README.md`
- `Aftergraph/skills-vault/README.md`
- `Aftergraph/intelligence-systems-research/README.md`
- `Aftergraph/work-intelligence-web/README.md`
- existing V5.1/V5.2 integration contracts and source-truth material in this workspace.

The implementation phase must inspect exact current contracts and service endpoints again before writing adapters. README descriptions are architecture context, not substitutes for executable contracts.

## 34. Final architectural decision

Aftergraph V6 is a **Federated Unified Intelligence Operating Environment**.

All relevant Aftergraph capabilities, objects, research, workflows, controls, evidence, agents, connections, and system state become accessible in V6. Existing repositories remain canonical specialist engines and independently versioned authorities.

This is the chosen architecture for the V6 implementation plan.
