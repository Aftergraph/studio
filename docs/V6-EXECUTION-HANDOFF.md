# AFTERGRAPH V6 — EXECUTION HANDOFF

**Mission:** Continue implementation of **Aftergraph V6 Unified Intelligence Operating Environment** from the existing local V5.2/V6 workspace. Do not restart, redesign, or create a competing prototype.

## Canonical source material

**Workspace**
`aftergraph-v5-integration/workspace-v5`

**Approved V6 design spec**
`docs/superpowers/specs/2026-09-06-aftergraph-v6-unified-intelligence-operating-environment-design.md`
SHA-256: `a585dacacbff313d1b9e8388be0d8e27cb70cdef936f109bb121505f8e7793f7`

**Approved implementation plan**
`docs/superpowers/plans/2026-09-06-aftergraph-v6-unified-intelligence-operating-environment.md`
SHA-256: `f6375f64db68d424fb7fa1db6cfdba1a15eebe851915cd589e51c056c0896afc`

The implementation plan contains **22 tasks** and is binding unless it conflicts with the approved V6 spec. In any conflict, the **spec wins**.

---

## Product objective

Build Aftergraph V6 as the **single human operating environment** for the full Aftergraph ecosystem:

`Chat · Work · Space`

with first-class contextual access to:

`NOW · RESEARCH · AGENTS · BRAIN · CAPABILITIES · CONTROL · CONNECT · OUTPUT · SYSTEM`

V6 must unify **objects, capabilities, surfaces, search, navigation and workflows**, but it MUST NOT merge canonical authority or evidence ownership.

Core law:

**Everything is available in one environment. Authority stays where it belongs.**

---

## Canonical repo ownership

**Trust Gateway**
Runtime enforcement, approval truth, policy, RBAC, secrets, audit, risk and consequential action authorization.

**WORKS**
Durable `Work`, WorkGraph, execution state, workers, leases, recovery, execution evidence, settlement and Company Brain.

**Work Intelligence V2**
Observation → WorkItem → review → explicit promotion.

`WorkItem != WORKS Work`

**Work Intelligence Web**
Projection/BFF and reusable Workspace surfaces only. It is NOT canonical WI state.

**AIE**
Portable institutional authority, delegation, lifecycle, revocation and conformance semantics.

**AVC**
Company Kernel, agents, Hermes, Product Cells, missions, incidents, evaluations, organizational runtime and evidence.

**Skills Vault**
Capability/skill discovery. Skill discovery MUST NOT imply authority grant.

**Intelligence Systems Research**
Research programs, studies, experiments, claims, evidence, replication, benchmarks and papers.

Research evidence MUST NOT become runtime authority.

**Aftergraph Governance**
Cross-repo contracts, terminology, evidence boundaries, exact-head state and compatibility truth.

---

## Absolute V6 invariants

Do not weaken these:

```text
ProjectionNeverBecomesAuthority
EvidenceProvenanceNeverMutatesThroughComposition
IntegrationFailureNeverProducesSyntheticSuccess
HumanInteractionSurvivesBackgroundIntelligence
ObjectIdentityIsStableAcrossSurfaces
WorkItemNeverBecomesWorksWorkImplicitly
ResearchEvidenceNeverBecomesRuntimeAuthority
CapabilityDiscoveryNeverEqualsCapabilityGrant
CrossTenantRelationFailsClosed
SourceRevisionDriftDisablesUnsafeWrites
StaleEvidenceNeverAppearsNewlyVerified
MissingIntegrationLeavesUnaffectedDomainsOperational
SearchReportsIncompleteCoverageDuringOutage
```

Background synchronization may update runtime projections.

It MUST NOT steal or overwrite:

```text
active navigation
conversation selection
active Space
composer draft
focus
caret
text selection
human scroll position
local inspector state
```

---

## Current execution state

V5.2 is the implementation base. Preserve it. Do not destroy or overwrite the existing V5.2 artifact/tree.

The known remaining V5.2 release blocker is the **real vendored axe-core accessibility dependency**.

Required dependency:

```text
axe-core 4.10.3
axe.min.js
expected size: 553446 bytes
SHA-256:
880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb
license: MPL-2.0
```

Container/network restrictions previously prevented clean materialization.

**DO NOT mark this gate green using a stub, fake axe object, CDN dependency, skipped test or handcrafted accessibility substitute.**

If the exact vendored asset remains unavailable, record Task 1 as `BLOCKED_EXTERNAL_DEPENDENCY` and continue only with tasks that are genuinely independent of that gate. Final V6 release remains blocked.

---

## Execution discipline

Follow RED → verify RED → GREEN → verify GREEN → refactor.

**No production feature without a failing test first.**

Do not merely add modules that are never wired into runtime behavior.

Every task requires:

```text
1. RED evidence
2. minimal GREEN implementation
3. focused test pass
4. affected regression suites
5. logical checkpoint
6. exact changed-file list
7. test command + measured result
8. commit SHA if git metadata exists
```

Never fabricate commits if this extracted workspace has no `.git`.

Never report PASS based on old logs.

---

## Agent topology

Use **isolated worktrees/branches whenever git is available**.

Do NOT let several agents edit shared foundation files concurrently.

### Agent A — Federation/Core

Own:
```text
integration manifest
integration registry
health/drift model
unified object identity
object graph
federation reconciliation
federation kernel
```
Does NOT own UX redesign.

### Agent B — Authority/Evidence

Start only after the core object identity/interfaces from Agent A are stable.

Own:
```text
Authority Graph
Evidence Graph
AIE projection
Governance projection
Trust Gateway authority mapping
provenance invariants
fail-closed write policy
```
Must never invent authority.

### Agent C — Capabilities/AVC

Start after Integration Manifest contract is stable.

Own:
```text
Capability Graph
Skills Vault adapters
AVC agents
Hermes workers
Product Cells
mission projections
agent evaluations
capability resolution
```
Discovery is read-only until authority explicitly permits execution.

### Agent D — Research/Work Intelligence

Own:
```text
ISR Research objects
Programs
Studies
Experiments
Claims
Replications
Papers
WI observations
WorkItems
Connect / Workspace projections
```
Enforce:
`Research result != runtime permission`
and:
`WorkItem != WORKS Work`

### Agent E — Product Surfaces

Start after the object/capability interfaces are frozen.

Own:
```text
NOW
Federated Search UI
Universal Composer
Universal Space
Research surfaces
Agent surfaces
capability surfaces
System federation view
mobile projections
```
UI must consume typed projections. It does not own canonical service state.

### Agent F — Verification/Release

May work on independent verification infrastructure immediately.

Own:
```text
axe vendoring/a11y gate
accessibility matrix
performance budgets
integration drift tests
cross-service E2E
degraded-mode tests
secret leakage checks
release manifest
artifact reproducibility
clean-extract verification
```
This agent does not waive failed gates.

---

## Collision rules

No two agents may edit the same file concurrently.

The following should be treated as **integration-lead owned** unless explicitly delegated:

```text
package.json
server.mjs
src/main.mjs
top-level integration registry barrel
top-level FederationKernel composition
release/version manifests
```

Specialist agents should create focused modules and tests instead.
Integration lead wires them after review.

If an agent needs a shared interface changed, return:

```text
INTERFACE_CHANGE_REQUEST
file:
current contract:
requested contract:
reason:
affected agents:
```

Do not silently change the shared contract.

---

## Integration Manifest target

Every Aftergraph participant must eventually project through a typed contract equivalent to:

```ts
interface AGIntegrationManifest {
  id: string
  repository: string
  version: string
  revision: string

  roles: IntegrationRole[]
  authority: AuthorityDeclaration[]
  capabilities: CapabilityDeclaration[]
  surfaces: SurfaceDeclaration[]

  objects: ObjectTypeDeclaration[]
  events: EventDeclaration[]

  reads: EndpointDeclaration[]
  writes: EndpointDeclaration[]

  evidence: EvidenceDeclaration[]
  health: HealthDeclaration

  degradedBehavior: DegradedBehavior
  compatibility: CompatibilityContract
}
```

Unknown/malformed manifests fail closed.
A repo missing from federation must degrade only its own capabilities, not take the entire workspace down.

---

## Unified object requirements

Canonical V6 object families include:

```text
Person
Agent
Mission
Work
WorkItem
Task
Approval
Action
Capability
Skill
ResearchProgram
Study
Experiment
Claim
Evidence
Artifact
Decision
Incident
ProductCell
Memory
Outcome
Repository
Service
```

Every projected object requires at least:

```text
id
type
source
canonicalOwner
sourceRevision
authority
evidence
relationships
status
timestamps
capabilities
provenance
```

Cross-system linking must create a **relationship**, never silently transform one object type into another.

Example:

```text
Observation
  → suggests
WorkItem
  → promoted_to
Work
  → fulfills
Mission
  → produces
Outcome
  → supported_by
Evidence
```

---

## Required critical journeys

Final E2E must prove at minimum:

```text
Journey A
Intent → capability discovery → authority evaluation →
approval → WORKS execution → evidence → verified outcome

Journey B
Workspace observation → WI WorkItem → human review →
explicit promotion → WORKS Work

Journey C
ISR claim → evidence inspection → promotion proposal →
governance review → NO automatic runtime authority

Journey D
AVC/Hermes mission → TG-controlled consequential action →
failure → visible failure with no synthetic local success

Journey E
Integration outage → partial federation →
unaffected domains remain operational →
search reports incomplete coverage →
stale evidence visibly remains stale
```

---

## Definition of done

Do NOT call this V6 complete until:

```text
all required unit tests pass
all federation contract tests pass
all authority/evidence invariant tests pass
all browser tests pass
accessibility gate passes with real axe-core
performance budgets pass
partial federation/degraded tests pass
cross-system E2E journeys A–E pass
exact-head compatibility is recorded
no browser-exposed secrets
no remote motion/runtime UI dependency
package version = 6.0.0
final ZIP has SHA-256
ZIP extracts cleanly
verification reruns from clean extracted ZIP
```

Final artifact target:
`Aftergraph-V6-Unified-Intelligence-Environment.zip`

---

## Reporting contract

Do not return “done”.

Return:

```text
TASK:
STATUS:
BASE/BRANCH:
FILES CHANGED:
RED COMMAND:
RED RESULT:
GREEN COMMAND:
GREEN RESULT:
REGRESSION COMMANDS:
REGRESSION RESULTS:
MEASUREMENTS:
AUTHORITY/EVIDENCE IMPACT:
OPEN RISKS:
COMMIT SHA:
NEXT SAFE DEPENDENCY:
```

If blocked, include:

```text
BLOCKER:
WHY IT IS REAL:
WHAT WAS TRIED:
SAFE WORK THAT CAN CONTINUE:
```
