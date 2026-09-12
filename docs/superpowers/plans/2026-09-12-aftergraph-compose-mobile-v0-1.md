# Aftergraph Compose Mobile v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real Expo mobile app inside Aftergraph Studio that turns rough thoughts into target-adapted, reusable AI instructions while preserving Aftergraph authority, branding, and future integration seams.

**Architecture:** The Expo client owns capture/result/history UX. A new `packages/intent-compiler` package owns canonical Intent IR and deterministic target rendering. A new read-only Studio API route owns model-assisted analysis through a configurable OpenAI-compatible provider adapter. The first slice performs no external writes or agent execution.

**Tech Stack:** Node.js >=22, Expo SDK 57, React 19.2.3, React Native 0.86, Expo Router ~57.0.20, `expo-sqlite/kv-store`, `expo-clipboard`, native React Native `Share`, existing Aftergraph Studio theme/motion primitives, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-aftergraph-compose-mobile-product-design.md`

## Global Constraints

- Product working name is `Aftergraph Compose`; treat it as replaceable until naming review closes.
- Use the canonical Aftergraph master brand and existing Studio/Brand OS tokens.
- Mobile UX remains `Thought -> Better instruction -> Use it`.
- Intent IR is internal source of truth; generated prompts are derived artifacts.
- No compiler or mobile screen performs filesystem, GitHub, MCP, agent-config, Runtime, or other external writes in v0.1.
- Unknown authority defaults closed.
- Provider secrets are environment-only and must never enter source, fixtures, screenshots, logs, or mobile bundles.
- The app must preserve the source thought across analysis/render/share failures.
- Expo implementation targets stable SDK 57, React Native 0.86, React 19.2.3, Node >=22.13.
- Start runtime verification with Expo Go before custom builds.
- Repository completion requires `npm test` and `npm run verify` green at the exact implementation SHA.

---

## File map

### New semantic kernel

- `packages/intent-compiler/schema.mjs` — Intent IR v0.1 normalization and validation.
- `packages/intent-compiler/targets.mjs` — supported target ids, auto-target scoring, target metadata.
- `packages/intent-compiler/renderers.mjs` — deterministic target-specific instruction rendering.
- `packages/intent-compiler/refine.mjs` — intent-preserving refinements.
- `packages/intent-compiler/index.mjs` — public compiler API.

### New server capability

- `server/intent-provider.mjs` — configurable OpenAI-compatible analysis provider, no provider secret persistence.
- `server/intent-routes.mjs` — `POST /api/v1/intent/compile` request validation and response assembly.
- `server/app-server.mjs` — narrow route registration/invocation seam only.

### Mobile product

- `platforms/expo/package.json` — runnable Expo SDK 57 app definition.
- `platforms/expo/app.json` — Aftergraph Compose app metadata and Expo Router plugin.
- `platforms/expo/app/index.tsx` — redirect/default entry into Compose.
- `platforms/expo/app/compose.tsx` — capture screen.
- `platforms/expo/app/compose-result.tsx` — result, target override, refine, copy/share.
- `platforms/expo/app/compose-recents.tsx` — local recents list/reopen/delete.
- `platforms/expo/app/_layout.tsx` — register Compose routes using existing stack semantics.
- `platforms/expo/src/compose/types.ts` — mobile-facing types.
- `platforms/expo/src/compose/api.ts` — API client for the Studio intent endpoint.
- `platforms/expo/src/compose/history.ts` — bounded local history via `expo-sqlite/kv-store`.
- `platforms/expo/src/compose/draft.ts` — draft persistence helpers.
- `platforms/expo/src/compose/compose-theme.ts` — small product mappings derived from existing theme, no new design system.

### Tests

- `tests/intent-compiler.test.mjs` — normalization, target selection, rendering, refinement, authority preservation.
- `tests/intent-provider.test.mjs` — provider request/response and secret-safe failures.
- `tests/intent-api.test.mjs` — real Studio API contract using injected fake provider.
- `tests/expo-compose-contract.test.mjs` — source-contract checks for mobile routes, persistence, copy/share and no direct execution.

---

### Task 1: Canonical Intent IR kernel

**Files:**
- Create: `packages/intent-compiler/schema.mjs`
- Create: `packages/intent-compiler/index.mjs`
- Test: `tests/intent-compiler.test.mjs`

**Interfaces:**
- Consumes: raw candidate semantics from the future server analysis stage.
- Produces: `normalizeIntentIR(input)`, `validateIntentIR(ir)`, `createIntentIR(candidate)`.

- [ ] **Step 1: Write failing normalization and fail-closed tests**

Create `tests/intent-compiler.test.mjs` with fixtures asserting:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntentIR, validateIntentIR } from '../packages/intent-compiler/index.mjs';

test('creates canonical v0.1 intent with explicit empty authority', () => {
  const ir=createIntentIR({
    source:{text:'review relay but do not change anything',surface:'compose-mobile'},
    goal:{statement:'Review Relay for remaining gaps'},
    constraints:['Do not modify source'],
  });
  assert.equal(ir.schema,'aftergraph/intent-ir/v0.1');
  assert.deepEqual(ir.authority,{read:[],write:[],execute:[],network:[],requiresApproval:[]});
  assert.equal(ir.source.text,'review relay but do not change anything');
  assert.equal(validateIntentIR(ir).ok,true);
});

test('never invents write authority', () => {
  const ir=createIntentIR({
    source:{text:'fix it',surface:'compose-mobile'},
    goal:{statement:'Fix the identified issue'},
  });
  assert.deepEqual(ir.authority.write,[]);
  assert.deepEqual(ir.authority.execute,[]);
});

test('material ambiguity remains visible', () => {
  const ir=createIntentIR({
    source:{text:'make this permanent maybe',surface:'compose-mobile'},
    goal:{statement:'Preserve a behavior'},
    ambiguities:['Persistence is unclear'],
  });
  assert.deepEqual(ir.ambiguities,['Persistence is unclear']);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/intent-compiler.test.mjs
```

Expected: failure because `packages/intent-compiler/index.mjs` does not exist.

- [ ] **Step 3: Implement schema normalization and findings**

Implement `schema.mjs` with canonical defaults:

```js
export const INTENT_SCHEMA='aftergraph/intent-ir/v0.1';
export const ARTIFACT_KINDS=new Set(['task','policy','skill','workflow','agent','automation','handoff']);
export const PERSISTENCE=new Set(['ephemeral','session','workspace','durable']);

const strings=value=>Array.isArray(value)?[...new Set(value.map(v=>String(v).trim()).filter(Boolean))]:[];

export function normalizeIntentIR(input={}) {
  return {
    schema:INTENT_SCHEMA,
    source:{
      text:String(input.source?.text||''),
      surface:String(input.source?.surface||'compose-mobile'),
    },
    goal:{
      statement:String(input.goal?.statement||''),
      successCriteria:strings(input.goal?.successCriteria),
    },
    artifact:{
      kind:ARTIFACT_KINDS.has(input.artifact?.kind)?input.artifact.kind:'task',
      persistence:PERSISTENCE.has(input.artifact?.persistence)?input.artifact.persistence:'ephemeral',
    },
    scope:{includes:strings(input.scope?.includes),excludes:strings(input.scope?.excludes)},
    constraints:strings(input.constraints),
    authority:{
      read:strings(input.authority?.read),
      write:strings(input.authority?.write),
      execute:strings(input.authority?.execute),
      network:strings(input.authority?.network),
      requiresApproval:strings(input.authority?.requiresApproval),
    },
    capabilities:{required:strings(input.capabilities?.required),optional:strings(input.capabilities?.optional)},
    effects:Array.isArray(input.effects)?input.effects.map(effect=>({...effect})):[],
    verification:{
      required:input.verification?.required===true,
      obligations:strings(input.verification?.obligations),
      completionRule:String(input.verification?.completionRule||'model-output'),
    },
    output:{format:String(input.output?.format||'text'),contract:strings(input.output?.contract)},
    targetHints:strings(input.targetHints),
    ambiguities:strings(input.ambiguities),
  };
}

export function validateIntentIR(ir) {
  const findings=[];
  if(ir?.schema!==INTENT_SCHEMA)findings.push({code:'IR_INVALID',field:'schema'});
  if(!ir?.source?.text?.trim())findings.push({code:'IR_INVALID',field:'source.text'});
  if(!ir?.goal?.statement?.trim())findings.push({code:'IR_INVALID',field:'goal.statement'});
  return {ok:findings.length===0,findings};
}
```

Export through `index.mjs`.

- [ ] **Step 4: Run focused test GREEN**

```bash
node --test tests/intent-compiler.test.mjs
```

Expected: all Task 1 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/intent-compiler tests/intent-compiler.test.mjs
git commit -m "feat(studio): add canonical intent IR kernel"
```

---

### Task 2: Auto-targeting, renderers and intent-preserving refinement

**Files:**
- Create: `packages/intent-compiler/targets.mjs`
- Create: `packages/intent-compiler/renderers.mjs`
- Create: `packages/intent-compiler/refine.mjs`
- Modify: `packages/intent-compiler/index.mjs`
- Modify: `tests/intent-compiler.test.mjs`

**Interfaces:**
- Consumes: valid Intent IR from Task 1.
- Produces: `classifyTarget(ir)`, `renderIntent(ir,target)`, `refineIntent(ir,mode,target)`.

- [ ] **Step 1: Add failing target/render/refine tests**

Add cases for:
- `automation` + durable persistence prefers Hermes;
- repository task with coding language hints prefers Codex or Claude Code only when hints exist;
- no evidence falls back to Generic, not fabricated certainty;
- target renderer includes constraints and verification;
- `more-autonomous` may strengthen process detail but leaves authority arrays byte-equivalent;
- `safer` may reduce implied autonomy but never adds write/execute authority.

Use target ids:

```js
'friday.chatgpt'
'anthropic.claude-code'
'openai.codex'
'aftergraph.hermes'
'generic'
```

- [ ] **Step 2: Run focused tests RED**

```bash
node --test tests/intent-compiler.test.mjs
```

Expected: missing target/render/refine exports.

- [ ] **Step 3: Implement deterministic target classifier**

`targets.mjs` must return:

```js
{
  target:'generic',
  confidence:0.5,
  reasonCodes:[],
  alternatives:[]
}
```

Rules stay deliberately small in v0.1. Explicit `targetHints` outrank heuristics. `automation` may prefer Hermes. `generic` is the safe fallback.

- [ ] **Step 4: Implement renderer contract**

Every renderer returns:

```js
{
  target,
  mediaType:'text/plain',
  content,
  semanticMap:{
    goal:['goal'],
    constraints:['constraints'],
    authority:['authority'],
    verification:['verification'],
  }
}
```

The output must visibly distinguish:
- objective;
- context/scope;
- constraints;
- allowed/forbidden authority where material;
- expected output;
- completion/verification.

- [ ] **Step 5: Implement refinements without authority mutation**

Supported modes:

```js
['clearer','more-autonomous','safer','more-detailed','shorter','execution-ready']
```

Refinement returns a rendered artifact plus `refinement` metadata and compares pre/post authority. If authority expands, return `AUTHORITY_EXPANSION` and do not emit the changed artifact.

- [ ] **Step 6: Run focused tests GREEN**

```bash
node --test tests/intent-compiler.test.mjs
```

- [ ] **Step 7: Commit**

```bash
git add packages/intent-compiler tests/intent-compiler.test.mjs
git commit -m "feat(studio): compile intent for personal agent targets"
```

---

### Task 3: Provider abstraction and real analysis API

**Files:**
- Create: `server/intent-provider.mjs`
- Create: `server/intent-routes.mjs`
- Modify: `server/app-server.mjs`
- Create: `tests/intent-provider.test.mjs`
- Create: `tests/intent-api.test.mjs`

**Interfaces:**
- Consumes: `{ source, target?, refinement? }` over HTTP.
- Produces: `POST /api/v1/intent/compile` returning `{ ir, target, artifact, findings }`.

- [ ] **Step 1: Write provider contract tests**

Test `createIntentProvider({fetchImpl,baseUrl,apiKey,model})`:
- rejects missing configuration with stable `provider_unconfigured` error;
- sends the secret only in request headers, never in returned data;
- requires strict JSON candidate output;
- converts malformed model output into `provider_invalid_response`;
- accepts an injected fake `fetchImpl` for tests.

- [ ] **Step 2: Implement configurable OpenAI-compatible provider**

Environment mapping:

```text
AFTERGRAPH_INTENT_BASE_URL
AFTERGRAPH_INTENT_API_KEY
AFTERGRAPH_INTENT_MODEL
```

Do not define default credential values. Do not serialize these fields to logs or API responses.

Provider request uses an OpenAI-compatible `/chat/completions` contract and instructs the model to return only candidate Intent IR semantics. The deterministic compiler remains responsible for normalization/validation.

- [ ] **Step 3: Write API tests before route code**

Use `createAppServer` with injected intent provider so the test does not touch the network.

Cases:
- valid rough thought -> HTTP 200 with canonical IR + target + artifact;
- empty source -> HTTP 422 `source_required`;
- provider failure -> HTTP 502 while source remains client-owned;
- requested manual target is respected;
- ambiguity is returned in `findings` and is not hidden.

- [ ] **Step 4: Implement `handleIntentRoute`**

`server/intent-routes.mjs` exports:

```js
export function createIntentApiHandler({provider}) {
  return async function handleIntentApi(req,res,url) { /* returns boolean */ };
}
```

Route:

```text
POST /api/v1/intent/compile
```

Request:

```json
{
  "source":"rough thought",
  "target":"auto",
  "refinement":null
}
```

Response:

```json
{
  "ir":{},
  "target":{"target":"generic","confidence":0.5,"reasonCodes":[],"alternatives":[]},
  "artifact":{"target":"generic","mediaType":"text/plain","content":"...","semanticMap":{}},
  "findings":[]
}
```

- [ ] **Step 5: Register the handler narrowly in `createAppServer`**

Add optional constructor input:

```js
intentProvider = null
```

Build the intent handler once during server creation. Inside the existing API block, invoke it before unrelated route matching:

```js
if (intentHandler && await intentHandler(req,res,url)) return;
```

Do not restructure unrelated server routes.

- [ ] **Step 6: Run server tests GREEN**

```bash
node --test tests/intent-provider.test.mjs tests/intent-api.test.mjs
```

- [ ] **Step 7: Commit**

```bash
git add server/intent-provider.mjs server/intent-routes.mjs server/app-server.mjs tests/intent-provider.test.mjs tests/intent-api.test.mjs
git commit -m "feat(studio): expose governed intent compile API"
```

---

### Task 4: Turn the existing Expo reference into a runnable Compose client

**Files:**
- Create: `platforms/expo/package.json`
- Create: `platforms/expo/app.json`
- Modify: `platforms/expo/app/_layout.tsx`
- Modify: `platforms/expo/app/index.tsx`
- Create: `platforms/expo/app/compose.tsx`
- Create: `platforms/expo/src/compose/types.ts`
- Create: `platforms/expo/src/compose/api.ts`
- Create: `platforms/expo/src/compose/compose-theme.ts`
- Create/Modify: `tests/expo-compose-contract.test.mjs`

**Interfaces:**
- Consumes: Studio intent API from Task 3.
- Produces: real Expo Router entry screen and mobile API client.

- [ ] **Step 1: Add failing mobile source-contract test**

Test that:
- `platforms/expo/package.json` pins Expo SDK 57 family;
- package `main` is `expo-router/entry`;
- `app/index.tsx` redirects to `/compose`;
- `compose.tsx` imports the API client and contains accessible `Improve` action;
- no mobile source imports Runtime, GitHub, Trust Gateway, or direct provider secrets.

- [ ] **Step 2: Create the Expo package manifest**

Start with:

```json
{
  "name":"@aftergraph/compose-mobile",
  "version":"0.1.0",
  "private":true,
  "main":"expo-router/entry",
  "scripts":{
    "start":"expo start",
    "typecheck":"tsc --noEmit"
  },
  "dependencies":{
    "expo":"~57.0.0",
    "expo-router":"~57.0.20",
    "expo-clipboard":"~57.0.1",
    "react":"19.2.3",
    "react-native":"0.86.0"
  }
}
```

Then use SDK-aware installation rather than hand-guessing native peer versions:

```bash
cd platforms/expo
npx expo install expo-sqlite expo-haptics expo-image react-native-safe-area-context react-native-screens
```

Commit the resulting compatible dependency versions.

- [ ] **Step 3: Add `app.json`**

Use:

```json
{
  "expo":{
    "name":"Aftergraph Compose",
    "slug":"aftergraph-compose",
    "scheme":"aftergraph-compose",
    "version":"0.1.0",
    "orientation":"portrait",
    "userInterfaceStyle":"automatic",
    "plugins":["expo-router"],
    "experiments":{"typedRoutes":true}
  }
}
```

Do not add invented icon/splash asset paths until approved brand assets exist.

- [ ] **Step 4: Implement the mobile API client**

`platforms/expo/src/compose/api.ts` exposes:

```ts
export async function compileThought(input: CompileThoughtInput): Promise<CompileThoughtResult>
```

Read the server base URL from:

```text
EXPO_PUBLIC_AFTERGRAPH_API_URL
```

The client must use only the public API URL. Provider credentials never enter Expo environment variables.

- [ ] **Step 5: Implement Compose capture route**

`compose.tsx`:
- first child is `ScrollView` with `contentInsetAdjustmentBehavior="automatic"`;
- large multiline `TextInput`;
- `Auto` target by default;
- primary `Improve` button disabled for blank input;
- source draft retained in state on request errors;
- error text `selectable` and accessibility-labelled;
- route to `/compose-result` only on successful compile.

- [ ] **Step 6: Run contract/type verification**

```bash
node --test tests/expo-compose-contract.test.mjs
cd platforms/expo && npm run typecheck
```

Expected: green.

- [ ] **Step 7: Commit**

```bash
git add platforms/expo tests/expo-compose-contract.test.mjs
git commit -m "feat(studio): add runnable Aftergraph Compose mobile capture"
```

---

### Task 5: Result experience, target override, copy/share and refinement

**Files:**
- Create: `platforms/expo/app/compose-result.tsx`
- Modify: `platforms/expo/src/compose/api.ts`
- Modify: `platforms/expo/src/compose/types.ts`
- Modify: `tests/expo-compose-contract.test.mjs`

**Interfaces:**
- Consumes: `CompileThoughtResult`.
- Produces: user-usable output and recompile/refine actions.

- [ ] **Step 1: Extend failing mobile contract tests**

Assert the result route provides:
- `Understood as` summary;
- target control;
- selectable compiled output;
- `Clearer`, `More autonomous`, `Safer`, `More detailed`, `Shorter`, `Execution-ready` actions;
- Clipboard copy through `expo-clipboard`;
- native text share through `Share.share` from React Native;
- no direct external delivery button in v0.1.

- [ ] **Step 2: Add target override model**

Visible target ids:

```ts
type ComposeTarget='auto'|'friday.chatgpt'|'anthropic.claude-code'|'openai.codex'|'aftergraph.hermes'|'generic';
```

Changing target calls `/api/v1/intent/compile` again with the same source and selected target. Do not reinterpret the source from scratch on the client.

- [ ] **Step 3: Add refinement actions**

Each action calls compile endpoint with `refinement` while keeping source and selected target stable.

Disable refine actions while a refine request is in flight, but keep current output visible.

- [ ] **Step 4: Add copy and native share**

Copy:

```ts
await Clipboard.setStringAsync(result.artifact.content);
```

Share text using React Native core `Share.share({message: result.artifact.content})`; do not create a file merely to share text.

- [ ] **Step 5: Run contract/type tests GREEN**

```bash
node --test tests/expo-compose-contract.test.mjs
cd platforms/expo && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add platforms/expo tests/expo-compose-contract.test.mjs
git commit -m "feat(studio): add Compose result and refinement flow"
```

---

### Task 6: Local draft and recent history

**Files:**
- Create: `platforms/expo/src/compose/history.ts`
- Create: `platforms/expo/src/compose/draft.ts`
- Create: `platforms/expo/app/compose-recents.tsx`
- Modify: `platforms/expo/app/compose.tsx`
- Modify: `platforms/expo/app/compose-result.tsx`
- Modify: `platforms/expo/app/_layout.tsx`
- Modify: `tests/expo-compose-contract.test.mjs`

**Interfaces:**
- Consumes: successful compile results.
- Produces: bounded local history, draft recovery, reopen/delete behavior.

- [ ] **Step 1: Add failing history contract tests**

Require source references to:

```ts
import Storage from 'expo-sqlite/kv-store';
```

and verify a hard history bound of `50` records.

- [ ] **Step 2: Implement storage helpers**

`history.ts` API:

```ts
export async function listRecentCompositions(): Promise<CompositionRecord[]>
export async function saveComposition(record: CompositionRecord): Promise<void>
export async function deleteComposition(id: string): Promise<void>
export async function getComposition(id: string): Promise<CompositionRecord|null>
```

Store under one versioned key:

```text
aftergraph.compose.recents.v1
```

Newest first, dedupe by id, truncate to 50.

`draft.ts` stores current source under:

```text
aftergraph.compose.draft.v1
```

- [ ] **Step 3: Save only after successful compile**

A failed analysis must preserve draft but must not add a false successful recent item.

- [ ] **Step 4: Build Recents route**

Use `FlatList` with `contentInsetAdjustmentBehavior="automatic"`.

Each row shows:
- source excerpt;
- interpreted goal;
- target;
- date.

Tap reopens. Delete requires an explicit destructive action and removes only local data.

- [ ] **Step 5: Run type/contract tests GREEN**

```bash
node --test tests/expo-compose-contract.test.mjs
cd platforms/expo && npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add platforms/expo tests/expo-compose-contract.test.mjs
git commit -m "feat(studio): persist Compose drafts and recents locally"
```

---

### Task 7: Brand alignment, end-to-end verification and personal deployment handoff

**Files:**
- Modify only if required by verification: `platforms/expo/src/compose/compose-theme.ts`
- Modify only if required: `platforms/expo/app/*.tsx`
- Modify: `platforms/expo/README.md`
- Modify/add relevant test files only for discovered gaps.

**Interfaces:**
- Consumes: Tasks 1-6 complete.
- Produces: verified v0.1 candidate with documented phone-run procedure.

- [ ] **Step 1: Reconcile visual tokens against existing Studio theme**

`compose-theme.ts` may alias existing values but must not introduce a separate brand palette.

Screen copy uses `Aftergraph Compose` / `by Aftergraph` only. Avoid controlled terms such as `verified`, `secure`, `production-ready`, or `certified` unless their Brand OS conditions are actually met.

- [ ] **Step 2: Run the complete repository test suite**

```bash
npm test
```

Expected: all repository tests plus new Compose tests pass.

- [ ] **Step 3: Run repository verification**

```bash
npm run verify
```

Expected: green at the same exact SHA.

- [ ] **Step 4: Validate Expo dependency compatibility**

```bash
cd platforms/expo
npx expo install --check
npm run typecheck
```

Expected: no incompatible SDK dependency warnings and no TypeScript errors.

- [ ] **Step 5: Run the actual app through Expo Go first**

```bash
cd platforms/expo
npx expo start
```

The Expo account must be logged in because Expo Go requires login as of September 2026.

On the phone, verify manually:

1. app opens into Compose;
2. rough thought remains after a failed request;
3. real configured provider returns improved output;
4. target override changes representation;
5. refinement works;
6. copy works;
7. native share sheet opens;
8. recent item survives app restart;
9. recent item can be reopened and deleted.

Record this evidence as **operator-observed Expo Go behavior**, not simulator or production proof.

- [ ] **Step 6: Configure the personal backend without exposing secrets**

Set backend-only environment variables on the authorized deployment host:

```text
AFTERGRAPH_INTENT_BASE_URL=<OpenAI-compatible endpoint>
AFTERGRAPH_INTENT_API_KEY=<secret managed outside git>
AFTERGRAPH_INTENT_MODEL=<selected model id>
```

Set the mobile public endpoint only:

```text
EXPO_PUBLIC_AFTERGRAPH_API_URL=<reachable Studio API URL>
```

Never put `AFTERGRAPH_INTENT_API_KEY` in `EXPO_PUBLIC_*`.

- [ ] **Step 7: Update Expo README with real run instructions**

Document:

```bash
cd platforms/expo
npm install
npx expo start
```

and the required public API URL variable. State clearly that direct agent delivery is not part of v0.1.

- [ ] **Step 8: Final exact-head verification and commit**

After all fixes, rerun:

```bash
npm test
npm run verify
cd platforms/expo && npx expo install --check && npm run typecheck
```

Commit only after all green:

```bash
git add platforms/expo packages/intent-compiler server tests docs
git commit -m "feat(studio): deliver Aftergraph Compose mobile v0.1"
```

Do not claim phone runtime verification unless the manual Expo Go checks were actually executed on a physical device.

---

## Coverage map

| Product requirement | Implemented by |
|---|---|
| Rough thought capture | Task 4 |
| Canonical Intent IR | Task 1 |
| Auto target | Task 2 |
| Friday/Claude/Codex/Hermes/Generic rendering | Task 2 |
| Real model-assisted improvement | Task 3 |
| Aftergraph API boundary | Task 3 |
| Mobile-first real Expo client | Task 4 |
| Target override | Task 5 |
| Refinement controls | Task 5 |
| Copy/share | Task 5 |
| Draft preservation | Tasks 4, 6 |
| Recents/reopen/delete | Task 6 |
| Aftergraph branding | Tasks 4, 7 |
| No external writes in v0.1 | Tasks 2, 3, 5 tests |
| Provider secret isolation | Tasks 3, 7 |
| Expo Go physical-phone validation | Task 7 |
| Future Runtime/Relay/Trust seams | Tasks 1-3 architecture |

## Deferred deliberately

The following are not hidden TODOs for v0.1; they are separate future product slices:

- direct `Send to Friday/Hermes/Codex` execution;
- Context Continuity synchronization;
- account/cloud history;
- voice capture;
- iOS Share Extension receiving content from other apps;
- Shortcuts/App Intents;
- Cron Fabric automation creation;
- Skills Vault/SABI publication;
- MCP capability discovery;
- Trust Gateway approval UI;
- Relay execution receipts;
- public onboarding, teams, billing, or marketplace.

The v0.1 architecture keeps explicit seams for these without making the personal app wait for them.
