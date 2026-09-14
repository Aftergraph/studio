# Aftergraph Compose Web v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished, private, installable Aftergraph Compose web/PWA that works on iPhone Safari/Home Screen and desktop using the existing Studio intent compiler, while proving the first reusable Aftergraph conversation/artifact UI boundaries.

**Architecture:** Add a new Next.js + React + strict TypeScript application under `platforms/web` without rewriting the existing Studio backend. The web app calls the existing `POST /api/v1/intent/compile` contract through a same-origin/reverse-proxied API, maps validated responses into typed presentation objects, persists conversations/artifacts locally, and renders a chat-first interface with mobile sheets/fullscreen artifacts and desktop split-view. Reuse or evolve existing Studio tokens/UI contracts where they already represent the right concepts; extract new reusable contracts only after the Compose slice proves the boundary.

**Tech Stack:** Next.js, React, TypeScript strict, Tailwind CSS + CSS custom properties, React Aria where native semantics are insufficient, TanStack Query, Zod, IndexedDB/Dexie, Motion for React, safe Markdown rendering, Shiki lazy-loaded for code, Vitest + Testing Library, Playwright, axe, PWA/service worker tooling, existing Studio Node API.

**Spec:** `docs/superpowers/specs/2026-09-13-aftergraph-application-platform-compose-web-v0-1-design.md`

## Global Constraints

- Preserve the existing `aftergraph/intent-ir/v0.1` compiler and `POST /api/v1/intent/compile`; do not duplicate backend semantics in Next route handlers.
- No direct Run/Execute/Send-to-agent action in v0.1.
- Provider/model credentials remain server-side only.
- Confidence never grants authority; refinement must not widen write/execute permissions.
- `/compose` and `/compose/c/:conversationId` are the minimum web routes.
- Support system/light/dark themes through tokens, not component-specific color forks.
- Target WCAG 2.2 AA; use semantic HTML and 44px-class mobile hit areas for primary touch controls.
- Preserve source text/drafts before any model request can fail.
- Do not log raw prompt/artifact content by default.
- Existing Studio/Expo surfaces continue to work; no big-bang rewrite.
- Visual implementation must be compared against approved concept images and browser screenshots before release.
- Physical iPhone Safari/Home Screen flow is a release gate independent of Expo Go.

---

## File Structure

Create a focused web app under `platforms/web`:

```text
platforms/web/
  app/
    compose/
      page.tsx
      c/[conversationId]/page.tsx
    layout.tsx
    globals.css
    manifest.ts
  src/
    compose/
      api.ts
      schemas.ts
      presentation.ts
      types.ts
      repository.ts
      use-compose.ts
      components/
        compose-shell.tsx
        conversation-list.tsx
        conversation-turn.tsx
        compose-composer.tsx
        instruction-artifact.tsx
        artifact-workspace.tsx
        version-event.tsx
        decision-card.tsx
        boundary-card.tsx
        target-sheet.tsx
        refinement-sheet.tsx
        error-turn.tsx
    design/
      tokens.css
    pwa/
      register.ts
  tests/
    compose/
      presentation.test.ts
      repository.test.ts
      composer.test.tsx
      artifact.test.tsx
      sheets.test.tsx
      flow.test.tsx
  e2e/
    compose.spec.ts
  public/
    icons/
  package.json
  tsconfig.json
  next.config.ts
  playwright.config.ts
  vitest.config.ts
```

Modify only narrowly scoped root/server files needed to expose/proxy the web app in private development/release and to add verification scripts. Do not move the existing Studio application.

---

### Task 1: Create and approve the complete Compose visual concept set

**Files:**
- Create: `docs/design/compose-web-v0-1/README.md`
- Create: `docs/design/compose-web-v0-1/compose-iphone-chat.png`
- Create: `docs/design/compose-web-v0-1/compose-iphone-artifact.png`
- Create: `docs/design/compose-web-v0-1/compose-iphone-sheet.png`
- Create: `docs/design/compose-web-v0-1/compose-desktop-split.png`
- Create: `docs/design/compose-web-v0-1/compose-states.png`

**Interfaces:**
- Consumes: approved product/design spec.
- Produces: visual source-of-truth screenshots and an inventory of tokens/components/states used by all later tasks.

- [ ] **Step 1: Generate the iPhone main chat concept**

Use the approved direction: minimal top bar, open conversation canvas, one dominant composer, adaptive instruction artifact, restrained Aftergraph visual language, no dashboard card grid, no gratuitous glow/gradient, no internal architecture jargon.

- [ ] **Step 2: Generate artifact, sheet, desktop split and state concepts**

Keep typography, palette, spacing, icon language and component anatomy consistent across all concepts. Include real interaction states for `Understanding`, `Ready`, compile failure, `DecisionCard`, target selection and refinement.

- [ ] **Step 3: Write the design inventory**

`docs/design/compose-web-v0-1/README.md` must record:

```markdown
# Compose Web v0.1 Visual Contract

## Viewports
- iPhone: 393x852 CSS px reference
- Desktop: 1440x1024 CSS px reference

## Required surfaces
- main conversation
- instruction artifact
- target/refinement sheet
- desktop split workspace
- loading/error/decision states

## Component families
- top bar
- conversation turn
- composer
- instruction artifact
- version event
- decision card
- boundary card
- bottom sheet / desktop popover
- artifact workspace

## Interaction rules
- chat remains the navigation spine
- artifact is the working object
- refinements create versions, never overwrite
- advanced details stay progressively disclosed
```

- [ ] **Step 4: Review concept completeness**

Reject and regenerate any concept with unreadable text, generic card-grid structure, inconsistent controls, ambiguous mobile keyboard/safe-area behavior, or a look that visually clones another AI brand.

- [ ] **Step 5: Commit the visual spec**

```bash
git add docs/design/compose-web-v0-1
git commit -m "design(studio): lock Compose web visual contract"
```

---

### Task 2: Scaffold the isolated Next.js web boundary and design-token bridge

**Files:**
- Create: `platforms/web/package.json`
- Create: `platforms/web/tsconfig.json`
- Create: `platforms/web/next.config.ts`
- Create: `platforms/web/app/layout.tsx`
- Create: `platforms/web/app/globals.css`
- Create: `platforms/web/app/compose/page.tsx`
- Create: `platforms/web/src/design/tokens.css`
- Create: `platforms/web/vitest.config.ts`
- Modify: root `package.json`
- Modify: `scripts/platform_verify.mjs`
- Test: `tests/compose-web-platform-contract.test.mjs`

**Interfaces:**
- Consumes: existing `packages/tokens`, `packages/icons`, `packages/motion` where compatible.
- Produces: buildable `platforms/web` application and deterministic root verification entrypoint.

- [ ] **Step 1: Write the failing platform contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Compose web platform is verified from root', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['verify:compose-web'], 'npm --prefix platforms/web run verify');
  const web = JSON.parse(await read('platforms/web/package.json'));
  assert.match(web.scripts.verify, /typecheck/);
  assert.match(web.scripts.verify, /test/);
  assert.match(web.scripts.verify, /build/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test tests/compose-web-platform-contract.test.mjs
```

Expected: FAIL because `verify:compose-web` and/or `platforms/web/package.json` do not exist.

- [ ] **Step 3: Add the minimal web package**

`platforms/web/package.json` must expose:

```json
{
  "name": "@aftergraph/studio-web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "verify": "npm run typecheck && npm run test && npm run build"
  }
}
```

Use current stable compatible versions of Next.js/React/TypeScript and pin them in the lockfile. Enable `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true` in `tsconfig.json` unless an existing repo constraint proves incompatible.

- [ ] **Step 4: Bridge design tokens without duplicating Brand OS**

`src/design/tokens.css` should expose stable runtime variables consumed by components:

```css
:root {
  --ag-bg: #ffffff;
  --ag-surface: #f7f7f8;
  --ag-text: #171717;
  --ag-muted: #6b6b6f;
  --ag-border: color-mix(in srgb, var(--ag-text) 12%, transparent);
  --ag-radius-sm: 10px;
  --ag-radius-md: 16px;
  --ag-content-max: 760px;
  --ag-motion-fast: 140ms;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ag-bg: #111214;
    --ag-surface: #191a1d;
    --ag-text: #f4f4f5;
    --ag-muted: #a1a1aa;
  }
}
```

These values are provisional until sampled against Task 1 concepts; then update them to the accepted visual contract.

- [ ] **Step 5: Add root verification**

Add:

```json
"verify:compose-web": "npm --prefix platforms/web run verify"
```

and make `scripts/platform_verify.mjs` fail when the web package is missing or its lockfile is stale.

- [ ] **Step 6: Run GREEN gates**

```bash
node --test tests/compose-web-platform-contract.test.mjs
npm --prefix platforms/web run typecheck
npm --prefix platforms/web run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add platforms/web package.json scripts/platform_verify.mjs tests/compose-web-platform-contract.test.mjs
git commit -m "feat(studio): add Compose web platform boundary"
```

---

### Task 3: Define typed compile and presentation contracts

**Files:**
- Create: `platforms/web/src/compose/types.ts`
- Create: `platforms/web/src/compose/schemas.ts`
- Create: `platforms/web/src/compose/api.ts`
- Create: `platforms/web/src/compose/presentation.ts`
- Test: `platforms/web/tests/compose/presentation.test.ts`

**Interfaces:**
- Consumes: existing `/api/v1/intent/compile` response contract.
- Produces: `CompileResponse`, `PresentationBlock`, `InstructionArtifactModel`, `DecisionModel`, `BoundaryModel`, and `compileIntent()`.

- [ ] **Step 1: Write presentation mapping tests first**

```ts
import { describe, expect, it } from 'vitest';
import { mapCompileResponse } from '../../src/compose/presentation';

it('maps a successful compile into an instruction artifact', () => {
  const result = mapCompileResponse({
    target: 'openai.codex',
    output: 'Implement the feature and verify it.',
    intent: {
      schema: 'aftergraph/intent-ir/v0.1',
      goal: { statement: 'Implement feature', successCriteria: [] },
      constraints: ['Do not merge'],
      authority: { read: [], write: [], execute: [], network: [], requiresApproval: [] },
      ambiguities: []
    }
  });
  expect(result.artifact.kind).toBe('instruction');
  expect(result.artifact.target).toBe('openai.codex');
  expect(result.boundaries).toContainEqual(expect.objectContaining({ label: 'No execution access' }));
});
```

Add a second test that rejects malformed payloads and a third proving non-empty backend write/execute authority cannot be invented by a client-side refinement mapper.

- [ ] **Step 2: Run RED**

```bash
npm --prefix platforms/web test -- presentation.test.ts
```

Expected: FAIL because mapper/schema modules do not exist.

- [ ] **Step 3: Define stable presentation types**

```ts
export type PresentationBlock =
  | { type: 'text'; markdown: string }
  | { type: 'instruction-artifact'; artifactId: string }
  | { type: 'decision'; decisionId: string }
  | { type: 'boundary'; boundaryId: string }
  | { type: 'version-event'; versionId: string };

export interface InstructionArtifactModel {
  id: string;
  kind: 'instruction';
  title: string;
  target: string;
  body: string;
  constraints: string[];
  version: number;
  parentVersionId: string | null;
}
```

- [ ] **Step 4: Validate at the browser trust boundary**

Use Zod schemas to parse the actual compile response and throw a typed `ComposeProtocolError` for malformed payloads. Do not use `as CompileResponse` casts on unvalidated JSON.

- [ ] **Step 5: Implement `compileIntent()`**

```ts
export async function compileIntent(input: CompileRequest, signal?: AbortSignal) {
  const response = await fetch('/api/v1/intent/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal
  });
  if (!response.ok) throw new ComposeHttpError(response.status);
  return CompileResponseSchema.parse(await response.json());
}
```

- [ ] **Step 6: Run GREEN**

```bash
npm --prefix platforms/web test -- presentation.test.ts
npm --prefix platforms/web run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add platforms/web/src/compose platforms/web/tests/compose/presentation.test.ts
git commit -m "feat(compose): add typed web presentation contracts"
```

---

### Task 4: Implement local conversation, artifact and version persistence

**Files:**
- Create: `platforms/web/src/compose/repository.ts`
- Create: `platforms/web/src/compose/conversation-state.ts`
- Test: `platforms/web/tests/compose/repository.test.ts`

**Interfaces:**
- Consumes: `InstructionArtifactModel` and presentation types from Task 3.
- Produces: `ConversationRepository`, `ConversationRecord`, `ArtifactRecord`, immutable version append/restore operations.

- [ ] **Step 1: Write repository tests**

```ts
it('persists a submitted turn before compile success', async () => {
  const repo = createMemoryConversationRepository();
  const conversation = await repo.createConversation();
  await repo.appendUserTurn(conversation.id, 'rough thought');
  expect((await repo.getConversation(conversation.id))?.turns[0]?.content).toBe('rough thought');
});

it('restores an older artifact version without deleting descendants', async () => {
  // create v1 -> v2, set active to v1, assert both records still exist
});
```

- [ ] **Step 2: Run RED**

```bash
npm --prefix platforms/web test -- repository.test.ts
```

- [ ] **Step 3: Implement IndexedDB/Dexie repository behind an interface**

Expose:

```ts
export interface ConversationRepository {
  createConversation(): Promise<ConversationRecord>;
  listConversations(): Promise<ConversationRecord[]>;
  getConversation(id: string): Promise<ConversationRecord | undefined>;
  saveDraft(conversationId: string, draft: string): Promise<void>;
  appendUserTurn(conversationId: string, text: string): Promise<void>;
  appendArtifact(conversationId: string, artifact: ArtifactRecord): Promise<void>;
  setActiveArtifact(conversationId: string, artifactId: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
}
```

Use a memory implementation in tests and IndexedDB in the browser. Store a schema version and migration function from the first release.

- [ ] **Step 4: Add bounded retention**

Default to retaining the latest 100 conversations locally; delete only when explicitly over the bound and never delete the currently open conversation. Expose this as a repository policy constant so future settings can change it without a data-shape migration.

- [ ] **Step 5: Run GREEN**

```bash
npm --prefix platforms/web test -- repository.test.ts
npm --prefix platforms/web run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add platforms/web/src/compose/repository.ts platforms/web/src/compose/conversation-state.ts platforms/web/tests/compose/repository.test.ts
git commit -m "feat(compose): persist local conversations and versions"
```

---

### Task 5: Build the chat shell, composer and adaptive interaction components

**Files:**
- Create: `platforms/web/src/compose/components/compose-shell.tsx`
- Create: `platforms/web/src/compose/components/conversation-list.tsx`
- Create: `platforms/web/src/compose/components/conversation-turn.tsx`
- Create: `platforms/web/src/compose/components/compose-composer.tsx`
- Create: `platforms/web/src/compose/components/instruction-artifact.tsx`
- Create: `platforms/web/src/compose/components/version-event.tsx`
- Create: `platforms/web/src/compose/components/decision-card.tsx`
- Create: `platforms/web/src/compose/components/boundary-card.tsx`
- Create: `platforms/web/src/compose/components/error-turn.tsx`
- Test: `platforms/web/tests/compose/composer.test.tsx`
- Test: `platforms/web/tests/compose/artifact.test.tsx`

**Interfaces:**
- Consumes: Task 1 visual contract, Task 3 presentation types, Task 4 repository/state.
- Produces: reusable Compose interaction components with accessible keyboard/touch behavior.

- [ ] **Step 1: Write composer interaction tests**

Cover: empty submit disabled, Enter submits, Shift+Enter newline, IME composition does not submit, draft callback fires, accessible name exists.

```tsx
it('does not submit while IME composition is active', async () => {
  const onSubmit = vi.fn();
  render(<ComposeComposer draft="" onDraftChange={() => {}} onSubmit={onSubmit} />);
  const input = screen.getByRole('textbox', { name: /message/i });
  fireEvent.compositionStart(input);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSubmit).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write artifact tests**

Verify copy/open/refinement affordances, semantic heading order, no execution button, version indicator and boundary summary.

- [ ] **Step 3: Run RED**

```bash
npm --prefix platforms/web test -- composer.test.tsx artifact.test.tsx
```

- [ ] **Step 4: Implement components from the approved concept**

Use semantic elements. Keep composer and core conversation components small enough that each owns one interaction responsibility. Avoid a monolithic `ComposePage` component.

- [ ] **Step 5: Add reduced-motion and focus-visible rules**

Use CSS/motion fallbacks so the same component remains usable with `prefers-reduced-motion: reduce`.

- [ ] **Step 6: Run GREEN plus accessibility smoke**

```bash
npm --prefix platforms/web test -- composer.test.tsx artifact.test.tsx
npm --prefix platforms/web run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add platforms/web/src/compose/components platforms/web/tests/compose
git commit -m "feat(compose): build conversation and artifact UI"
```

---

### Task 6: Wire compile, target selection, refinements and version lineage

**Files:**
- Create: `platforms/web/src/compose/use-compose.ts`
- Create: `platforms/web/src/compose/components/target-sheet.tsx`
- Create: `platforms/web/src/compose/components/refinement-sheet.tsx`
- Modify: `platforms/web/src/compose/components/compose-shell.tsx`
- Test: `platforms/web/tests/compose/flow.test.tsx`

**Interfaces:**
- Consumes: `compileIntent()`, presentation mapper, repository, components.
- Produces: end-to-end browser state flow from rough thought to versioned artifact.

- [ ] **Step 1: Write the state-flow test**

Use a mocked safe compile response and prove:

```text
submit source
-> source turn persists
-> loading state visible
-> artifact appears
-> target override recompiles from same source intent
-> refinement appends v2 with parentVersionId=v1
-> restoring v1 changes active pointer only
```

Also assert `write=[]` and `execute=[]` remain empty across refinements when the backend response has no such authority.

- [ ] **Step 2: Run RED**

```bash
npm --prefix platforms/web test -- flow.test.tsx
```

- [ ] **Step 3: Implement `useComposeConversation()`**

Expose a narrow interface:

```ts
export interface ComposeConversationController {
  conversation: ConversationRecord | null;
  submit(text: string): Promise<void>;
  retry(turnId: string): Promise<void>;
  changeTarget(target: string): Promise<void>;
  refine(operation: RefinementOperation): Promise<void>;
  restoreVersion(artifactId: string): Promise<void>;
  deleteConversation(): Promise<void>;
  status: 'idle' | 'understanding' | 'compiling' | 'refining' | 'ready' | 'error';
}
```

Persist the user turn before calling `compileIntent()`.

- [ ] **Step 4: Implement adaptive target/refinement surfaces**

On small viewports use accessible bottom-sheet behavior; on desktop use popover/panel behavior while preserving the same action model. Default target is `Auto`.

- [ ] **Step 5: Run GREEN**

```bash
npm --prefix platforms/web test -- flow.test.tsx
npm --prefix platforms/web run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add platforms/web/src/compose platforms/web/tests/compose/flow.test.tsx
git commit -m "feat(compose): wire compile and refinement flow"
```

---

### Task 7: Add mobile fullscreen artifact, desktop split workspace, share/copy and routes

**Files:**
- Create: `platforms/web/src/compose/components/artifact-workspace.tsx`
- Create: `platforms/web/src/compose/share.ts`
- Modify: `platforms/web/app/compose/page.tsx`
- Create: `platforms/web/app/compose/c/[conversationId]/page.tsx`
- Test: `platforms/web/tests/compose/sheets.test.tsx`
- Test: `platforms/web/tests/compose/share.test.ts`

**Interfaces:**
- Consumes: active artifact state and conversation repository.
- Produces: responsive workspace mode, durable conversation routes and safe share/copy behavior.

- [ ] **Step 1: Write responsive/workspace tests**

Verify the route opens a conversation by id; artifact open state renders as fullscreen/dialog semantics on mobile and side workspace semantics at desktop breakpoint.

- [ ] **Step 2: Write share/copy fallback tests**

```ts
it('uses Web Share when available', async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { share });
  await shareArtifact({ title: 'Instruction', text: 'Do the work' });
  expect(share).toHaveBeenCalled();
});
```

Add fallback to clipboard when Web Share is unavailable or rejected without destroying artifact state.

- [ ] **Step 3: Run RED**

```bash
npm --prefix platforms/web test -- sheets.test.tsx share.test.ts
```

- [ ] **Step 4: Implement responsive artifact workspace**

At desktop breakpoint, conversation and artifact remain visible together. On mobile, artifact uses a focused fullscreen layer with safe-area padding and deterministic focus return to the originating card when closed.

- [ ] **Step 5: Implement routes and history navigation**

`/compose` creates/opens the current conversation. `/compose/c/[conversationId]` reads local history by id and renders a not-found/removed state without server data leakage.

- [ ] **Step 6: Run GREEN**

```bash
npm --prefix platforms/web test -- sheets.test.tsx share.test.ts
npm --prefix platforms/web run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add platforms/web/app platforms/web/src/compose platforms/web/tests/compose
git commit -m "feat(compose): add responsive artifact workspace and sharing"
```

---

### Task 8: Make Compose an installable private PWA and wire safe reverse-proxy deployment

**Files:**
- Create: `platforms/web/app/manifest.ts`
- Create: `platforms/web/src/pwa/register.ts`
- Create: `platforms/web/public/icons/compose-192.png`
- Create: `platforms/web/public/icons/compose-512.png`
- Create: `platforms/web/public/icons/apple-touch-icon.png`
- Modify: `platforms/web/next.config.ts`
- Modify: private deployment/reverse-proxy config already used by Studio, or create a narrowly scoped Compose config under `deploy/compose-web/` if none exists.
- Test: `platforms/web/e2e/compose.spec.ts`

**Interfaces:**
- Consumes: build output and existing Studio API origin.
- Produces: secure-context installable Compose PWA with same-origin `/api/v1/intent/compile` path.

- [ ] **Step 1: Write E2E release-path test**

Playwright must cover fixture-backed flow:

```ts
test('Compose primary flow persists and versions an artifact', async ({ page }) => {
  await page.goto('/compose');
  await page.getByRole('textbox', { name: /message/i }).fill('make this execution ready');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByRole('article', { name: /instruction/i })).toBeVisible();
  await page.getByRole('button', { name: /refine/i }).click();
  await page.getByRole('option', { name: /safer/i }).click();
  await expect(page.getByText(/v1.*v2/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('article', { name: /instruction/i })).toBeVisible();
});
```

Add mobile and desktop projects in Playwright config.

- [ ] **Step 2: Run RED**

```bash
npm --prefix platforms/web run e2e
```

Expected: FAIL until manifest/service worker/deployment harness exists.

- [ ] **Step 3: Add dedicated Compose manifest**

Manifest must use `/compose` as `start_url`, `standalone` display, approved icons, theme/background values from Task 1, and must not change the existing global Studio manifest behavior.

- [ ] **Step 4: Add safe PWA update lifecycle**

Service worker may cache static shell assets and local-only app resources. It must not indiscriminately cache `/api/` responses or authorization material. Surface update failure as diagnostics, not as an infinite reload loop.

- [ ] **Step 5: Configure private HTTPS reverse proxy**

Expose Next Compose and Studio API through one private HTTPS origin. Verify browser JS contains no provider credentials. Prefer the already-authorized private Tailscale path for first release.

- [ ] **Step 6: Run E2E GREEN**

```bash
npm --prefix platforms/web run e2e
```

Run both mobile-sized and desktop projects.

- [ ] **Step 7: Commit**

```bash
git add platforms/web deploy tests scripts package.json
git commit -m "feat(compose): ship private installable web app"
```

---

### Task 9: Visual fidelity, accessibility, performance and security release gate

**Files:**
- Modify: `platforms/web/e2e/compose.spec.ts`
- Create: `platforms/web/e2e/compose.visual.spec.ts`
- Create: `platforms/web/e2e/compose.a11y.spec.ts`
- Create: `docs/design/compose-web-v0-1/fidelity-ledger.md`
- Modify: root verification scripts as needed to include final Compose gates.

**Interfaces:**
- Consumes: approved concept images and complete web implementation.
- Produces: exact-SHA release evidence suitable for physical iPhone verification.

- [ ] **Step 1: Capture exact reference-sized browser screenshots**

Capture at minimum:

```text
393x852  main chat
393x852  artifact fullscreen
393x852  target/refinement sheet
1440x1024 desktop split view
393x852  compile error / decision state
```

- [ ] **Step 2: Compare implementation to concept and write fidelity ledger**

For each surface record at least five concrete comparisons: typography, spacing, palette, component anatomy, icon treatment, responsive behavior, motion/state behavior. Fix all agency-signoff-level mismatches before proceeding.

- [ ] **Step 3: Run accessibility tests**

Use axe in Playwright plus manual keyboard checks. Fail on critical/serious violations. Verify focus return, screen-reader names, generation completion/error announcements, reduced motion and no color-only meaning.

- [ ] **Step 4: Measure performance baseline**

Record first usable render, input responsiveness during a seeded long conversation, artifact-open latency after data exists, and bundle chunks. Heavy Shiki/diff modules must be lazy-loaded. Add a regression threshold only after the measured baseline is stable.

- [ ] **Step 5: Run secret/client-bundle audit**

Search built assets and browser storage for provider/API credentials and authorization headers. Expected: none.

- [ ] **Step 6: Run full repository gates on exact SHA**

```bash
git diff --check
npm test
npm run verify
npm run verify:platforms
npm run verify:compose-web
npm run verify:secrets
```

Also run web Playwright E2E/visual/a11y suites.

- [ ] **Step 7: Commit release-gate evidence**

```bash
git add platforms/web docs/design/compose-web-v0-1 package.json scripts tests
git commit -m "test(compose): close web product quality gates"
```

---

### Task 10: Physical iPhone Safari/Home Screen release proof

**Files:**
- Create: `docs/qa/compose-web-v0-1-iphone-release.md`
- Modify: PR/issue evidence only after every observed gate is complete.

**Interfaces:**
- Consumes: exact release SHA from Task 9 over private HTTPS.
- Produces: physical-device evidence that the product is genuinely usable without Expo Go.

- [ ] **Step 1: Open exact release in physical iPhone Safari**

Verify `/compose` loads over the selected private HTTPS origin with no certificate/security-context warning.

- [ ] **Step 2: Execute the real primary flow**

Record observed result for:

```text
open Compose
-> type/paste rough thought
-> submit
-> artifact appears
-> target override
-> Safer refinement
-> open artifact fullscreen
-> Copy
-> Share
-> return to conversation
-> reload
-> reopen from history
```

- [ ] **Step 3: Verify iOS-specific behavior**

Check software keyboard, safe-area insets, scroll anchoring, composer visibility, sheet gestures/focus, copy, native share sheet and no horizontal overflow.

- [ ] **Step 4: Install to Home Screen and relaunch**

Verify standalone launch, correct icon/name, `/compose` start route and local history after relaunch.

- [ ] **Step 5: Record exact evidence**

`docs/qa/compose-web-v0-1-iphone-release.md` must include release SHA, private origin class (not secrets), device/browser, each gate PASS/FAIL, screenshots where useful, and any intentional deviations.

- [ ] **Step 6: Final verification before completion claim**

Rerun the exact-SHA automated gates after any device-found fix. Do not call the task finished while the physical gate or CI differs from the recorded SHA.

- [ ] **Step 7: Commit device evidence**

```bash
git add docs/qa/compose-web-v0-1-iphone-release.md
git commit -m "docs(compose): record iPhone web release evidence"
```

---

## Plan Self-Review

### Spec coverage

- Chat-first mobile/desktop UX: Tasks 1, 5, 7.
- Instruction artifacts/adaptive cards/sheets: Tasks 1, 5, 6, 7.
- Existing compile API reuse: Tasks 3, 6, 8.
- Version lineage/refinements: Tasks 4, 6.
- Local history/drafts/deletion: Tasks 4, 6, 7.
- Private HTTPS/PWA: Task 8.
- Accessibility/performance/security: Task 9.
- Physical iPhone Safari/Home Screen proof: Task 10.
- No authority widening/direct execution: Global constraints, Tasks 3, 5, 6, 9.
- No big-bang Studio rewrite: architecture and Task 2 boundary.
- Visual source-of-truth and agency-level fidelity: Tasks 1 and 9.

### Type consistency

The plan consistently uses `InstructionArtifactModel`, `ConversationRepository`, `PresentationBlock`, `ComposeConversationController`, `compileIntent()`, and `/api/v1/intent/compile` across dependent tasks.

### Scope decision

Application Platform extraction beyond the proven Compose boundaries is intentionally deferred. This plan ships one independently useful product slice and only creates reusable contracts required by that slice.
