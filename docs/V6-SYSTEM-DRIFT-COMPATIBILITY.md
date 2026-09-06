# Aftergraph V6 Exact-Head System Surface, Drift and Compatibility Guide

Date: 2026-09-06
Version: 6.0.0

## 1. Overview

The Aftergraph V6 System Surface (`SYSTEM`) provides runtime transparency and source-truth provenance across all federated participants without merging canonical authority boundaries.

Core Law:
> Everything is available in one environment. Authority stays where it belongs.

## 2. Canonical Participant Repositories and Exact-Head Pins

| Service / Participant | Canonical Role | Default Branch | Pinned Revision (SHA) | Authority Boundary |
|---|---|---|---|---|
| **Trust Gateway** (`trust-gateway`) | Runtime enforcement, policy, RBAC, audit, approval | `main` | `515f8f744ff9b0a14df7398e38693fd3ac7ab667` | Authorization truth for consequential writes |
| **WORKS** (`works`) | Durable execution, Work, WorkGraph, Brain | `main` | `3ea1a80494c38f3e422339db6efbf5a7935a48be` | Execution state, recovery, leases, execution evidence |
| **AIE** (`aie`) | Institutional authority, delegation, lifecycle | `main` | `3432834afd80e60009f1252a1801f21feb551b9b` | Normative authority & delegation contracts |
| **Work Intelligence V2** (`work-intelligence`) | Observation, WorkItems, proposals | `main` | `f5cd61ef02b858bcc31f2bb25a0bb792a3b46eeb` | Proposal-only. `WorkItem != WORKS Work` |
| **Governance** (`governance`) | Canonical contracts, schemas, mission states | `main` | `40226ebd03ef4c6f081229cce393b231009f0e18` | Organization-wide cross-repo contracts |
| **ISR Research** (`research`) | Studies, experiments, claims, replication | `main` | `d67354385ea94f45e2dad7e8362621a9dee31b2f` | Research claims & evidence; NO runtime authority |
| **AVC** (`avc`) | Venture Kernel, Hermes, Product Cells | `main` | `exact-head-avc` | Venture missions, cells, agent teams |
| **Skills Vault** (`skills-vault`) | Capability/skills catalog | `main` | `exact-head-skills` | Discovery only; discovery is not a grant |

## 3. Drift Detection and Fail-Closed Behavior

When a federated participant experiences revision drift or communication failure:
1. **SourceRevisionDriftDisablesUnsafeWrites**: Any detected mismatch between the pinned source revision and runtime service header disables consequential writes.
2. **MissingIntegrationLeavesUnaffectedDomainsOperational**: An outage in one participant degrades only its specific capabilities; unrelated surfaces remain operational.
3. **StaleEvidenceNeverAppearsNewlyVerified**: Cached or disconnected evidence is strictly marked `stale`. It is never upgraded to `current`.
4. **SearchReportsIncompleteCoverageDuringOutage**: When one or more integration indexes are unreachable, search results explicitly report `complete: false` and list the unavailable providers.
5. **Secret Redaction**: Credentials, tokens, and private keys are never exposed in browser projections or UI DOM elements.
