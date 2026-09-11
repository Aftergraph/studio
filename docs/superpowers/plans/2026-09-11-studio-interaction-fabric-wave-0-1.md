# Studio Interaction Fabric Wave 0-1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an exact ownership/drift baseline and implement Studio's production-safe side of the V4 Interaction Fabric without duplicating Runtime-owned interaction truth.

**Architecture:** Studio owns surface and experience state plus immutable references to canonical upstream objects. Runtime retains interaction thread/turn orchestration; Trust Gateway retains tenant/session admission; WORKS retains durable execution; Relay retains host/session operations. Existing Studio-local conversations remain a compatibility/reference path until the real Runtime Interaction adapter is delivered in Wave 3.

**Tech Stack:** Node.js 22+, native ESM, `node:test`, existing zero-dependency Studio runtime. Python 3 with Pillow + NumPy is required only by the existing visual parity test harness.

**Spec:** `docs/superpowers/specs/2026-09-11-studio-production-interaction-fabric-design.md`

## Global Constraints

- Platform Architecture V4 ownership is binding; create no new plane, repository, execution owner, memory owner, or verifier.
- Studio must not persist canonical InteractionThread or InteractionTurn truth.
- Tenant binding remains Trust Gateway-owned and immutable from Studio experience code.
- Studio-owned records may contain canonical references, never copied upstream truth.
- Existing local conversation writes remain compatibility/reference behavior and must identify themselves as `reference-local` and non-authoritative.
- No fake-online, synthetic-success, or automatic freshness upgrades.
- New pure data records are frozen at module boundaries.
- Every task follows RED -> minimum GREEN -> regression -> focused commit.
- Full verification uses an isolated Python environment with Pillow and NumPy, matching CI prerequisites.

---
### Task 1: Exact Ownership and Drift Audit

**Files:**
- Create: `src/interaction/ownership-audit.mjs`
- Create: `scripts/audit-interaction-convergence.mjs`
- Create: `tests/interaction-ownership-audit.test.mjs`
- Generate during verification: `evidence/interaction-fabric-v1/ownership-drift.json`

**Interfaces:**
- Consumes: Governance topology `2.0`, Governance `org-state/1.0`, and Studio `upstreams/UPSTREAM-MANIFEST.json`.
- Produces: `auditInteractionOwnership({ topology, orgState, reviewedManifest }) -> frozen report` with per-repository `current|drifted|unreviewed` state.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { auditInteractionOwnership } from '../src/interaction/ownership-audit.mjs';

test('audit detects reviewed-head drift without rewriting ownership', () => {
  const report = auditInteractionOwnership({
    topology:{repositories:[{name:'studio',architecture_plane:'experience',role:'primary-experience'},{name:'runtime',architecture_plane:'runtime',role:'agent-runtime'}]},
    orgState:{repositories:[{full_name:'Aftergraph/runtime',remote_head_sha:'new-runtime'}]},
    reviewedManifest:{repos:{runtime:{repo:'Aftergraph/runtime',head:'old-runtime'}}},
  });
  assert.equal(report.repositories.runtime.state,'drifted');
  assert.equal(report.repositories.runtime.owner,'agent-runtime');
});
```
- [ ] **Step 2: Run the test to prove RED**

Run: `node --test tests/interaction-ownership-audit.test.mjs`
Expected: FAIL because `src/interaction/ownership-audit.mjs` does not exist.

- [ ] **Step 3: Implement the minimum audit core**

```js
const freeze = value => Object.freeze(value);
export function auditInteractionOwnership({topology={},orgState={},reviewedManifest={}}={}) {
  const byName=new Map((topology.repositories||[]).map(r=>[r.name,r]));
  const live=new Map((orgState.repositories||[]).map(r=>[r.full_name?.split('/').at(-1),r]));
  const reviewed=new Map(Object.values(reviewedManifest.repos||{}).map(r=>[r.repo?.split('/').at(-1),r]));
  const repositories={};
  for(const [name,meta] of byName){
    const current=live.get(name); const prior=reviewed.get(name);
    const state=!prior?'unreviewed':!current?'unreviewed':prior.head===current.remote_head_sha?'current':'drifted';
    repositories[name]=freeze({owner:meta.role,plane:meta.architecture_plane??null,state,currentHead:current?.remote_head_sha??null,reviewedHead:prior?.head??null});
  }
  return freeze({schema:'aftergraph.interaction-ownership-audit/1.0',repositories:freeze(repositories)});
}
```

- [ ] **Step 4: GREEN plus Experience-plane invariant**

Add a second test asserting the Experience-plane set from topology is exactly `studio`, `relay`, `wi-frontend` for the production fixture and that the audit does not promote a reviewed manifest into current truth. Run the targeted test and expect PASS.

- [ ] **Step 5: Add the CLI wrapper**

The CLI accepts `--topology`, `--org-state`, `--reviewed-manifest`, `--out`, reads JSON, calls only `auditInteractionOwnership`, writes deterministic JSON, and exits nonzero only for malformed inputs, not for expected drift.

- [ ] **Step 6: Commit**

```bash
git add src/interaction/ownership-audit.mjs scripts/audit-interaction-convergence.mjs tests/interaction-ownership-audit.test.mjs
git commit -m "feat(studio): add interaction ownership drift audit"
```
### Task 2: Studio Interaction Ownership Boundary

**Files:**
- Create: `src/interaction/ownership-boundary.mjs`
- Create: `tests/interaction-ownership-boundary.test.mjs`

**Interfaces:**
- Consumes: V4/Wave G owner vocabulary from the spec.
- Produces: `INTERACTION_OWNERS`, `ownerForInteractionKind(kind)`, and `assertStudioMayOwn(kind)`.

- [ ] **Step 1: Write the failing boundary test**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import {ownerForInteractionKind,assertStudioMayOwn} from '../src/interaction/ownership-boundary.mjs';
test('Studio owns surfaces/profile presentation but not runtime turn truth',()=>{
  assert.equal(ownerForInteractionKind('InteractionSurface'),'studio');
  assert.equal(ownerForInteractionKind('AssistantProfile'),'studio');
  assert.equal(ownerForInteractionKind('InteractionThread'),'runtime');
  assert.equal(ownerForInteractionKind('InteractionTurn'),'runtime');
  assert.equal(ownerForInteractionKind('HandoffCheckpoint'),'runtime');
  assert.throws(()=>assertStudioMayOwn('InteractionTurn'),/runtime/i);
  assert.doesNotThrow(()=>assertStudioMayOwn('InteractionSurface'));
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/interaction-ownership-boundary.test.mjs`
Expected: FAIL on missing module.
- [ ] **Step 3: Implement the closed owner vocabulary**

```js
export const INTERACTION_OWNERS=Object.freeze({
  InteractionSurface:'studio', AssistantProfile:'studio', Presence:'runtime',
  InteractionThread:'runtime', InteractionTurn:'runtime', HandoffCheckpoint:'runtime',
  TenantBinding:'trust-gateway', DurableWork:'works-execution', Verification:'sentinel',
});
export const ownerForInteractionKind=kind=>INTERACTION_OWNERS[kind]??null;
export function assertStudioMayOwn(kind){
  const owner=ownerForInteractionKind(kind);
  if(owner!=='studio') throw new Error(`${kind} is owned by ${owner||'unknown'}, not studio`);
  return true;
}
```

- [ ] **Step 4: Add fail-closed tests**

Assert unknown kinds return `null`, and `assertStudioMayOwn('UnknownThing')` fails instead of assuming Studio ownership. Run targeted tests; expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interaction/ownership-boundary.mjs tests/interaction-ownership-boundary.test.mjs
git commit -m "feat(studio): encode interaction ownership boundary"
```

### Task 3: Typed Interaction Surface Projection

**Files:**
- Create: `src/interaction/interaction-projection.mjs`
- Create: `tests/interaction-projection.test.mjs`

**Interfaces:**
- Consumes: opaque Runtime/Trust/ACC references and Studio presentation metadata.
- Produces: `createInteractionSurfaceProjection(input)` returning an immutable Studio projection with no embedded upstream truth.
- [ ] **Step 1: Write the failing projection tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import {createInteractionSurfaceProjection} from '../src/interaction/interaction-projection.mjs';
test('projection carries refs and presentation only',()=>{
  const p=createInteractionSurfaceProjection({tenantId:'tenant:acme',surfaceRef:'studio:surface:chat:1',threadRef:'runtime:thread:1',turnRefs:['runtime:turn:1'],presenceRefs:['runtime:presence:a'],assistantProfile:{id:'friday',label:'Friday'},freshness:'current'});
  assert.equal(p.threadRef,'runtime:thread:1');
  assert.equal(p.canonicalOwner,'studio');
  assert.equal(p.authoritative,false);
  assert.ok(Object.isFrozen(p));
  assert.ok(!('thread' in p)); assert.ok(!('turns' in p)); assert.ok(!('authority' in p));
});
```

Add rejection tests for missing tenant/surface/thread refs, embedded `thread`, `turns`, `authority`, `execution`, `verification`, or a cross-tenant assistant profile.

- [ ] **Step 2: Run RED**

Run: `node --test tests/interaction-projection.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal immutable projection**

Use a closed input allowlist. Normalize ref arrays to frozen strings, validate `freshness` against `current|stale|degraded|unknown`, freeze `assistantProfile`, and emit `schema:'aftergraph.interaction-surface-projection/1.0'`, `canonicalOwner:'studio'`, `authoritative:false`.

- [ ] **Step 4: Run GREEN and mutation regression**

Prove caller arrays/objects can be mutated after creation without changing the projection, and prove unknown embedded truth fields fail closed. Expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/interaction/interaction-projection.mjs tests/interaction-projection.test.mjs
git commit -m "feat(studio): add typed interaction surface projection"
```
### Task 4: Bind Interaction Projection into Workspace Experience

**Files:**
- Modify: `src/workspace/workspace-experience.mjs:66-154`
- Modify: `tests/workspace-experience.test.mjs`

**Interfaces:**
- Consumes: `createInteractionSurfaceProjection()` output from Task 3.
- Produces: workspace experience objects with optional `interaction` projection, preserving the immutable tenant binding.

- [ ] **Step 1: Add failing workspace tests**

```js
test('workspace accepts same-tenant interaction projection without taking ownership',()=>{
  const interaction=createInteractionSurfaceProjection({tenantId:'tenant:acme',surfaceRef:'studio:surface:chat:1',threadRef:'runtime:thread:1',turnRefs:[],presenceRefs:[],assistantProfile:{id:'friday',label:'Friday'},freshness:'current'});
  const wx=createWorkspaceExperience({tenantBinding:binding('tenant:acme'),interaction});
  assert.equal(wx.interaction.threadRef,'runtime:thread:1');
  assert.equal(wx.interaction.authoritative,false);
});

test('workspace rejects cross-tenant interaction projection',()=>{
  const interaction=createInteractionSurfaceProjection({tenantId:'tenant:globex',surfaceRef:'studio:surface:chat:1',threadRef:'runtime:thread:1',turnRefs:[],presenceRefs:[],assistantProfile:{id:'friday',label:'Friday'},freshness:'current'});
  assert.throws(()=>createWorkspaceExperience({tenantBinding:binding('tenant:acme'),interaction}),/tenant/i);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/workspace-experience.test.mjs`
Expected: new assertions FAIL because `interaction` is not retained/validated.
- [ ] **Step 3: Extend the experience seam minimally**

Add optional `interaction = null` to `createWorkspaceExperience`, validate `interaction.tenantId === tenantBinding.tenantId`, return it unchanged as an immutable projection, and preserve it through `renderWorkspaceExperience` and updates unless an explicit same-tenant replacement is provided.

- [ ] **Step 4: Keep cross-tenant export safe**

Add a test proving `exportWorkspaceSnapshot()` omits the transient `interaction` projection by default and `importWorkspaceSnapshot()` never transports Runtime thread/turn references into the destination tenant. This is a deliberate continuity boundary, not data loss; ACC/Runtime handles cross-runtime continuation later.

- [ ] **Step 5: GREEN and regression**

Run:
`node --test tests/workspace-experience.test.mjs tests/interaction-projection.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workspace/workspace-experience.mjs tests/workspace-experience.test.mjs
git commit -m "feat(studio): bind interaction projection to workspace experience"
```

### Task 5: Project and Recent Experience Records

**Files:**
- Create: `src/workspace/project-recents.mjs`
- Create: `tests/project-recents.test.mjs`

**Interfaces:**
- Produces: `createProjectRecord(input)` and `createRecentEntry(input)` for Studio-owned navigation/continuity metadata only.
- Canonical object linkage is stored as typed `{owner,type,id,ref}` references, never copied payload truth.
- [ ] **Step 1: Write failing Project/Recent tests**

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import {createProjectRecord,createRecentEntry} from '../src/workspace/project-recents.mjs';
test('project stores experience metadata plus canonical refs only',()=>{
  const p=createProjectRecord({id:'project:relay',tenantId:'tenant:acme',name:'Relay',refs:[{owner:'runtime',type:'InteractionThread',id:'th_1',ref:'runtime:thread:th_1'}]});
  assert.equal(p.owner,'studio'); assert.equal(p.refs[0].owner,'runtime'); assert.ok(Object.isFrozen(p));
});
test('project rejects embedded canonical payload truth',()=>{
  assert.throws(()=>createProjectRecord({id:'p',tenantId:'tenant:acme',name:'x',refs:[],runtime:{status:'running'}}),/unsupported|embedded/i);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/project-recents.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement closed Studio-owned records**

Project fields: `schema,id,tenantId,name,description?,pinned,refs,createdAt,updatedAt,owner:'studio'`. Recent fields: `schema,id,tenantId,label,kind,targetRef,projectId?,updatedAt,owner:'studio'`. Reject unknown top-level fields and malformed/cross-tenant refs; freeze nested refs.

- [ ] **Step 4: Run GREEN and immutability tests**

Verify input mutation cannot modify stored refs and that no Project/Recent record can contain `authority`, `execution`, `verification`, `thread`, `turns`, or arbitrary canonical payload objects.

- [ ] **Step 5: Commit**

```bash
git add src/workspace/project-recents.mjs tests/project-recents.test.mjs
git commit -m "feat(studio): add project and recent experience records"
```
### Task 6: Classify the Legacy Local Conversation Path Honestly

**Files:**
- Modify: `src/state.mjs:11-100`
- Modify: `tests/state.test.mjs`
- Modify: `tests/fullstack-api-v4.test.mjs`

**Interfaces:**
- Consumes: existing local conversation API unchanged for compatibility.
- Produces: explicit interaction-source metadata proving local chat persistence is reference behavior, not Runtime-owned canonical interaction truth.

- [ ] **Step 1: Add failing classification tests**

```js
test('production state labels local interaction path non-authoritative',()=>{
  const state=createInitialState({fixtures:false});
  assert.deepEqual(state.interactionSource,{
    mode:'reference-local', authoritative:false,
    threadOwner:'runtime', turnOwner:'runtime',
  });
});
```

Extend the full-stack chat-write test to assert `write.body.state.interactionSource.authoritative === false` after local persistence and after restart.

- [ ] **Step 2: Run RED**

Run: `node --test tests/state.test.mjs tests/fullstack-api-v4.test.mjs`
Expected: FAIL because `interactionSource` is absent.

- [ ] **Step 3: Add only the classification metadata**

Add the frozen-shape-compatible plain object to `createInitialState()` for fixture and production-empty state. Do not rename routes, migrate records, invent Runtime IDs, or alter current compatibility behavior in this task.
- [ ] **Step 4: Prove the compatibility path cannot masquerade as Runtime truth**

Add assertions that local conversation objects do not gain `runtimeThread`, `runtimeTurn`, `admission`, or `verification` fields merely because a local write succeeded. A successful local file write remains local experience/reference evidence only.

- [ ] **Step 5: GREEN and regression**

Run:
`node --test tests/state.test.mjs tests/fullstack-api-v4.test.mjs tests/user-isolation.test.mjs tests/user-eviction.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/state.mjs tests/state.test.mjs tests/fullstack-api-v4.test.mjs
git commit -m "fix(studio): classify local conversations as reference state"
```

### Task 7: Wave 0-1 Evidence and Release Gate

**Files:**
- Generate: `evidence/interaction-fabric-v1/ownership-drift.json`
- Create: `evidence/interaction-fabric-v1/README.md`
- Modify only if required by exact new modules: `scripts/verify.mjs`

**Interfaces:**
- Consumes: all Task 1-6 outputs plus exact Governance topology/org-state checkout.
- Produces: exact-SHA evidence for the implemented slice; does not claim Runtime adapter, durable WORKS composition, Relay composition, or platform L3 conformance.

- [ ] **Step 1: Generate the ownership/drift report against real checkouts**

Run the new CLI with:
- topology: `/root/workspace/aftergraph/after-graph-governance/docs/platform-topology/2.0.json`
- org state: `/root/workspace/aftergraph/after-graph-governance/latest-org-state.json`
- reviewed manifest: `upstreams/UPSTREAM-MANIFEST.json`
- output: `evidence/interaction-fabric-v1/ownership-drift.json`

Expected: the report honestly shows reviewed-head drift for older materialized integrations rather than silently repinning them.
- [ ] **Step 2: Write evidence scope notes**

`README.md` records Studio commit SHA, Governance commit SHA, test commands, CI-equivalent Python prerequisites, generated audit schema, and explicit non-claims: no general Runtime Interaction adapter, no production database migration, no WORKS/Relay/Sentinel end-to-end composition, and no L3/L4/L5 platform claim.

- [ ] **Step 3: Run targeted tests**

```bash
node --test \
  tests/interaction-ownership-audit.test.mjs \
  tests/interaction-ownership-boundary.test.mjs \
  tests/interaction-projection.test.mjs \
  tests/workspace-experience.test.mjs \
  tests/project-recents.test.mjs \
  tests/state.test.mjs \
  tests/fullstack-api-v4.test.mjs
```

Expected: all PASS.

- [ ] **Step 4: Run the complete CI-equivalent verification**

```bash
PATH="/tmp/studio-baseline-venv/bin:$PATH" npm test
PATH="/tmp/studio-baseline-venv/bin:$PATH" npm run verify
```

Expected: zero failures. If `/tmp/studio-baseline-venv` is absent, recreate it with `uv venv --seed` and install only `pillow numpy`, matching the current CI visual-test prerequisites.

- [ ] **Step 5: Review the diff and evidence honesty**

Run `git diff --check`, search changed files for `TODO|TBD|FIXME`, confirm no new AVC identifiers, no copied upstream credentials, and no claims that local Studio interaction state is canonical Runtime truth.

- [ ] **Step 6: Commit the evidence close**

```bash
git add evidence/interaction-fabric-v1 scripts/verify.mjs
git commit -m "evidence(studio): close interaction fabric wave 0-1"
```

## Wave 0-1 Exit Gate

Wave 0-1 is complete only when ownership drift is measured rather than hidden; Studio's surface projection is tenant-bound and non-authoritative; Project/Recent records carry references rather than upstream payload truth; the local conversation path is explicitly reference-only; and the entire existing Studio suite plus verify gate remains green.

The next plan is Wave 2 only after this gate passes. Wave 2 productionizes Studio-owned experience persistence; it does not implement Runtime's missing general Interaction adapter. Wave 3 is a separate cross-repository Runtime/Studio adapter plan and requires the Runtime owner contract to exist first.
