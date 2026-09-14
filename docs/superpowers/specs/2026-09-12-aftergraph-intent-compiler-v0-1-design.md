# Aftergraph Intent Compiler v0.1 Design

Date: 2026-09-12
Status: Design candidate for implementation planning
Repository: `Aftergraph/studio`
Primary surface: `packages/composer` + new `packages/intent-compiler`

## 1. Problem

Aftergraph accepts human intent through Chat, Work, Space, CLI agents, skills, automations, and external agentic platforms. Today those surfaces can normalize input or execute target-specific instructions, but there is no canonical layer that turns rough human intent into a versioned, testable, target-independent instruction contract before rendering it for a specific platform.

The common workaround is direct prompt rewriting:

```text
raw text -> target prompt
```

That loses important semantics. It makes target output the de facto source of truth, mixes user intent with platform syntax, makes cross-target comparison difficult, and encourages unsafe direct writes because classification, authority, effects, routing, and verification are not separate stages.

Intent Compiler v0.1 changes the pipeline to:

```text
raw human intent
  -> analyze
  -> canonical Intent IR
  -> classify artifact semantics
  -> classify target
  -> compile target artifact
  -> validate
  -> produce route plan
```

The canonical Intent IR is the source of truth. Target prompts and files are compiled artifacts.

## 2. Repository reality

`packages/composer` already owns intent input normalization and the human-facing composer surface. It currently normalizes text, mode, attached context, and attachments and renders `AGIntentComposer`. It does not own semantic compilation, target classification, or routing.

Intent Compiler therefore lives beside Composer rather than inside it:

```text
packages/
  composer/          # human input and context composition
  intent-compiler/   # canonical semantics and compilation
```

This separation is deliberate. Composer may change interaction design without changing instruction semantics. Compiler internals may evolve without forcing UI consumers to understand target syntax.

## 3. Normative ownership boundary

Intent Compiler owns:

- interpretation of raw intent into canonical semantic fields;
- normalization and deterministic validation of Intent IR;
- artifact-semantic classification;
- target classification and confidence metadata;
- compilation from canonical IR into target-specific artifacts;
- static semantic-preservation checks;
- generation of a route plan describing what would be delivered where.

Intent Compiler does not own:

- execution;
- filesystem or repository write authority;
- approval authority;
- credential access;
- runtime capability binding;
- verification of real-world completion;
- scheduling infrastructure;
- durable skill conformance truth.

For SABI-backed skills, the existing invariant remains authoritative:

> SABI says WHAT must remain true. Runtime decides WHERE/HOW. Trust decides WHETHER.

Intent Compiler may produce a candidate skill package and may invoke or consume SABI validation, but it must not reimplement or impersonate SABI truth.

## 4. Approaches considered

### A. Prompt rewriter with target templates

Raw input is rewritten independently for each platform.

Pros:
- smallest implementation;
- fast demo.

Cons:
- no stable semantic source of truth;
- drift between targets;
- weak evaluation story;
- authority and effects remain implicit.

Rejected.

### B. Canonical Intent IR with target adapters

Raw input is normalized once into a target-independent contract. Adapters render that contract into platform-specific artifacts.

Pros:
- testable semantic preservation;
- versionable contracts;
- supports many targets without coupling the UI to them;
- clean authority boundary;
- aligns with SABI, Runtime, Relay, and Trust Gateway.

Cons:
- requires an explicit IR schema and migration discipline.

Chosen for v0.1.

### C. Fully generic agent graph compiler

Model every prompt, workflow, skill, tool, automation, memory object, and runtime plan as one general graph language immediately.

Pros:
- maximum theoretical expressiveness.

Cons:
- too broad for a first implementation;
- hard to validate;
- likely to duplicate WORKS, Runtime, and SABI concepts.

Deferred. Intent IR may later become one input to a broader graph model, but v0.1 stays narrow.

## 5. Canonical Intent IR v0.1

Schema id:

```text
aftergraph/intent-ir/v0.1
```

A canonical intent object has this logical shape:

```json
{
  "schema": "aftergraph/intent-ir/v0.1",
  "intentId": "stable-or-generated-id",
  "source": {
    "text": "raw human request",
    "surface": "studio",
    "actor": "human",
    "contextRefs": []
  },
  "goal": {
    "statement": "What outcome is requested",
    "successCriteria": []
  },
  "artifact": {
    "kind": "task",
    "persistence": "ephemeral"
  },
  "scope": {
    "includes": [],
    "excludes": []
  },
  "constraints": [],
  "authority": {
    "read": [],
    "write": [],
    "execute": [],
    "network": [],
    "requiresApproval": []
  },
  "capabilities": {
    "required": [],
    "optional": []
  },
  "effects": [],
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
  "ambiguities": [],
  "provenance": {
    "compilerVersion": "0.1.0",
    "sourceDigest": "sha256:..."
  }
}
```

### 5.1 Required invariants

A valid v0.1 Intent IR must:

1. identify the schema;
2. preserve the original source text or a digest-addressable equivalent;
3. contain a non-empty goal statement;
4. declare artifact kind and persistence;
5. make authority explicit, including empty authority sets;
6. separate required capabilities from effects;
7. declare the verification completion rule;
8. carry provenance sufficient to identify the compiler version and source digest;
9. never infer write or execution authority merely because the target technically supports it;
10. preserve unresolved material ambiguity in `ambiguities` rather than silently inventing a requirement.

## 6. Artifact semantics

`artifact.kind` is independent of target platform.

v0.1 supports:

- `task`: one bounded request;
- `policy`: persistent behavioral instruction;
- `skill`: reusable named capability;
- `workflow`: ordered or conditional multi-step behavior;
- `agent`: agent role/identity/operating contract;
- `automation`: trigger or schedule plus task/workflow semantics;
- `handoff`: continuation package for another agent or session.

Reserved for later versions:

- `memory` as a first-class writable artifact;
- `tool` or MCP tool implementation;
- general executable graph nodes.

Persistence values:

- `ephemeral`;
- `session`;
- `workspace`;
- `durable`.

## 7. Target model

Target classification is a separate dimension from artifact semantics.

Initial target ids:

- `generic.prompt`;
- `generic.system-instruction`;
- `anthropic.claude-code.claude-md`;
- `openai.codex.agents-md`;
- `agents.skill-md`;
- `aftergraph.runtime`;
- `aftergraph.hermes`;
- `mcp.prompt`.

Future adapters may add ChatGPT, Muse, Gemini, Cursor, Copilot, OpenCode, or other runtimes without modifying the canonical artifact taxonomy.

Each target classification returns:

```json
{
  "target": "agents.skill-md",
  "confidence": 0.94,
  "reasonCodes": ["reusable", "durable", "capability-shaped"],
  "alternatives": []
}
```

Confidence is descriptive metadata, not authority. A high-confidence target never grants permission to write it.

## 8. Compiler API

The package exposes small, deterministic boundaries.

Proposed public surface:

```js
normalizeIntentIR(input)
validateIntentIR(ir)
classifyArtifact(ir)
classifyTarget(ir, environment)
compileIntent(ir, target, options)
checkSemanticPreservation(ir, compiledArtifact)
planRoute(ir, compiledArtifact, environment)
```

### 8.1 `normalizeIntentIR`

Produces stable ordering, defaults, canonical empty collections, normalized enums, and deterministic provenance fields. It does not call a model.

### 8.2 `validateIntentIR`

Performs structural and invariant checks. Invalid objects return findings, not best-effort silent repair.

### 8.3 `classifyArtifact`

May consume already extracted semantic fields and returns artifact kind plus evidence. v0.1 should allow a caller to override model-assisted classification before compilation.

### 8.4 `classifyTarget`

Ranks target adapters from artifact semantics plus the declared environment. It must support `COPY_ONLY` and `EXPORT_ONLY` targets as valid outcomes.

### 8.5 `compileIntent`

Is a pure transformation from valid canonical IR into an artifact object:

```json
{
  "target": "openai.codex.agents-md",
  "mediaType": "text/markdown",
  "content": "...",
  "semanticMap": {
    "goal": ["section:Goal"],
    "constraints": ["section:Constraints"],
    "authority": ["section:Authority"],
    "verification": ["section:Completion"]
  }
}
```

The `semanticMap` gives preservation checks a target-aware way to trace canonical fields to rendered output.

### 8.6 `planRoute`

Returns intent, never performs delivery:

```json
{
  "mode": "COPY_ONLY",
  "destination": null,
  "requiresApproval": false,
  "requiredCapabilities": [],
  "blockers": []
}
```

Supported route modes:

- `COPY_ONLY`;
- `EXPORT_ONLY`;
- `DELIVERABLE_PENDING_APPROVAL`;
- `DELIVERABLE`;
- `BLOCKED`.

Actual delivery belongs to Runtime/Relay/integration adapters after the appropriate trust decision.

## 9. Model-assisted analysis boundary

The analysis stage may use a language model to extract candidate semantics from raw text, but model output is untrusted candidate data.

Pipeline:

```text
raw source
  -> model-assisted extraction
  -> deterministic normalization
  -> deterministic validation
  -> user/environment override if needed
  -> canonical Intent IR
```

The model must not directly select irreversible delivery actions. It may propose authority/effects, but any consequential authority remains explicitly represented and governed downstream.

A deterministic fallback path must allow callers to construct Intent IR without model access.

## 10. Target adapters v0.1

### 10.1 `generic.prompt`

Purpose: one-shot copy/paste output.

Required semantic sections:

- goal;
- context/scope;
- constraints;
- expected output;
- completion/verification expectations where present.

### 10.2 `generic.system-instruction`

Purpose: persistent behavioral instruction where no platform-specific durable file contract is known.

Must distinguish persistent policy from one-shot task content.

### 10.3 `agents.skill-md`

Purpose: candidate reusable skill artifact.

Compiler responsibility ends at candidate generation. SABI validation and requirement-object export remain authoritative outside the compiler package.

When a candidate skill requires capabilities/effects, the adapter must preserve enough structured sidecar information for SABI packaging rather than flattening all semantics into prose.

### 10.4 `anthropic.claude-code.claude-md`

Purpose: durable repository/workspace instructions for Claude Code.

Must not embed ephemeral task requests into persistent policy unless the Intent IR explicitly marks persistence accordingly.

### 10.5 `openai.codex.agents-md`

Purpose: repository/workspace execution guidance for Codex-style AGENTS contracts.

Must preserve scope and verification rules and avoid claiming that generated guidance supersedes higher-precedence repository contracts.

### 10.6 `aftergraph.runtime`

Purpose: structured task/agent candidate for Aftergraph Runtime.

Compiler emits the candidate contract only. Runtime owns binding and execution.

### 10.7 `aftergraph.hermes`

Purpose: Hermes-compatible candidate instruction/skill/automation representation.

Scheduling remains an external routing/runtime concern.

### 10.8 `mcp.prompt`

Purpose: reusable MCP prompt representation when a compatible destination advertises prompt support.

Capability discovery may influence route planning, but discovered server capability never implies write authority.

## 11. Semantic preservation

The primary correctness question is not whether the target artifact is well written. It is whether compilation preserves the material semantics of the canonical IR.

v0.1 preservation dimensions:

- goal;
- scope;
- constraints;
- authority restrictions;
- capability requirements;
- expected output;
- verification/completion rule;
- persistence class.

A compiler must fail closed when a required semantic dimension cannot be represented safely by the target.

Example:

```text
Intent IR requires read-only behavior
Target template implies autonomous writes
=> compilation finding: AUTHORITY_EXPANSION
=> route plan: BLOCKED
```

No adapter may silently broaden authority.

## 12. Effects and capability model

Capabilities answer what the target/runtime must be able to do.

Effects answer what observable side effects the compiled behavior is permitted or expected to cause.

Those concepts remain separate.

Example:

```json
{
  "capabilities": {
    "required": ["github.read", "tests.execute"]
  },
  "effects": [
    {"kind": "process.execute", "scope": "tests", "allowed": true},
    {"kind": "repository.write", "allowed": false}
  ]
}
```

For `skill` artifacts, the SABI effect/capability contract remains the downstream source of truth once the skill package is materialized and validated.

## 13. Studio UX v0.1

Composer stays simple.

Primary flow:

```text
raw input
 -> Compile
 -> Understood As
 -> Target recommendation
 -> Compiled preview/diff
 -> Route status
```

The default surface shows:

- interpreted goal;
- artifact kind;
- recommended target + confidence;
- material authority/effects;
- compiled artifact preview;
- route mode.

An advanced inspector may show:

- canonical Intent IR;
- alternatives;
- semantic map;
- validation findings;
- source/IR/artifact digests.

The UI must distinguish `compiled`, `validated`, `deliverable`, `delivered`, and `verified`. These states are not synonyms.

## 14. Safety and authority rules

1. Compilation is side-effect free.
2. Route planning is side-effect free.
3. No target adapter writes to disk, GitHub, MCP servers, agent config, or runtime state.
4. Consequential delivery requires a separate delivery interface and the appropriate trust/approval decision.
5. Target capability does not imply user authority.
6. Model confidence does not imply user authority.
7. Compilation may reduce authority to fit a target but must never expand it silently.
8. Unknown authority defaults closed.
9. A compiled artifact may be useful while route status remains `BLOCKED`.
10. Delivery success does not equal verified task completion.

## 15. Error model

Findings have stable codes and severity.

Initial categories:

- `IR_INVALID`;
- `AMBIGUOUS_MATERIAL_INTENT`;
- `UNSUPPORTED_ARTIFACT_KIND`;
- `UNSUPPORTED_TARGET`;
- `CAPABILITY_MISSING`;
- `SEMANTIC_LOSS`;
- `AUTHORITY_EXPANSION`;
- `PERSISTENCE_MISMATCH`;
- `VERIFICATION_UNREPRESENTABLE`;
- `DELIVERY_NOT_AUTHORIZED`.

Compilation returns structured findings rather than throwing for expected unsupported combinations. Programmer errors may still throw.

## 16. Testing strategy

### 16.1 Unit tests

Cover:

- canonical normalization;
- schema/invariant validation;
- artifact classification fixtures;
- target classification fixtures;
- each adapter independently;
- route mode selection;
- finding codes.

### 16.2 Golden semantic fixtures

Create a small frozen corpus of raw intents and canonical expected IR objects.

Initial cases:

1. one-shot coding task;
2. persistent repository policy;
3. reusable skill;
4. recurring automation request;
5. read-only review with explicit no-write constraint;
6. ambiguous request where persistence cannot safely be inferred.

### 16.3 Cross-target preservation tests

Compile one canonical IR into multiple targets and assert preservation of material dimensions rather than exact prose.

### 16.4 Adversarial tests

Required cases:

- target template attempts to introduce writes into read-only intent;
- persistent target receives ephemeral task;
- runtime lacks a required capability;
- unknown target;
- malformed model-assisted extraction;
- verification requirement cannot be represented.

### 16.5 Integration boundary tests

For skill output, verify compiler output can be handed to the real SABI path without claiming SABI conformance before that validation succeeds.

For route planning, verify no test path performs delivery.

## 17. Initial implementation slice

The first implementation plan should remain intentionally narrow:

1. add `packages/intent-compiler/`;
2. implement canonical schema/constants, normalization, validation, and digest helpers;
3. implement deterministic artifact/target classification rules with override support;
4. implement `generic.prompt`, `generic.system-instruction`, `agents.skill-md`, `anthropic.claude-code.claude-md`, and `openai.codex.agents-md` adapters;
5. implement semantic-map based preservation checks;
6. implement route planner with no delivery capability;
7. add golden/adversarial tests;
8. expose a minimal bridge from existing `packages/composer` output to compiler input without redesigning Composer UI in the same change.

Deferred to later slices:

- live LLM extraction service;
- Trust Gateway approval calls;
- Relay/Runtime delivery;
- direct GitHub or filesystem writes;
- MCP discovery calls;
- Hermes scheduling;
- full Studio visual workflow;
- Skillport benchmark campaign.

This ordering produces a useful semantic kernel before connecting any consequential action surface.

## 18. Success criteria for v0.1

The first implementation is successful when:

1. six frozen intent fixtures normalize to deterministic valid IR;
2. the same valid IR can compile to at least three materially different target representations;
3. semantic preservation tests prove goal, scope, constraints, authority, output, verification, and persistence are not silently dropped;
4. read-only intent cannot compile into an artifact that grants write authority without producing `AUTHORITY_EXPANSION` and a blocked route;
5. ephemeral intent is not silently persisted into CLAUDE.md/AGENTS.md;
6. skill output remains explicitly candidate/unvalidated until the real SABI validation path accepts it;
7. route planning performs no external write or execution;
8. existing Studio test/verify suites stay green at the exact implementation SHA.

## 19. Versioning

`aftergraph/intent-ir/v0.1` is additive-only during the v0.1 implementation cycle.

Breaking field removal, semantic reinterpretation, or type change requires a new schema id.

Target adapters carry independent adapter versions so rendered output may improve without rewriting historical Intent IR.

Recommended compiled artifact provenance:

```json
{
  "intentSchema": "aftergraph/intent-ir/v0.1",
  "compilerVersion": "0.1.0",
  "adapter": "openai.codex.agents-md",
  "adapterVersion": "0.1.0",
  "sourceDigest": "sha256:...",
  "intentDigest": "sha256:...",
  "artifactDigest": "sha256:..."
}
```

## 20. Decision summary

- Intent IR is source of truth; target prompts/files are compiled artifacts.
- `packages/composer` remains the human-input surface.
- new `packages/intent-compiler` owns canonical semantics and pure compilation.
- artifact semantics and runtime target are separate classification axes.
- v0.1 compilation and route planning are side-effect free.
- Trust, Runtime, Relay, SABI, and verification keep their existing authority boundaries.
- semantic preservation is the primary compiler correctness property.
- no new repository is required for the first implementation.
