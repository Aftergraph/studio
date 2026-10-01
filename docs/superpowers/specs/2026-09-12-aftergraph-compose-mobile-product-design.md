# Aftergraph Compose Mobile Product Design

Date: 2026-09-12
Status: Approved product direction, implementation-planning input
Repository: `Aftergraph/studio`
Working product name: **Aftergraph Compose**
Brand form: **Aftergraph Compose / by Aftergraph**

## 1. Product intent

Aftergraph Compose is a real mobile application for quickly turning rough human thoughts into high-quality, agent-ready instructions.

The primary user experience is intentionally simple:

```text
open app -> dump thought -> improve -> choose/use target -> copy/share/send
```

The app is personal-first and mobile-first. It is not a generic enterprise prompt-management console in v0.1. The user should be able to write naturally, incompletely, and quickly, while the system structures the request into something that can be used directly with ChatGPT/Friday, Claude, Codex, Hermes, Muse, or another supported agentic surface.

The mobile product is the user-facing product. Intent Compiler is an internal Aftergraph capability beneath it.

## 2. Product promise

> You write the way you think. Aftergraph Compose turns it into the way an AI agent should be instructed.

The app must optimize for speed of thought capture, not configuration.

A user must not need to understand prompt engineering, system prompts, skill schemas, runtime routing, or Aftergraph internals to get value.

## 3. Aftergraph-native architecture

Compose must be developed as an Aftergraph product, not as an isolated utility that is integrated later.

The architectural path is:

```text
Aftergraph Compose mobile client
        |
        v
Studio Composer semantics
        |
        v
Intent Compiler
        |
        +--> target adapters
        +--> context enrichment
        +--> route plan
        |
        v
future Trust Gateway / Relay / Runtime integrations
```

### 3.1 Ownership boundaries

**Compose mobile client owns:**
- thought capture;
- target selection/override;
- refine actions;
- result presentation;
- copy/share actions;
- local recent-history UX;
- mobile interaction and accessibility.

**Studio Composer owns:**
- human input/context composition primitives;
- interaction semantics shared with other Studio surfaces.

**Intent Compiler owns:**
- canonical Intent IR;
- structural interpretation;
- target classification;
- target-specific rendering;
- semantic-preservation checks;
- side-effect-free route planning.

**Trust Gateway / Relay / Runtime own later:**
- authority decisions;
- approvals;
- real delivery;
- execution;
- runtime receipts and execution evidence.

The app must never silently absorb those authority boundaries.

## 4. Repository placement

Reuse the existing Studio mobile surface under `platforms/expo`.

Do not create a separate product repository for v0.1.

New product-specific mobile code should live under:

```text
platforms/expo/app/compose.tsx
platforms/expo/src/compose/
```

The semantic kernel should live under:

```text
packages/intent-compiler/
```

Existing `packages/composer` remains the shared input/context primitive and should only receive narrowly scoped integration changes.

## 5. Working name and branding

`Aftergraph Compose` is a working name, not an irreversible public naming claim.

The application must:
- use the canonical Aftergraph master brand;
- consume existing Studio/Brand OS design tokens and motion language;
- present itself as `Aftergraph Compose` or `Compose by Aftergraph` during the private product phase;
- avoid creating a standalone visual identity that conflicts with Aftergraph Brand OS;
- avoid legacy parent-brand names.

## 6. Core v0.1 user flow

### 6.1 Capture

The first screen is dominated by a large thought input.

The user may enter short fragments, long notes, pasted conversations, or imperfect instructions.

Examples:

```text
se vores repos igen og find hvad der mangler og få lukket det men ikke ødelæg ting der virker
```

```text
jeg vil have hermes checker det her hver morgen og skriver til mig kun hvis der er noget vigtigt
```

### 6.2 Improve

Primary action: `Improve`.

The system returns a structured interpretation plus an immediately usable instruction.

The default result view shows:
- `Understood as`;
- interpreted goal;
- material constraints;
- recommended target;
- improved instruction;
- copy/share actions.

The canonical IR stays hidden by default.

### 6.3 Target

Target defaults to `Auto`.

v0.1 visible targets:
- Friday / ChatGPT;
- Claude Code;
- Codex;
- Hermes;
- Generic.

Target selection changes rendering, not the source intent.

The user may override the recommendation before regenerating/rendering.

### 6.4 Refine

Provide quick, intent-preserving refinements:

- `Clearer`;
- `More autonomous`;
- `Safer`;
- `More detailed`;
- `Shorter`;
- `Execution-ready`.

These controls transform the compiled artifact while retaining the canonical source intent and recorded constraints.

No refinement may silently broaden authority.

### 6.5 Use

v0.1 actions:
- copy output;
- invoke native share sheet;
- return to edit source thought;
- save in local recent history.

Direct delivery into external agents is deferred until the relevant connector/runtime authority path exists.

## 7. Screen model

v0.1 uses three lightweight screens rather than reproducing all of Studio:

### Compose
Primary capture and generation surface.

### Result
Interpretation, target, final instruction, refinement controls, copy/share.

### Recents
Recent source thoughts and generated outputs stored locally on the device.

No dashboards, fleet controls, runtime graphs, or infrastructure settings appear in v0.1.

## 8. Intent data model

Compose uses `aftergraph/intent-ir/v0.1` as the internal source of truth.

Minimum v0.1 fields required by the mobile product:

```json
{
  "schema": "aftergraph/intent-ir/v0.1",
  "source": {
    "text": "raw thought",
    "surface": "compose-mobile"
  },
  "goal": {
    "statement": "...",
    "successCriteria": []
  },
  "artifact": {
    "kind": "task",
    "persistence": "ephemeral"
  },
  "constraints": [],
  "authority": {
    "read": [],
    "write": [],
    "execute": [],
    "network": [],
    "requiresApproval": []
  },
  "verification": {
    "required": false,
    "obligations": [],
    "completionRule": "model-output"
  },
  "output": {
    "format": "text",
    "contract": []
  },
  "targetHints": [],
  "ambiguities": []
}
```

The source thought must remain recoverable from history. Generated target output is derived data.

## 9. Improvement engine

The engine consists of two stages.

### 9.1 Analysis

Model-assisted extraction creates candidate semantics:
- requested outcome;
- context implied by the source text;
- constraints;
- persistence;
- target clues;
- completion expectations;
- material ambiguity.

Model output is not trusted as authority.

### 9.2 Deterministic compile

The resulting candidate is normalized and validated into Intent IR, then rendered through a target adapter.

The compiler must preserve:
- goal;
- constraints;
- authority restrictions;
- output expectation;
- verification/completion criteria;
- persistence class.

## 10. Target renderers v0.1

### Friday / ChatGPT
Produces a conversational but execution-ready task suitable for this assistant family.

### Claude Code
Produces repository-agent instructions with explicit scope, constraints, verification, and completion rules.

### Codex
Produces coding-agent instructions aligned with AGENTS-style execution expectations and repository precedence.

### Hermes
Produces goal-oriented autonomous-agent instruction text, preserving explicit authority boundaries and expected reporting.

### Generic
Produces a portable structured prompt without target-specific assumptions.

## 11. Personal usefulness before platform breadth

v0.1 success is not measured by number of integrations.

The product succeeds when the user can repeatedly turn rough personal thoughts into instructions that are materially better than manually written prompts and usable immediately from the phone.

This means v0.1 explicitly prioritizes:
- fast capture;
- high-quality transformation;
- target adaptation;
- copy/share;
- recents;
- Aftergraph-consistent internals.

It does not prioritize:
- organization administration;
- collaboration;
- billing;
- public accounts;
- marketplace;
- plugin installation UI;
- direct external writes;
- agent execution dashboards.

## 12. Mobile implementation strategy

Build the first real client using the existing Expo/React Native reference under `platforms/expo`.

The v0.1 code must remain compatible with the existing Studio mobile theme and motion primitives.

The first implementation should be runnable as an Expo app and structured so native capabilities can be added later:
- native share sheet;
- dictation/voice capture;
- Shortcuts/deep links;
- push notifications;
- app intents;
- platform share extension.

Voice capture itself is deferred unless the existing Expo environment already provides the required runtime dependency without destabilizing the current platform reference.

## 13. History

v0.1 keeps a bounded local recent history.

Each record stores:
- id;
- createdAt;
- source text;
- target id;
- interpreted goal;
- compiled output;
- refinement mode used.

No cloud synchronization is required in v0.1.

History must remain removable by the user and must not be represented as Aftergraph Context Continuity until a real Continuity integration exists.

## 14. Failure behavior

The product must fail visibly and conservatively.

Expected states:
- source is empty -> disable Improve;
- analysis fails -> preserve draft and show retry;
- target rendering fails -> preserve canonical analysis and permit Generic fallback;
- ambiguous material intent -> show the ambiguity before presenting output as execution-ready;
- unsupported target -> fall back to Generic, never silently fake target support;
- share/copy failure -> output remains selectable and visible.

The app must never destroy the user's source thought because generation failed.

## 15. Accessibility and interaction

Minimum requirements:
- mobile touch targets >= 44pt;
- Dynamic Type-safe layout where practical;
- screen-reader labels on capture, target, improve, refine, copy, share, and history actions;
- reduced-motion compliance using existing Studio motion policy;
- useful contrast under Aftergraph Brand OS;
- keyboard-safe input layout;
- no critical meaning communicated by color alone.

## 16. v0.1 acceptance criteria

The implementation is acceptable when all of the following are demonstrated:

1. The Expo client opens directly into a Compose-first mobile flow.
2. A rough thought can be entered and retained while navigating the flow.
3. `Improve` produces a validated canonical interpretation and usable output.
4. Auto-target recommends at least Friday/ChatGPT, Claude Code, Codex, Hermes, or Generic.
5. Manual target override re-renders from the same canonical intent.
6. Refine controls produce a new derived output without losing the original thought.
7. Copy works.
8. Native share works when supported by the running platform.
9. Recent items can be reopened and removed.
10. Failure does not erase source text.
11. The first slice performs no external write/delivery action.
12. Tests cover normalization, target rendering, authority preservation, mobile state flow, and history behavior.
13. `npm test` and repository `npm run verify` pass at the exact implementation SHA before completion is claimed.

## 17. Future connection points

After v0.1 proves daily usefulness, add adapters rather than redesigning the product core.

Planned extension seams:
- Context Continuity for durable cross-device context;
- Skills Vault / SABI for turning a thought into a reusable skill;
- Cron Fabric for `turn into automation`;
- MCP discovery for dynamic target capabilities;
- Trust Gateway for consequential delivery approval;
- Relay for observable delivery and operator control;
- Runtime for execution;
- GitHub, Gmail, Drive and other plugins/connectors as context/action providers;
- Share Extension and OS-level shortcuts for capture from other apps.

These integrations consume the same canonical Intent IR and must not change the basic mobile interaction promise.

## 18. Product principle

The default product should remain simpler than the infrastructure beneath it.

The user should see:

```text
Thought -> Better instruction -> Use it
```

Aftergraph may internally see:

```text
source -> analysis -> Intent IR -> target adapter -> semantic check -> route plan
```

Both views are correct. Only the first belongs on the main screen.
