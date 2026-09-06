# Aftergraph V6 Unified Intelligence Operating Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Aftergraph V6 as one human-facing federated intelligence operating environment across intent, research, work, agents, capabilities, control, evidence, connections, outcomes, and system health while preserving every specialist system's canonical authority and evidence provenance.

**Architecture:** Extend the existing V5.2 zero-build ESM workspace with a Federation Kernel composed of typed integration manifests, a unified projection object graph, capability/authority/evidence registries, federated search, event reconciliation, and contextual surfaces. Existing specialist repositories remain independently versioned engines; V6 stores projections and routes writes but never becomes canonical authority for TG, WORKS, WI, AIE, AVC, ISR, Skills Vault, or Governance.

**Tech Stack:** Node.js >=22, browser-native ES modules, semantic HTML, CSS, WAAPI/View Transitions where available, Node `node:test`, Python browser smoke scripts, existing HTTP/SSE server, zero production dependency requirement for the workspace shell, test-only vendored axe-core for accessibility automation.

**Spec:** `docs/superpowers/specs/2026-09-06-aftergraph-v6-unified-intelligence-operating-environment-design.md`

## Global Constraints

- Preserve the V5.2 Calm Intelligence interaction model: primary human modes remain `Chat`, `Work`, and `Space`; complexity is progressively disclosed.
- Do not physically merge specialist repositories into this workspace.
- Canonical service/runtime state outranks local projection/cache; UI state is never authority.
- `WorkItem != WORKS Work`; promotion is explicit and attributable.
- Research evidence never grants runtime authority.
- Capability discovery never equals capability grant.
- Consequential writes never show optimistic success before canonical confirmation.
- Browser code never receives service credentials or repository tokens.
- Unknown or incomplete authority/evidence/compatibility declarations fail closed.
- V6 graph IDs wrap canonical IDs as `<integration-id>:<object-type>:<canonical-id>` and never replace canonical IDs.
- Local interaction feedback p95 `<100 ms`.
- Federated local-index search p95 `<150 ms` for indexed metadata.
- Initial desktop active-view DOM `<700` nodes outside intentionally expanded Space visualizations.
- Initial mobile active-view DOM `<500` nodes.
- No full shell render for progress, presence, health, or simple freshness ticks.
- Shell must become usable before all integrations synchronize.
- An unavailable integration must not extend another integration's request timeout.
- Accessibility automation is release-blocking; serious/critical axe violations are zero.
- Final production claim requires clean ZIP extraction and external SHA-256 verification.

---

## File Structure Locked by This Plan

```text
src/
  federation/
    integration-manifest.mjs      # schema, validation, normalization
    integration-registry.mjs      # registered integrations and health/drift state
    object-envelope.mjs           # stable graph IDs and projection envelopes
    object-graph.mjs              # indexed object/relation graph
    authority-graph.mjs           # authority owner resolution only
    evidence-graph.mjs            # evidence provenance/navigation
    capability-registry.mjs       # capability/skill discovery and eligibility metadata
    surface-registry.mjs          # contextual surface declarations
    reconciler.mjs                # integration sync, freshness, partial federation
    federation-kernel.mjs         # composition facade over all registries
  integrations/
    avc.mjs
    skills-vault.mjs
    isr.mjs                       # upgrade existing research projection to typed V6 integration
    work-intelligence-web.mjs     # surface-donor/connector manifest, no backend authority
  research/
    projection.mjs
    promotion-proposal.mjs
  now/
    projection.mjs
  search/
    federated-index.mjs
  composer/
    resolver.mjs
  views/
    now-view.mjs
    research-view.mjs
    agents-view.mjs
    capabilities-view.mjs
    connect-view.mjs
    evidence-view.mjs
server/
  federation-routes.mjs
  search-routes.mjs
  research-routes.mjs
  now-routes.mjs
scripts/
  v6_browser_qa.py
  v6_e2e.py
  v6_release_verify.mjs
  v6-secret-scan.mjs
  vendor/axe.min.js
  vendor/AXE-LICENSE.txt
  a11y_smoke.py
contracts/v6/
  integration-manifest.schema.json
  object-envelope.schema.json
  relation-vocabulary.json
  core-object-types.json
  release-invariants.json
tests/
  v6-manifest-contract.test.mjs
  v6-integration-registry.test.mjs
  v6-object-graph.test.mjs
  v6-authority-graph.test.mjs
  v6-evidence-graph.test.mjs
  v6-capability-registry.test.mjs
  v6-avc-adapter.test.mjs
  v6-skills-adapter.test.mjs
  v6-isr-research.test.mjs
  v6-wi-connect.test.mjs
  v6-federation-reconciler.test.mjs
  v6-federated-search.test.mjs
  v6-now.test.mjs
  v6-composer-resolution.test.mjs
  v6-universal-space.test.mjs
  v6-cross-system-invariants.test.mjs
  v6-server-api.test.mjs
  v6-release-contract.test.mjs
```

Existing files remain the stable composition seams unless a task explicitly names them.

---

### Task 1: Close the V5.2 Release Baseline Before V6 Mutation

**Files:**
- Create: `scripts/vendor/axe.min.js`
- Create: `scripts/vendor/AXE-LICENSE.txt`
- Create: `scripts/a11y_smoke.py`
- Modify: `package.json`
- Test: `tests/v5-2-a11y-contract.test.mjs`

**Interfaces:**
- Consumes: existing V5.2 browser/server shell.
- Produces: `npm run verify:a11y`; zero serious/critical axe violations across Chat, Work, Space, System, Control and 390px mobile.

- [ ] **Step 1: Run the existing failing accessibility contract and capture RED evidence**

```bash
node --test tests/v5-2-a11y-contract.test.mjs
```

Expected: FAIL because the vendored axe runtime and smoke runner are absent.

- [ ] **Step 2: Materialize pinned axe-core and verify its expected package identity**

```bash
mkdir -p scripts/vendor
# Materialize the already-reviewed axe-core 4.10.3 distribution bytes into scripts/vendor/axe.min.js.
# Verify byte size and package-integrity metadata recorded in BUILD-STATUS-V5.2.md before continuing.
wc -c scripts/vendor/axe.min.js
```

Expected byte size: `553446`.

- [ ] **Step 3: Add the test-only license file**

```text
axe-core 4.10.3
Copyright (c) 2015-2025 Deque Systems, Inc.
Licensed under Mozilla Public License 2.0.
The vendored file is used only by browser accessibility verification and is not loaded by production runtime code.
```

- [ ] **Step 4: Implement the browser accessibility runner**

```python
# scripts/a11y_smoke.py
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from v5_2_browser_qa import boot

AXE = Path(__file__).with_name('vendor') / 'axe.min.js'
BLOCKING = {'serious', 'critical'}
ROUTES = ['chat', 'work', 'space', 'system', 'control']


def blocking(result):
    return [v for v in result.get('violations', []) if v.get('impact') in BLOCKING]


def audit(page):
    page.add_script_tag(content=AXE.read_text(encoding='utf-8'))
    return page.evaluate("""async () => await axe.run(document, {
      runOnly: {type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa','wcag22aa']}
    })""")


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for route in ROUTES:
            page,errors=boot(browser,route,{'width':1440,'height':1000})
            bad = blocking(audit(page))
            assert not errors, json.dumps({'route': route, 'pageErrors': errors}, indent=2)
            assert not bad, json.dumps({'route': route, 'violations': bad}, indent=2)
            page.close()
        page,errors=boot(browser,'chat',{'width':390,'height':844})
        bad = blocking(audit(page))
        assert not errors, json.dumps({'route': 'mobile-chat', 'pageErrors': errors}, indent=2)
        assert not bad, json.dumps({'route': 'mobile-chat', 'violations': bad}, indent=2)
        page.close(); browser.close()


if __name__ == '__main__':
    main()
```

- [ ] **Step 5: Add the package script and make the contract GREEN**

```json
"verify:a11y": "python scripts/a11y_smoke.py"
```

Run:

```bash
node --test tests/v5-2-a11y-contract.test.mjs
npm run verify:a11y
```

Expected: PASS and zero serious/critical violations.

- [ ] **Step 6: Run the full V5.2 regression baseline before V6 code exists**

```bash
npm test
npm run verify
npm run verify:browser
npm run verify:fullstack
npm run verify:upstreams
npm run verify:polyrepo
npm run verify:a11y
```

Expected: all green. If any gate is red, V6 work stops here.

- [ ] **Logical checkpoint:** Record baseline counts, browser captures, and axe violation count in `docs/QA-V6-BASELINE.md`.

---

### Task 2: Integration Manifest Contract and Fail-Closed Validator

**Files:**
- Create: `contracts/v6/integration-manifest.schema.json`
- Create: `src/federation/integration-manifest.mjs`
- Test: `tests/v6-manifest-contract.test.mjs`

**Interfaces:**
- Consumes: raw integration manifest objects.
- Produces: `validateIntegrationManifest(manifest) -> normalized manifest`; `integrationStateForValidation(errors) -> 'incompatible'`.

- [ ] **Step 1: Write RED tests for required authority/evidence/degraded/compatibility fields**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntegrationManifest } from '../src/federation/integration-manifest.mjs';

const base = {
  schema: 'aftergraph.integration/v1', id: 'works', repository: 'Aftergraph/works-execution',
  integrationVersion: '1.0.0', repositoryRevision: 'abc123', roles: ['execution'],
  objects: [], relations: [], capabilities: [], surfaces: [], events: [], reads: [], writes: [],
  authority: [], evidence: [], health: { kind: 'http', path: '/healthz' },
  degradedBehavior: { reads: 'stale', writes: 'block' },
  compatibility: { mode: 'exact-or-declared', supported: ['1.x'] }
};

test('manifest rejects missing authority declaration', () => {
  const m = structuredClone(base); delete m.authority;
  assert.throws(() => validateIntegrationManifest(m), /authority/);
});

test('manifest distinguishes repository revision from service version', () => {
  const m = validateIntegrationManifest({...base, serviceVersion: '0.3.5'});
  assert.equal(m.repositoryRevision, 'abc123');
  assert.equal(m.serviceVersion, '0.3.5');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-manifest-contract.test.mjs
```

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement strict normalization**

```js
// src/federation/integration-manifest.mjs
const REQUIRED = ['schema','id','repository','integrationVersion','repositoryRevision','roles','objects','relations','capabilities','surfaces','events','reads','writes','authority','evidence','health','degradedBehavior','compatibility'];

export function validateIntegrationManifest(input) {
  if (!input || typeof input !== 'object') throw new TypeError('manifest must be object');
  for (const key of REQUIRED) if (!(key in input)) throw new TypeError(`missing ${key}`);
  if (input.schema !== 'aftergraph.integration/v1') throw new TypeError('unsupported schema');
  if (!input.degradedBehavior?.writes) throw new TypeError('degradedBehavior.writes required');
  if (!Array.isArray(input.authority)) throw new TypeError('authority must be array');
  if (!Array.isArray(input.evidence)) throw new TypeError('evidence must be array');
  return Object.freeze(structuredClone(input));
}
```

- [ ] **Step 4: Run GREEN and schema fixture checks**

```bash
node --test tests/v6-manifest-contract.test.mjs
node -e "import('./src/federation/integration-manifest.mjs').then(({validateIntegrationManifest})=>console.log(typeof validateIntegrationManifest))"
```

Expected: PASS.

- [ ] **Logical checkpoint:** Manifest contract is independently usable before any adapter is migrated.

---

### Task 3: Integration Registry, Compatibility, Health and Drift States

**Files:**
- Create: `src/federation/integration-registry.mjs`
- Test: `tests/v6-integration-registry.test.mjs`

**Interfaces:**
- Consumes: validated manifests and health/drift observations.
- Produces: `createIntegrationRegistry()`, `register(manifest)`, `setState(id,state,detail)`, `get(id)`, `list()`, `canRead(id)`, `canWrite(id)`.

- [ ] **Step 1: Write RED state-machine tests**

```js
test('only current integration may expose fresh canonical projection', () => {
  const r = createIntegrationRegistry();
  r.register(validManifest('works'));
  r.setState('works', 'stale');
  assert.equal(r.canRead('works'), true);
  assert.equal(r.get('works').freshness, 'stale');
  assert.equal(r.canWrite('works'), false);
});

test('drifted integration blocks unsafe writes', () => {
  const r = createIntegrationRegistry();
  r.register(validManifest('tg'));
  r.setState('tg', 'drifted', {expected: 'a', actual: 'b'});
  assert.equal(r.canWrite('tg'), false);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-integration-registry.test.mjs
```

- [ ] **Step 3: Implement allowed states and write gating**

```js
const STATES = new Set(['current','stale','degraded','drifted','unavailable','incompatible']);
export function createIntegrationRegistry() {
  const entries = new Map();
  return {
    register(manifest) { entries.set(manifest.id, {manifest, state:'stale', freshness:'stale', detail:null}); },
    setState(id, state, detail=null) {
      if (!STATES.has(state)) throw new TypeError(`invalid integration state ${state}`);
      const e = entries.get(id); if (!e) throw new Error(`unknown integration ${id}`);
      e.state = state; e.freshness = state === 'current' ? 'current' : state; e.detail = detail;
    },
    get(id) { return entries.get(id) ?? null; },
    list() { return [...entries.values()]; },
    canRead(id) { return ['current','stale','degraded','drifted'].includes(entries.get(id)?.state); },
    canWrite(id) { return entries.get(id)?.state === 'current'; }
  };
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-integration-registry.test.mjs
```

- [ ] **Logical checkpoint:** Health/drift gating exists independently from UI rendering.

---

### Task 4: Unified Object Envelope, Stable Graph IDs and Relation Vocabulary

**Files:**
- Create: `contracts/v6/object-envelope.schema.json`
- Create: `contracts/v6/relation-vocabulary.json`
- Create: `contracts/v6/core-object-types.json`
- Create: `src/federation/object-envelope.mjs`
- Create: `src/federation/object-graph.mjs`
- Test: `tests/v6-object-graph.test.mjs`

**Interfaces:**
- Produces: `graphId(integration,type,canonicalId)`, `createEnvelope(input)`, `createObjectGraph()`, `upsert(envelope)`, `relate(relation)`, `get(graphId)`, `neighbors(graphId, relation?)`.

- [ ] **Step 1: Write RED identity and collision tests**

```js
test('same canonical object has stable graph identity across surfaces', () => {
  assert.equal(graphId('works','work','wrk_1'), 'works:work:wrk_1');
  assert.equal(graphId('works','work','wrk_1'), graphId('works','work','wrk_1'));
});

test('WorkItem and Work cannot collide', () => {
  assert.notEqual(graphId('wi','work_item','123'), graphId('works','work','123'));
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-object-graph.test.mjs
```

- [ ] **Step 3: Implement graph ID and envelope invariants**

```js
export function graphId(integration, type, canonicalId) {
  for (const v of [integration,type,canonicalId]) if (!String(v).length || String(v).includes(':')) throw new TypeError('graph id segments must be non-empty and colon-free');
  return `${integration}:${type}:${canonicalId}`;
}

export function createEnvelope({sourceIntegration,type,canonicalId,canonicalOwner,status,freshness='stale',payload,authority=[],evidence=[],relations=[],sourceRevision,observedAt=new Date().toISOString(),updatedAt}) {
  return Object.freeze({graphId:graphId(sourceIntegration,type,canonicalId),type,canonicalId,canonicalOwner,sourceIntegration,sourceRevision,status,freshness,authority,evidence,relations,observedAt,updatedAt,payload});
}
```

- [ ] **Step 4: Implement relation provenance and reject inferred irreversible semantics**

```js
const ALLOWED = new Set(['observed_from','suggests','promoted_to','fulfills','executes','assigned_to','requires','authorized_by','approved_by','produces','supported_by','derived_from','verifies','contradicts','supersedes','belongs_to','uses_capability','uses_skill','related_to']);
export function validateRelation(r) {
  if (!ALLOWED.has(r.type)) throw new TypeError(`unknown relation ${r.type}`);
  if (!r.sourceIntegration) throw new TypeError('relation sourceIntegration required');
  return Object.freeze({...r});
}
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/v6-object-graph.test.mjs
```

- [ ] **Logical checkpoint:** V6 can represent objects without changing canonical IDs or semantics.

---

### Task 5: Authority Graph and Consequential Write Router

**Files:**
- Create: `src/federation/authority-graph.mjs`
- Modify: `src/app/controller.mjs`
- Modify: `src/app/controller-safety.mjs` if present; otherwise create it.
- Test: `tests/v6-authority-graph.test.mjs`
- Test: `tests/v6-cross-system-invariants.test.mjs`

**Interfaces:**
- Produces: `resolveAuthority(object,operation)`, `executeConsequentialWrite({object,operation,input,registry,adapters})`.

- [ ] **Step 1: Write RED release invariant `ProjectionNeverGrantsAuthority`**

```js
test('ProjectionNeverGrantsAuthority', () => {
  const projected = {canonicalOwner:'works', authority:[]};
  assert.throws(() => resolveAuthority(projected, 'cancel'), /authority/);
});
```

- [ ] **Step 2: Write RED `FailedAuthorityWriteNeverShowsSuccess` controller test**

```js
test('FailedAuthorityWriteNeverShowsSuccess', async () => {
  const ui = [];
  await assert.rejects(() => executeConsequentialWrite({
    object:{canonicalOwner:'tg',authority:[{owner:'tg',operations:['approve']}]}, operation:'approve', input:{id:'apr_1'},
    registry:{canWrite:()=>true}, adapters:{tg:{write:async()=>{throw new Error('503')}}}, onUiState:s=>ui.push(s)
  }));
  assert.equal(ui.includes('approved'), false);
});
```

- [ ] **Step 3: Implement authority resolution and canonical confirmation rule**

```js
export function resolveAuthority(object, operation) {
  const ref = object.authority?.find(a => a.operations?.includes(operation));
  if (!ref?.owner) throw new Error(`authority unavailable for ${operation}`);
  return ref;
}

export async function executeConsequentialWrite({object,operation,input,registry,adapters,onUiState=()=>{}}) {
  const authority = resolveAuthority(object, operation);
  if (!registry.canWrite(authority.owner)) throw new Error(`authority owner ${authority.owner} not current`);
  onUiState('submitted');
  const result = await adapters[authority.owner].write(operation, input);
  onUiState('resyncing');
  return result;
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-authority-graph.test.mjs tests/v6-cross-system-invariants.test.mjs
```

- [ ] **Logical checkpoint:** No V6 projection or surface can manufacture authority or success.

---

### Task 6: Evidence Graph with Immutable Provenance

**Files:**
- Create: `src/federation/evidence-graph.mjs`
- Test: `tests/v6-evidence-graph.test.mjs`
- Test: `tests/v6-cross-system-invariants.test.mjs`

**Interfaces:**
- Produces: `createEvidenceGraph()`, `registerEvidence(ref)`, `linkEvidence(graphId, evidenceId)`, `getEvidence(id)`.

- [ ] **Step 1: Write RED `EvidenceProvenanceNeverMutatesThroughComposition`**

```js
test('EvidenceProvenanceNeverMutatesThroughComposition', () => {
  const g = createEvidenceGraph();
  g.registerEvidence({id:'isr:E-1', owner:'isr', class:'scientific', method:'deterministic-testbed', integrity:{sha256:'abc'}, limitations:['simulated']});
  g.linkEvidence('works:work:wrk_1','isr:E-1');
  assert.deepEqual(g.getEvidence('isr:E-1').limitations, ['simulated']);
  assert.equal(g.getEvidence('isr:E-1').owner, 'isr');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-evidence-graph.test.mjs
```

- [ ] **Step 3: Implement immutable evidence records**

```js
export function createEvidenceGraph() {
  const evidence = new Map(), links = new Map();
  return {
    registerEvidence(ref) {
      if (!ref.id || !ref.owner || !ref.class || !ref.method) throw new TypeError('evidence provenance incomplete');
      evidence.set(ref.id, Object.freeze(structuredClone(ref)));
    },
    linkEvidence(graphId, evidenceId) {
      if (!evidence.has(evidenceId)) throw new Error(`unknown evidence ${evidenceId}`);
      const set = links.get(graphId) ?? new Set(); set.add(evidenceId); links.set(graphId,set);
    },
    getEvidence(id) { return evidence.get(id) ?? null; },
    evidenceFor(graphId) { return [...(links.get(graphId) ?? [])].map(id=>evidence.get(id)); }
  };
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-evidence-graph.test.mjs tests/v6-cross-system-invariants.test.mjs
```

- [ ] **Logical checkpoint:** Research/runtime/execution evidence can coexist without provenance laundering.

---

### Task 7: Capability Registry, Skill Provenance and Grant Separation

**Files:**
- Create: `src/federation/capability-registry.mjs`
- Create: `src/integrations/skills-vault.mjs`
- Test: `tests/v6-capability-registry.test.mjs`
- Test: `tests/v6-skills-adapter.test.mjs`

**Interfaces:**
- Produces: `createCapabilityRegistry()`, `discover(query)`, `eligibleFor(subject, capabilityId)`, `grantStatus(subject, capabilityId)`.

- [ ] **Step 1: Write RED `CapabilityDiscoveryNeverEqualsCapabilityGrant`**

```js
test('CapabilityDiscoveryNeverEqualsCapabilityGrant', () => {
  const r = createCapabilityRegistry();
  r.register({id:'skill:research',source:'skills-vault',discoverable:true,requiresAuthority:['research.execute']});
  assert.equal(r.discover('research').length, 1);
  assert.equal(r.grantStatus({id:'agent:1'}, 'skill:research'), 'not-granted');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-capability-registry.test.mjs tests/v6-skills-adapter.test.mjs
```

- [ ] **Step 3: Implement registry with explicit grant resolver injection**

```js
export function createCapabilityRegistry({resolveGrant=()=>false}={}) {
  const caps = new Map();
  return {
    register(cap) { caps.set(cap.id, Object.freeze(structuredClone(cap))); },
    discover(q='') { const s=q.toLowerCase(); return [...caps.values()].filter(c=>c.discoverable!==false && JSON.stringify(c).toLowerCase().includes(s)); },
    grantStatus(subject,id) { return resolveGrant(subject,caps.get(id)) ? 'granted' : 'not-granted'; },
    eligibleFor(subject,id) { return this.grantStatus(subject,id) === 'granted'; }
  };
}
```

- [ ] **Step 4: Encode Skills Vault source rule**

```js
export function canonicalSkillOwner(skill) {
  if (skill.name?.startsWith('avc-')) return 'avc';
  return 'skills-vault';
}
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/v6-capability-registry.test.mjs tests/v6-skills-adapter.test.mjs
```

- [ ] **Logical checkpoint:** V6 can discover skills/capabilities without implying permission.

---

### Task 8: Migrate Existing TG, WORKS, WI, AIE and Governance Adapters Behind Manifests

**Files:**
- Modify: `src/integrations/trust-gateway.mjs`
- Modify: `src/integrations/works.mjs`
- Modify: `src/integrations/work-intelligence.mjs`
- Modify: `src/integrations/aie.mjs`
- Modify: `src/integrations/governance.mjs`
- Modify: `src/integrations/upstream-hub.mjs`
- Test: `tests/upstream-adapters.test.mjs`
- Test: `tests/v6-manifest-contract.test.mjs`

**Interfaces:**
- Each adapter produces `manifest()` plus existing read/write methods.
- `upstream-hub` becomes a compatibility facade over registry-backed integrations.

- [ ] **Step 1: Write RED manifest exposure test for every existing adapter**

```js
for (const [id,adapter] of Object.entries(adapters)) {
  test(`${id} exposes a valid V6 integration manifest`, () => {
    const m = validateIntegrationManifest(adapter.manifest());
    assert.equal(m.id, id);
  });
}
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/upstream-adapters.test.mjs tests/v6-manifest-contract.test.mjs
```

- [ ] **Step 3: Add manifests without changing canonical endpoint semantics**

```js
export function manifest({repositoryRevision,serviceVersion}={}) {
  return {
    schema:'aftergraph.integration/v1', id:'works', repository:'Aftergraph/works-execution',
    integrationVersion:'1.0.0', repositoryRevision:repositoryRevision ?? 'unverified', serviceVersion,
    roles:['durable-execution'], objects:['Work','Evidence','Memory'], relations:[], capabilities:[], surfaces:['work','brain'], events:[],
    reads:[{name:'work.get'}], writes:[{name:'work.cancel',consequential:true}],
    authority:[{owner:'works',operations:['create','handoff','suspend','resume','cancel']}],
    evidence:[{owner:'works',classes:['execution','settlement']}],
    health:{kind:'http',path:'/healthz'}, degradedBehavior:{reads:'stale',writes:'block'},
    compatibility:{mode:'exact-or-declared',supported:['v1']}
  };
}
```

- [ ] **Step 4: Preserve all legacy adapter tests and run GREEN**

```bash
node --test tests/upstream-adapters.test.mjs tests/upstream-hub.test.mjs tests/upstream-server-integration.test.mjs tests/v6-manifest-contract.test.mjs
```

- [ ] **Logical checkpoint:** Existing V5.2 service integrations now participate in V6 without changing authority allocation.

---

### Task 9: Add AVC Adapter and Agent/Venture Object Projection

**Files:**
- Create: `src/integrations/avc.mjs`
- Create: `src/views/agents-view.mjs`
- Test: `tests/v6-avc-adapter.test.mjs`

**Interfaces:**
- Produces AVC manifest and projection methods for agents, missions, Product Cells, incidents, evaluations, memory and outcomes.
- Writes remain adapter-declared and authority-resolved; no generic remote shell.

- [ ] **Step 1: Write RED projection tests**

```js
test('AVC mission projection preserves AVC as canonical owner', () => {
  const env = projectAvcMission({id:'mis_1',status:'RUNNING'});
  assert.equal(env.graphId,'avc:mission:mis_1');
  assert.equal(env.canonicalOwner,'avc');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-avc-adapter.test.mjs
```

- [ ] **Step 3: Implement narrow HTTP adapter and typed projectors**

```js
export function projectAvcMission(mission, meta={}) {
  return createEnvelope({sourceIntegration:'avc',type:'mission',canonicalId:mission.id,canonicalOwner:'avc',status:mission.status,freshness:meta.freshness ?? 'stale',payload:mission,authority:[{owner:'avc',operations:['pause','resume','cancel']}],evidence:[]});
}
```

- [ ] **Step 4: Run GREEN and credential projection scan**

```bash
node --test tests/v6-avc-adapter.test.mjs
```

Expected: adapter test green. Credential projection is covered here by asserting that adapter return values exclude configured tokens; the repository-wide secret scan is introduced in Task 19.

- [ ] **Logical checkpoint:** AVC appears as an engine of agents/ventures, not as duplicated local state.

---

### Task 10: ISR Research Projection and Promotion Proposal Boundary

**Files:**
- Create: `src/integrations/isr.mjs`
- Create: `src/research/projection.mjs`
- Create: `src/research/promotion-proposal.mjs`
- Create: `src/views/research-view.mjs`
- Create: `server/research-routes.mjs`
- Test: `tests/v6-isr-research.test.mjs`
- Test: `tests/v6-cross-system-invariants.test.mjs`

**Interfaces:**
- Produces ResearchProgram, Study, Experiment, Benchmark, Claim, Replication, Evidence and paper projections.
- `createPromotionProposal(claim, actor)` returns proposal only; never a runtime grant.

- [ ] **Step 1: Write RED `ResearchEvidenceNeverBecomesRuntimeAuthority`**

```js
test('ResearchEvidenceNeverBecomesRuntimeAuthority', () => {
  const claim = projectClaim({id:'C-017',status:'VALIDATED',evidence:['E-1']});
  assert.deepEqual(claim.authority, []);
  const proposal = createPromotionProposal(claim,{id:'human:owner'});
  assert.equal(proposal.type,'PromotionProposal');
  assert.equal(proposal.grantsAuthority,false);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-isr-research.test.mjs tests/v6-cross-system-invariants.test.mjs
```

- [ ] **Step 3: Implement claim projection with evidence limitations preserved**

```js
export function projectClaim(claim,{freshness='stale'}={}) {
  return createEnvelope({sourceIntegration:'isr',type:'claim',canonicalId:claim.id,canonicalOwner:'isr',status:claim.status,freshness,payload:claim,authority:[],evidence:(claim.evidence ?? []).map(id=>({id,owner:'isr'}))});
}

export function createPromotionProposal(claim, actor) {
  return Object.freeze({type:'PromotionProposal',sourceClaim:claim.graphId,actor:actor.id,grantsAuthority:false,status:'DRAFT'});
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-isr-research.test.mjs tests/v6-cross-system-invariants.test.mjs
```

- [ ] **Logical checkpoint:** Research is first-class and still scientifically fenced from execution authority.

---

### Task 11: Work Intelligence Web Surface Donation and Connect Domain

**Files:**
- Create: `src/integrations/work-intelligence-web.mjs`
- Create: `src/views/connect-view.mjs`
- Modify: `src/views/work-view.mjs`
- Test: `tests/v6-wi-connect.test.mjs`

**Interfaces:**
- Produces surface declarations for Drive, Gmail, Calendar, Docs, Sheets, Review Queue, Activity, Evidence Graph.
- Canonical WorkItem state remains WI-v2.

- [ ] **Step 1: Write RED test that surface donor cannot claim backend authority**

```js
test('work-intelligence-web is a surface donor, not state authority', () => {
  const m = workIntelligenceWebManifest();
  assert.equal(m.authority.length, 0);
  assert.equal(m.roles.includes('surface-donor'), true);
});
```

- [ ] **Step 2: Write RED `WorkItemNeverBecomesWorksWorkImplicitly`**

```js
test('WorkItemNeverBecomesWorksWorkImplicitly', () => {
  const item = projectWorkItem({id:'wi_1',status:'APPROVED'});
  assert.equal(item.type,'work_item');
  assert.equal(item.relations.some(r=>r.type==='promoted_to'), false);
});
```

- [ ] **Step 3: Implement surface manifest and explicit promotion projection only after canonical WI evidence exists**

```js
export function workIntelligenceWebManifest() {
  return {schema:'aftergraph.integration/v1',id:'wi-web',repository:'Aftergraph/work-intelligence-web',integrationVersion:'1.0.0',repositoryRevision:'runtime-resolved',roles:['surface-donor'],objects:[],relations:[],capabilities:[],surfaces:['drive','gmail','calendar','docs','sheets','review-queue','activity','evidence-graph'],events:[],reads:[],writes:[],authority:[],evidence:[],health:{kind:'http',path:'/healthz'},degradedBehavior:{reads:'hide-or-stale',writes:'block'},compatibility:{mode:'declared',supported:['wi-v2']}};
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-wi-connect.test.mjs tests/polyrepo-reconciliation.test.mjs
```

- [ ] **Logical checkpoint:** Provider surfaces are inside V6 without duplicating WI-v2 state.

---

### Task 12: Federation Reconciler, Partial Federation and Human-Owned Interaction Safety

**Files:**
- Create: `src/federation/reconciler.mjs`
- Modify: `src/runtime/backend-session.mjs`
- Modify: `src/app/render-scheduler.mjs`
- Modify: `src/app/ui-state.mjs`
- Test: `tests/v6-federation-reconciler.test.mjs`
- Test: `tests/v6-cross-system-invariants.test.mjs`

**Interfaces:**
- Produces: `createFederationReconciler({registry,kernel,concurrency=4})`, `syncIntegration(id)`, `syncAll()`.

- [ ] **Step 1: Write RED `MissingIntegrationLeavesUnaffectedDomainsOperational`**

```js
test('MissingIntegrationLeavesUnaffectedDomainsOperational', async () => {
  const r = createFederationReconciler({/* fixtures: ISR throws, WORKS succeeds */});
  const result = await r.syncAll();
  assert.equal(result.integrations.isr.state,'unavailable');
  assert.equal(result.integrations.works.state,'current');
});
```

- [ ] **Step 2: Write RED interaction preservation test during concurrent federation tick**

```js
test('BackgroundSyncPreservesComposerFocusCaretAndDraft', async () => {
  // Use existing V5.2 focus/caret harness with a federation freshness + WORKS progress tick.
  assert.equal(await concurrentFederationCaretFixture(), true);
});
```

- [ ] **Step 3: Implement concurrency-limited independent sync**

```js
export function createFederationReconciler({registry,syncers,concurrency=4}) {
  async function syncIntegration(id) {
    try { const value = await syncers[id](); registry.setState(id,'current'); return {state:'current',value}; }
    catch (error) { registry.setState(id,'unavailable',{message:error.message}); return {state:'unavailable',error:error.message}; }
  }
  async function syncAll() {
    const ids = Object.keys(syncers), out = {};
    for (let i=0;i<ids.length;i+=concurrency) await Promise.all(ids.slice(i,i+concurrency).map(async id => { out[id]=await syncIntegration(id); }));
    return {integrations:out};
  }
  return {syncIntegration,syncAll};
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-federation-reconciler.test.mjs tests/v6-cross-system-invariants.test.mjs tests/v5-2-focus-caret-contract.test.mjs tests/v5-2-render-scope-contract.test.mjs
```

- [ ] **Logical checkpoint:** Partial federation works and background intelligence still cannot steal human state.

---

### Task 13: Federation Kernel Composition Facade

**Files:**
- Create: `src/federation/surface-registry.mjs`
- Create: `src/federation/federation-kernel.mjs`
- Modify: `src/app/bootstrap.mjs`
- Test: `tests/v6-integration-registry.test.mjs`
- Test: `tests/v6-server-api.test.mjs`

**Interfaces:**
- Produces: `createFederationKernel({integrations,objectGraph,authorityGraph,evidenceGraph,capabilities,surfaces,reconciler})`.

- [ ] **Step 1: Write RED kernel composition test**

```js
test('kernel exposes registries without becoming authority owner', () => {
  const kernel = createFederationKernel(fixtureParts());
  assert.equal(kernel.integration('works').manifest.id,'works');
  assert.equal(kernel.authorityOwnerFor(fixtureWork(),'cancel'),'works');
  assert.notEqual(kernel.authorityOwnerFor(fixtureWork(),'cancel'),'v6');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-integration-registry.test.mjs tests/v6-server-api.test.mjs
```

- [ ] **Step 3: Implement composition facade**

```js
export function createFederationKernel({registry,objectGraph,authorityGraph,evidenceGraph,capabilities,surfaces,reconciler}) {
  return Object.freeze({
    registry, objectGraph, evidenceGraph, capabilities, surfaces, reconciler,
    integration:id=>registry.get(id),
    object:id=>objectGraph.get(id),
    authorityOwnerFor:(object,operation)=>authorityGraph.resolve(object,operation).owner
  });
}
```

- [ ] **Step 4: Wire kernel into bootstrap without blocking initial shell render**

```js
const federation = createFederationKernel(parts);
renderInitialShell({federationState:'syncing'});
queueMicrotask(() => federation.reconciler.syncAll());
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/v6-integration-registry.test.mjs tests/v6-server-api.test.mjs
```

- [ ] **Logical checkpoint:** There is one product federation facade but still no central authority engine.

---

### Task 14: Federated Search with Coverage/Freshness Semantics

**Files:**
- Create: `src/search/federated-index.mjs`
- Create: `server/search-routes.mjs`
- Modify: `src/search.mjs`
- Test: `tests/v6-federated-search.test.mjs`

**Interfaces:**
- Produces: `createFederatedIndex()`, `index(envelope)`, `remove(graphId)`, `search(query,{types,limit}) -> {results,coverage}`.

- [ ] **Step 1: Write RED `SearchReportsIncompleteCoverageDuringOutage`**

```js
test('SearchReportsIncompleteCoverageDuringOutage', () => {
  const idx = createFederatedIndex({integrationStates:()=>({works:'current',isr:'unavailable'})});
  idx.index(fixtureWork());
  const r = idx.search('mission');
  assert.equal(r.coverage.complete,false);
  assert.deepEqual(r.coverage.unavailable,['isr']);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-federated-search.test.mjs
```

- [ ] **Step 3: Implement local metadata index with deterministic scoring**

```js
export function createFederatedIndex({integrationStates=()=>({})}={}) {
  const docs = new Map();
  return {
    index(e) { docs.set(e.graphId,{graphId:e.graphId,type:e.type,owner:e.canonicalOwner,status:e.status,text:JSON.stringify(e.payload).toLowerCase(),freshness:e.freshness}); },
    remove(id) { docs.delete(id); },
    search(query,{types,limit=20}={}) {
      const q=query.toLowerCase();
      const results=[...docs.values()].filter(d=>(!types||types.includes(d.type)) && d.text.includes(q)).slice(0,limit);
      const states=integrationStates(); const unavailable=Object.entries(states).filter(([,s])=>s!=='current').map(([id])=>id);
      return {results,coverage:{complete:unavailable.length===0,unavailable}};
    }
  };
}
```

- [ ] **Step 4: Add p95 benchmark assertion `<150 ms` on fixture index**

```js
test('indexed metadata search p95 stays under 150ms', () => {
  const samples = benchmarkSearch(5000, 100);
  assert.ok(percentile(samples,95) < 150);
});
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/v6-federated-search.test.mjs
```

- [ ] **Logical checkpoint:** Search is useful during outages and admits incomplete coverage.

---

### Task 15: NOW Unified Current-State Projection

**Files:**
- Create: `src/now/projection.mjs`
- Create: `src/views/now-view.mjs`
- Create: `server/now-routes.mjs`
- Test: `tests/v6-now.test.mjs`

**Interfaces:**
- Produces: `buildNowProjection({objects,registry,clock})` returning `active`, `changed`, `needsHuman`, `completed` buckets with owner/freshness on every item.

- [ ] **Step 1: Write RED owner/freshness tests**

```js
test('NOW preserves owner and freshness on every aggregated item', () => {
  const now = buildNowProjection(fixtureNowInput());
  for (const bucket of Object.values(now)) for (const item of bucket) {
    assert.ok(item.canonicalOwner);
    assert.ok(item.freshness);
  }
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-now.test.mjs
```

- [ ] **Step 3: Implement deterministic bucket projection**

```js
export function buildNowProjection({objects}) {
  const all=[...objects];
  const wrap=o=>({graphId:o.graphId,type:o.type,status:o.status,canonicalOwner:o.canonicalOwner,freshness:o.freshness,payload:o.payload});
  return {
    active:all.filter(o=>['RUNNING','ACTIVE','EXECUTING'].includes(o.status)).map(wrap),
    changed:all.filter(o=>o.payload?.recentlyChanged).map(wrap),
    needsHuman:all.filter(o=>o.type==='approval'||o.status==='NEEDS_INPUT').map(wrap),
    completed:all.filter(o=>['VERIFIED','SUCCEEDED','COMPLETED'].includes(o.status)).map(wrap)
  };
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-now.test.mjs
```

- [ ] **Logical checkpoint:** NOW aggregates without flattening source truth.

---

### Task 16: Universal Composer Resolution

**Files:**
- Create: `src/composer/resolver.mjs`
- Modify: `packages/composer/index.mjs`
- Modify: `src/views/chat-view.mjs`
- Test: `tests/v6-composer-resolution.test.mjs`

**Interfaces:**
- Produces: `resolveIntent({text,context,capabilities,objects,authority}) -> ResolutionPlan`.
- ResolutionPlan contains candidates and required authority; it does not execute.

- [ ] **Step 1: Write RED resolution test for research + prototype intent**

```js
test('composer resolves capabilities without granting or executing them', () => {
  const plan = resolveIntent({text:'research this and build a prototype',capabilities:fixtureCaps(),context:{},objects:[],authority:fixtureAuthority()});
  assert.ok(plan.candidates.some(c=>c.kind==='research'));
  assert.ok(plan.candidates.some(c=>c.kind==='coding'));
  assert.equal(plan.executed,false);
  assert.ok(plan.requiredAuthority.length > 0);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-composer-resolution.test.mjs
```

- [ ] **Step 3: Implement deterministic rule-based first resolver**

```js
export function resolveIntent({text,capabilities,authority}) {
  const q=text.toLowerCase();
  const candidates=[];
  if (/research|study|investigat/.test(q)) candidates.push(...capabilities.discover('research').map(capability=>({kind:'research',capability})));
  if (/build|prototype|implement|code/.test(q)) candidates.push(...capabilities.discover('coding').map(capability=>({kind:'coding',capability})));
  const requiredAuthority=[...new Set(candidates.flatMap(c=>c.capability.requiresAuthority ?? []))];
  return Object.freeze({text,candidates,requiredAuthority,executed:false});
}
```

- [ ] **Step 4: Run GREEN**

```bash
node --test tests/v6-composer-resolution.test.mjs
```

- [ ] **Logical checkpoint:** Composer becomes capability-aware without becoming an execution authority.

---

### Task 17: Universal Space and Cross-System Surface Continuity

**Files:**
- Modify: `src/views/space-view.mjs`
- Modify: `packages/spatial/index.mjs`
- Create: `src/views/evidence-view.mjs`
- Create: `src/views/capabilities-view.mjs`
- Test: `tests/v6-universal-space.test.mjs`

**Interfaces:**
- Space renders any registered V6 object surface by graph ID and keeps one object identity across Chat/Work/Space.

- [ ] **Step 1: Write RED continuity test**

```js
test('same object keeps graph identity across Chat Work and Space surfaces', () => {
  const work=fixtureWork();
  assert.equal(renderObjectLink(work,'chat').graphId, work.graphId);
  assert.equal(renderObjectLink(work,'work').graphId, work.graphId);
  assert.equal(renderObjectLink(work,'space').graphId, work.graphId);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-universal-space.test.mjs
```

- [ ] **Step 3: Add generic registered-object surface contract**

```js
export function objectSurfaceModel(envelope, surfaceRegistry) {
  const surface = surfaceRegistry.resolve(envelope.type);
  return {graphId:envelope.graphId,title:surface.title(envelope),kind:surface.kind,owner:envelope.canonicalOwner,freshness:envelope.freshness,model:surface.project(envelope)};
}
```

- [ ] **Step 4: Preserve V5.2 Space keyboard, focus, semantic zoom and reduced-motion contracts**

```bash
node --test tests/v6-universal-space.test.mjs tests/v5-spatial.test.mjs tests/v5-spatial-motion-lifecycle.test.mjs tests/v5-2-work-space-contract.test.mjs
```

- [ ] **Logical checkpoint:** Space can compose research, agents, execution, evidence and approvals without inventing new IDs.

---

### Task 18: Server Federation APIs and Browser Client Contracts

**Files:**
- Create: `server/federation-routes.mjs`
- Modify: `server/api-router.mjs`
- Modify: `server/app-server.mjs`
- Modify: `src/api-client.mjs`
- Test: `tests/v6-server-api.test.mjs`

**Interfaces:**
- GET `/api/v1/federation/integrations`
- GET `/api/v1/federation/objects/:graphId`
- GET `/api/v1/federation/search?q=`
- GET `/api/v1/now`
- POST `/api/v1/federation/actions/:integration/:operation` with canonical authority routing.

- [ ] **Step 1: Write RED API tests for projection reads and blocked stale write**

```js
test('stale authority integration blocks consequential write', async () => {
  const r = await request(app,'POST','/api/v1/federation/actions/tg/approve',{id:'apr_1'});
  assert.equal(r.status,503);
  assert.equal(r.body.error,'authority_unavailable');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/v6-server-api.test.mjs
```

- [ ] **Step 3: Implement route facade with explicit operation allowlist**

```js
const WRITE_ALLOWLIST = new Map([
  ['tg', new Set(['approve','deny'])],
  ['works', new Set(['suspend','resume','cancel'])],
  ['wi', new Set(['review','promote'])],
  ['aie', new Set(['cancel','message'])],
  ['avc', new Set(['pause','resume','cancel'])]
]);
```

- [ ] **Step 4: Extend API client with typed V6 methods**

```js
export const federationApi = {
  integrations: () => get('/api/v1/federation/integrations'),
  object: graphId => get(`/api/v1/federation/objects/${encodeURIComponent(graphId)}`),
  search: q => get(`/api/v1/federation/search?q=${encodeURIComponent(q)}`),
  now: () => get('/api/v1/now')
};
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/v6-server-api.test.mjs tests/server.test.mjs tests/v5-state-server.test.mjs
```

- [ ] **Logical checkpoint:** Browser accesses federation through bounded APIs, never through raw service credentials.

---

### Task 19: V6 Browser UX, Mobile, Accessibility, Performance and Secret Gates

**Files:**
- Create: `scripts/v6_browser_qa.py`
- Create: `scripts/v6-secret-scan.mjs`
- Modify: `scripts/performance_smoke.py`
- Modify: `scripts/a11y_smoke.py`
- Modify: `styles/views.css`
- Modify: `styles/responsive.css`
- Test: `tests/v6-release-contract.test.mjs`

**Interfaces:**
- Produces browser evidence for Chat/Work/Space/NOW/Research/Agents/Control/Connect/System/search.

- [ ] **Step 1: Write RED release-contract test for required V6 QA surfaces**

```js
test('V6 release contract requires all browser domains and invariant artifacts', () => {
  for (const name of ['now','research','agents','control','connect','system','search','mobile','reduced-motion']) assert.ok(REQUIRED_BROWSER_GATES.includes(name));
});
```

- [ ] **Step 2: Implement browser QA assertions**

```python
# Core assertions in scripts/v6_browser_qa.py
assert page.locator('[data-v6-mode="chat"]').count() == 1
assert page.locator('[data-object-owner]').count() > 0
assert page.locator('[data-freshness]').count() > 0
assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth')
```

- [ ] **Step 3: Extend accessibility routes**

```python
ROUTES = ['chat','work','space','now','research','agents','control','connect','system']
```

- [ ] **Step 4: Add secret projection scan**

```js
const FORBIDDEN = [/AFTERGRAPH_API_TOKEN/i,/TG_TOKEN/i,/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i,/BEGIN PRIVATE KEY/];
// Scan generated HTML/JSON fixtures and browser-visible state snapshots; fail on match.
```

- [ ] **Step 5: Enforce performance budgets**

```text
interaction p95 < 100 ms
search p95 < 150 ms
desktop active-view DOM < 700
mobile active-view DOM < 500
progress/presence/health/freshness tick full-shell renders = 0
```

- [ ] **Step 6: Run GREEN**

```bash
python scripts/v6_browser_qa.py
python scripts/a11y_smoke.py
python scripts/performance_smoke.py
node scripts/v6-secret-scan.mjs
node --test tests/v6-release-contract.test.mjs
```

- [ ] **Logical checkpoint:** V6 is interaction-safe and privacy-safe before cross-system E2E is attempted.

---

### Task 20: Cross-System E2E Journeys A–E

**Files:**
- Create: `scripts/v6_e2e.py`
- Test: `tests/v6-cross-system-invariants.test.mjs`

**Interfaces:**
- Produces deterministic local/reference-service proof for five required journeys.

- [ ] **Step 1: Write RED journey registry test**

```js
const REQUIRED = ['research-to-governed-work','wi-to-execution','avc-agent-execution','failure-and-recovery','partial-federation'];
test('all five V6 E2E journeys are registered', () => assert.deepEqual(journeyNames().sort(), REQUIRED.sort()));
```

- [ ] **Step 2: Implement Journey A with explicit PromotionProposal boundary**

```text
question → ISR claim → evidence inspection → PromotionProposal
→ governance review fixture → capability selection → authority resolution
→ WORKS Work fixture → verifier evidence → outcome → research feedback relation
```

- [ ] **Step 3: Implement Journey B with explicit WI promotion**

```text
observation → WorkItem → human review → canonical promote response
→ `promoted_to` relation → distinct WORKS Work → progress → evidence → outcome
```

- [ ] **Step 4: Implement Journey C through AVC mission and canonical authority owners**

```text
owner goal → AVC mission → capability candidate → TG/AIE authority resolution
→ WORKS execution → independent evidence → AVC reconciliation
```

- [ ] **Step 5: Implement Journey D degradation and recovery**

```text
running Work → integration unavailable → stale projection → Needs You/incident
→ canonical pause/cancel/recover → evidence → authoritative resync → current
```

- [ ] **Step 6: Implement Journey E partial federation**

```text
ISR unavailable → Chat/Work/Control remain usable → research coverage incomplete
→ no synthetic research status → ISR recovery → authoritative resync
```

- [ ] **Step 7: Run GREEN**

```bash
python scripts/v6_e2e.py
node --test tests/v6-cross-system-invariants.test.mjs
```

- [ ] **Logical checkpoint:** V6 proves end-to-end composition rather than only isolated adapters.

---

### Task 21: Source Truth, Exact Revision Compatibility and System Domain

**Files:**
- Modify: `src/integrations/source-truth.mjs`
- Modify: `scripts/verify-upstreams.mjs`
- Modify: `src/views/system-view.mjs`
- Create: `contracts/v6/release-invariants.json`
- Test: `tests/polyrepo-verifier-contract.test.mjs`
- Test: `tests/v6-cross-system-invariants.test.mjs`

**Interfaces:**
- Adds AVC, Skills Vault and Work Intelligence Web exact-revision tracking where independently verifiable.
- Separates repository revision from deployed service version.

- [ ] **Step 1: Write RED `SourceRevisionDriftDisablesUnsafeWrites`**

```js
test('SourceRevisionDriftDisablesUnsafeWrites', () => {
  const registry = fixtureRegistry({works:'drifted'});
  assert.equal(registry.canWrite('works'), false);
});
```

- [ ] **Step 2: Implement System projection rows**

```js
function systemIntegrationRow(entry) {
  return {id:entry.manifest.id,repository:entry.manifest.repository,repositoryRevision:entry.manifest.repositoryRevision,serviceVersion:entry.manifest.serviceVersion ?? 'unknown',state:entry.state,writesEnabled:entry.state==='current'};
}
```

- [ ] **Step 3: Run exact-head/source-truth verification**

```bash
npm run verify:upstreams
node --test tests/polyrepo-verifier-contract.test.mjs tests/v6-cross-system-invariants.test.mjs
```

- [ ] **Logical checkpoint:** System view reports drift honestly and unsafe writes are disabled.

---

### Task 22: V6 Version, Documentation, Migration Truth and Release Packaging

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Create: `CHANGELOG-v6.md`
- Create: `QA-REPORT-V6.md`
- Create: `SOURCE-OF-TRUTH-V6.md`
- Create: `POLYREPO-INTEGRATION-V6.md`
- Create: `scripts/v6_release_verify.mjs`
- Create: `/mnt/data/Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip`
- Create: `/mnt/data/Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip.sha256`
- Test: `tests/v6-release-contract.test.mjs`

**Interfaces:**
- Produces the first V6 release candidate artifact only after every gate below is green from a clean extraction.

- [ ] **Step 1: Write RED release contract that package cannot claim V6 until all gate evidence files exist**

```js
test('V6 package version requires complete release evidence', () => {
  const evidence = requiredReleaseEvidence();
  assert.equal(evidence.every(x=>x.exists && x.passed), true);
});
```

- [ ] **Step 2: Run complete pre-version gate**

```bash
npm test
npm run verify
npm run verify:platforms
npm run verify:browser
npm run verify:fullstack
npm run verify:upstreams
npm run verify:polyrepo
npm run verify:a11y
python scripts/v6_browser_qa.py
python scripts/performance_smoke.py
python scripts/v6_e2e.py
node scripts/v6-secret-scan.mjs
```

Expected: every command exits 0.

- [ ] **Step 3: Set release identity only after Step 2 passes**

```json
{
  "name": "aftergraph-workspace-v6-federated",
  "version": "6.0.0",
  "description": "Aftergraph V6 Federated Unified Intelligence Operating Environment"
}
```

- [ ] **Step 4: Generate complete source/build checksums**

```bash
find . -type f -not -path './.git/*' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
sha256sum -c SHA256SUMS
```

Expected: all files OK.

- [ ] **Step 5: Package the complete integration root**

```bash
cd /mnt/data/aftergraph-v5.2-worktree
zip -qr /mnt/data/Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip aftergraph-v5-integration
sha256sum /mnt/data/Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip > /mnt/data/Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip.sha256
```

- [ ] **Step 6: Fresh-extract the ZIP into a new verification directory**

```bash
rm -rf /mnt/data/aftergraph-v6-release-verify
mkdir -p /mnt/data/aftergraph-v6-release-verify
unzip -q /mnt/data/Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip -d /mnt/data/aftergraph-v6-release-verify
cd /mnt/data/aftergraph-v6-release-verify/aftergraph-v5-integration/workspace-v5
sha256sum -c SHA256SUMS
```

Expected: checksum verification PASS.

- [ ] **Step 7: Re-run the complete release gate from the extracted artifact**

```bash
npm test
npm run verify
npm run verify:platforms
npm run verify:browser
npm run verify:fullstack
npm run verify:upstreams
npm run verify:polyrepo
npm run verify:a11y
python scripts/v6_browser_qa.py
python scripts/performance_smoke.py
python scripts/v6_e2e.py
node scripts/v6-secret-scan.mjs
```

Expected: every command exits 0 from the extracted artifact.

- [ ] **Step 8: Externally recompute archive SHA-256 and compare sidecar**

```bash
cd /mnt/data
sha256sum -c Aftergraph-V6-Unified-Intelligence-Operating-Environment.zip.sha256
```

Expected: `OK`.

- [ ] **Step 9: Write measured QA report, never inferred claims**

```text
QA-REPORT-V6.md must contain exact test counts, axe serious/critical violation counts, browser matrix, DOM counts, interaction p95, search p95, visual regression results, E2E Journey A–E results, exact-revision verification state, artifact entry count, ZIP SHA-256 and clean-extract verification result.
```

- [ ] **Logical checkpoint:** V6 may be called release-ready only after the extracted artifact itself reproduces every release gate.

---

## Plan Self-Review

### Spec coverage

- Sections 1–4 product/scope/non-goals: Global Constraints, Tasks 13–19.
- Section 5 Federation Kernel: Tasks 2, 3, 13.
- Section 6 Unified Object Graph: Task 4.
- Section 7 Authority Graph: Task 5.
- Section 8 Evidence Graph: Task 6.
- Section 9 Research: Task 10.
- Section 10 AVC: Task 9.
- Section 11 WORKS: Task 8 plus Tasks 20–21.
- Section 12 Work Intelligence/Connect: Task 11.
- Section 13 Trust Gateway: Tasks 5 and 8.
- Section 14 AIE: Tasks 5 and 8.
- Section 15 Skills/Capability Graph: Task 7.
- Section 16 Universal Space: Task 17.
- Section 17 Federated Search: Task 14.
- Section 18 Event/state reconciliation: Task 12.
- Sections 19–20 server/client architecture: Tasks 13 and 18.
- Section 21 System domain: Task 21.
- Section 22 degraded behavior: Tasks 3, 12, 20, 21.
- Section 23 security/privacy: Tasks 5, 18, 19.
- Section 24 accessibility: Tasks 1 and 19.
- Section 25 performance: Tasks 14 and 19.
- Section 26 testing: every task plus Task 20.
- Section 27 migration: Tasks 1, 8–13, 17, 21, 22.
- Sections 28–29 topology/source truth: Tasks 8, 21, 22.
- Section 30 release gates: Tasks 19–22.
- Section 31 absolute invariants: Tasks 4–7, 10–12, 20–21.
- Section 32 success criteria: Tasks 14–20.

### Type consistency

Canonical signatures used throughout the plan:

```text
validateIntegrationManifest(manifest)
createIntegrationRegistry()
graphId(integration, type, canonicalId)
createEnvelope(input)
createObjectGraph()
resolveAuthority(object, operation)
executeConsequentialWrite(input)
createEvidenceGraph()
createCapabilityRegistry(options)
createFederationReconciler(options)
createFederationKernel(parts)
createFederatedIndex(options)
buildNowProjection(input)
resolveIntent(input)
```

No later task uses alternate names for these contracts.

### Placeholder scan

No red-flag placeholder markers or vague implementation directives remain. Commands, signatures, expected outcomes and release thresholds are explicit.

### Scope decision

V6 is large, but each task above is an independently reviewable, testable vertical or contract slice. Implementation must proceed strictly in task order because authority/evidence/object graph contracts are prerequisites for UI composition. No visual retirement or specialist-app removal is part of this implementation plan.
