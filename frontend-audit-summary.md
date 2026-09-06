# V8.1 Frontend UI/UX Hardcode & Quality Audit Summary

Revision: `7b5dafb9aaeba3bbee789aae828999554aafb849`  
Scope: `151` frontend source files under `src/`, `packages/`, and `styles/`.

## Verdict

PROPOSAL / AUDIT COMPLETE — no blind mass-refactor performed. The repository now has a machine-readable scan, ownership classifications, and an actionable TODO backlog.

## Totals

- Audit categories reviewed: **100**
- Concrete TODO findings: **20**
- P0 findings: **3**
- P1 findings: **14**
- P2 findings: **3**
- P3 findings: **0**
- Deterministic raw color matches: **1100**
- Deterministic raw dimension matches: **571**
- Deterministic typography declarations: **753**
- Deterministic status literal matches: **221**
- Deterministic debug/debt marker matches: **275**

## Highest-risk findings

1. **P0 HC-F — Runtime mock data mixed with initial production shell state** (`src/state.mjs`).
2. **P0 HC-F — Backend response assumptions lack one validation boundary** (`src/backend-reconciliation.mjs`, `src/runtime/*`).
3. **P0 HC-I — Destructive action protection is not one shared primitive** (`src/app/bootstrap.mjs`, Control/trust UI).
4. **P1 HC-B — Raw color and spacing clusters bypass semantic ownership** (`styles/views.css`, `styles/components.css`).
5. **P1 HC-E — Navigation/domain metadata is split across registries** (`src/domain.mjs`, `src/router.mjs`, `src/workspace-shell.mjs`).

## Required deliverables

- `frontend-hardcodes.json` — 100 category records, raw scan counts, samples, classifications, duplicate clusters and finding IDs.
- `frontend-todos.md` — concrete TODOs with location, problem, ownership, dependencies, acceptance criteria, priority, scope and auto-fix safety.
- This summary — totals, P0/P1 queue, method and boundaries.

## Duplicate-value clusters

The scan found repeated literal clusters including `1px`, `8px`, `10px`, `9px`, `12px`, `18px`, `#F5F7FA`, `#42C7E8` and `#080C14`. These are leads for semantic mapping, not safe global replacements.

## Verification boundary

The audit is source-backed and reproducible at the recorded revision. Rendered responsive/accessibility claims remain bounded by the existing browser and Axe gates; the next audit slice should add the declared 320/390/768/1024/1440/1920 viewport matrix before refactoring P1 layout findings.

## Next governed slice

Start with V81-007, V81-015 and V81-016 only after owner review. Refactor one category at a time, rerun the full suite after each slice, and do not treat a token move as a correctness fix without visual and accessibility evidence.
