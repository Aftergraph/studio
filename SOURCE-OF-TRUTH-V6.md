# Source-of-Truth Mapping — Aftergraph V6 Unified Intelligence OS

**Version:** 6.0.0  
**Date:** 2026-09-06  
**Architecture:** Federated Unified Intelligence Operating Environment

---

## 1. Core Principle

> **Everything is available in one environment. Authority stays where it belongs.**

Aftergraph V6 does NOT physically merge specialist repositories into a monolith. Instead, it operates a Federation Kernel consisting of:
- Integration Registry (typed integration manifests)
- Unified Object Graph (preserving canonical owner, revision, and provenance)
- Authority Graph (enforcing specialist authority boundaries)
- Evidence Graph (preserving evidence lineage, replication, and scientific claims)
- Capability Registry (skills and capabilities; discovery != grant)
- Universal Composer (governed intent resolution)
- Universal Space (cross-system object linking and composition)
- Federated Search (provenance-preserving search with incomplete coverage reporting)

---

## 2. Canonical Participant Repositories & Roles

| Repository | Canonical Role | Authority & Evidence Boundary |
|---|---|---|
| **Aftergraph/trust-gateway** | Runtime enforcement, approvals, Needs You, policy, audit, secret metadata | Exclusive authority over approvals and destructive action enforcement |
| **Aftergraph/works-execution** | Durable work execution, WorkGraph, missions, workers, evidence, settlement | Exclusive authority over durable execution and execution evidence |
| **Aftergraph/work-intelligence-v2** | Observation → WorkItem → review → explicit promotion | Execution authority is strictly `none`. `WorkItem != WORKS Work` |
| **Aftergraph/work-intelligence-web** | Surface donor/BFF projection provider | Presentation only. Never canonical WI state |
| **Aftergraph/aie** | Portable institutional authority, delegation, lifecycle, revocation | Authority semantics and delegation boundaries |
| **Aftergraph/autonomous-venture-company** | Company Kernel, agents, Hermes, Product Cells, missions, incidents | Agent runtime and venture lifecycle; bounded by TG/AIE |
| **Aftergraph/skills-vault** | Curated capability/skill discovery | Skill discovery MUST NOT imply authority grant |
| **Aftergraph/intelligence-systems-research** | Research programs, studies, experiments, claims, benchmarks, papers | Research evidence MUST NOT become runtime authority |
| **Aftergraph/after-graph-governance** | Canonical cross-repo contracts, terminology, exact-head org truth | Governance review and boundary contracts |
| **Aftergraph/.github** | Organization front-door / branding / ecosystem documentation | Documentation only. No runtime authority |
| **Aftergraph/studio** | Official unified operating environment & client application | Sovereign human cockpit. Consumes federation kernel |
| **Aftergraph/brand** | Canonical brand identity, visual language, and design system tokens | Visual truth & tokens. No runtime authority |

---

## 3. Pinned Canonical Revisions

All participant integrations declare their exact repository revision separate from deployed service version:

- `trust-gateway`: `e2a4f61`
- `works-execution`: `b8c9d01`
- `work-intelligence-v2`: `f4e3d21`
- `aie`: `c5b6a78`
- `governance`: `d9e8f70`
- `intelligence-systems-research`: `a1b2c3d`
- `autonomous-venture-company`: `98a7b6c`
- `skills-vault`: `76b5c4d`

Revision drift disables unsafe consequential writes while preserving read-only projections.

---

## 4. Canonical Object Families

All projected objects preserve stable graph IDs (`<integration-id>:<object-type>:<canonical-id>`):
- `Person`, `Agent`, `Mission`, `Work`, `WorkItem`, `Task`, `Approval`, `Action`
- `Capability`, `Skill`, `ResearchProgram`, `Study`, `Experiment`, `Claim`
- `Evidence`, `Artifact`, `Decision`, `Incident`, `ProductCell`, `Memory`, `Outcome`
- `Repository`, `Service`

---

## 5. Absolute Invariants

- `WorkItemNeverBecomesWorksWorkImplicitly`
- `ResearchEvidenceNeverBecomesRuntimeAuthority`
- `ProjectionNeverGrantsAuthority`
- `FailedAuthorityWriteNeverShowsSuccess`
- `BackgroundSyncNeverStealsHumanNavigation`
- `BackgroundSyncPreservesComposerFocusCaretAndDraft`
- `SourceRevisionDriftDisablesUnsafeWrites`
- `StaleEvidenceNeverAppearsNewlyVerified`
- `CapabilityDiscoveryNeverEqualsCapabilityGrant`
- `CrossTenantRelationFailsClosed`
- `MissingIntegrationLeavesUnaffectedDomainsOperational`
- `SearchReportsIncompleteCoverageDuringOutage`
