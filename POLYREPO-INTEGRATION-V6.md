# Aftergraph V6 Polyrepo Integration Guide

**Version:** 6.0.0  
**Date:** 2026-09-06  
**Scope:** Federated Multi-Repo Intelligence Operating Environment

---

## 1. Overview

Aftergraph V6 connects all 8 canonical repositories into a single operating environment without centralizing canonical authority into a physical monorepo.

Each participating repository is described by a typed `AGIntegrationManifest` declaring its:
- roles (`runtime-enforcement`, `durable-execution`, `observation`, `proposal-only`, `research`, `capability-vault`, `company-kernel`, `governance`)
- authority declarations and permissible operations
- object families and relation schemas
- read and write endpoints
- evidence classes and verification requirements
- degraded behavior policies (reads: `stale` | `empty` | `block`, writes: `block`)
- compatibility constraints (`exact-or-declared`)

---

## 2. Participating Systems & Boundaries

| System | Role | Execution Authority | Evidence Authority |
|---|---|---|---|
| **Trust Gateway** | Runtime enforcement & approvals | Exclusive for approvals & action gates | Policy & audit records |
| **WORKS** | Durable execution | Exclusive for WorkGraph & missions | Verification & outcome evidence |
| **Work Intelligence V2** | Observation & proposals | Strictly `none` (`WorkItem != Work`) | Detection signals |
| **Work Intelligence Web** | Workspace surface donor | Strictly `none` | Presentation only |
| **AIE** | Institutional authority & delegation | Authority delegation & revocation | Conformance assertions |
| **AVC** | Company Kernel & agent workforce | Agent missions & product cell goals | Agent trajectory & evals |
| **Skills Vault** | Curated capability library | Discovery only (`Discovery != Grant`) | Capability metadata |
| **ISR Research** | Programs, studies, experiments | Strictly `none` (`Claim != Authority`) | Scientific evidence & papers |
| **Governance** | Cross-repo contracts & truth | Boundary definitions | Cross-system attestation |

---

## 3. Read vs Consequential Write Flows

### Read Path (Safe & Resilient)
- `POST /api/v1/upstreams/sync` and `/api/v1/federation/reconcile` pull read-only projections.
- An unavailable integration degrades only its own objects (marked `stale` or `unavailable`).
- Background synchronization NEVER steals human navigation, active conversation, or composer focus/caret/draft.

### Consequential Write Path (Governed & Non-Optimistic)
- Consequential writes (`executeConsequentialWrite`) verify that the target integration state is `current` and matches the pinned revision.
- Writes route directly to the canonical owner adapter.
- The UI displays explicit progression (`submitted` → `resyncing`) and NEVER renders optimistic success before the canonical engine confirms.
- If the authority rejects or the network fails, the operation fails visibly with the canonical rejection reason intact.

---

## 4. Revision Drift & Failure Policies

- If a repository revision drifts from the pinned exact-head, unsafe writes are automatically disabled (`canWrite() === false`).
- Read-only views remain accessible when safe (`canRead() === true`).
- Search reports partial coverage (`complete: false`, `unavailable: [...]`) rather than falsely claiming completeness during an outage.
- Stale evidence records remain labeled `stale` and can never be upgraded to newly verified without fresh re-attestation.
- Cross-tenant relationships fail closed.
- Zero bearer tokens, credentials, or API keys are ever serialized into browser-accessible state.
