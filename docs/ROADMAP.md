# Aftergraph Canonical Roadmap

| Version | Tema | Hovedleverance | Exit gate |
|---|---|---|---|
| **V5.2** | Calm Intelligence | Stabil Chat / Work / Space, render scheduler, SSE-resync, mobile shell, Control/System | A11y + full release gate |
| **V6.0** | **Unified Intelligence OS** | Federation Kernel, Object Graph, Authority/Evidence Graph, Research, AVC, WORKS, WI, TG, AIE, Skills samlet i ét miljø | Cross-repo E2E + exact-head + clean ZIP verification |
| **V6.1** | **Live Federation** | Real-time adapters til alle repos, event normalization, health/drift, reconnect/resync, partial federation | Alle core engines kan gå offline/online uden falsk state |
| **V6.2** | **Universal Search & Context** | Federated search over work, research, agents, evidence, memory, repos, files og decisions | Search provenance + incomplete-result semantics |
| **V6.3** | **Capability Runtime** | Skills, agents, tools, models og providers som typed capabilities med policy/authority | Discovery ≠ grant; capability execution fully governed |
| **V6.4** | **Research OS** | Study/Experiment/Claim/Evidence/Paper surfaces + promotion pipeline | Research result kan aldrig implicit blive runtime authority |
| **V6.5** | **Venture OS** | AVC Product Cells, goals, budgets, opportunities, missions, outcomes og portfolio | Product Cell → mission → verified outcome E2E |
| **V7.0** | **Intent Operating System** | Universal Composer der omsætter menneskelig intent til research, plan, capabilities, approvals, work og outcomes | Intent → verified outcome på tværs af mindst 3 engines |
| **V7.1** | **Adaptive Workspace** | UI komponeres dynamisk efter intent/object/context, ikke faste routes | Typed schemas only, ingen arbitrary AI-generated HTML |
| **V7.2** | **Agent Society** | Multi-agent teams, delegation topology, role composition, handoff og verifier separation | Agent må aldrig selv udvide sin authority |
| **V7.3** | **Temporal Intelligence** | Full replay, historical state, counterfactual views, future trajectory | Reproducérbar state reconstruction |
| **V7.4** | **Outcome Economy** | Cost, budget, CPVO, effort, resource use, outcome settlement | Financial provenance på alle consequential missions |
| **V8.0** | **Institutional Intelligence** | Governance, organizations, policies, institutions og multi-tenant agent systems som first-class graph | Cross-org authority isolation + external conformance |
| **V8.1** | **Distributed Aftergraph** | Flere nodes, devices og runtimes, edge/local/cloud federation | Offline-first + eventual convergence uden authority leakage |

> **V8.1-A** — audit/remediation-strømmen er navngivet separat fra roadmap-milepælen; se `docs/V8.1-DISTRIBUTED-DEFERRAL.md` for scope og exit gates.
| **V8.2** | **Personal + Organizational Brain** | Unified memory/knowledge med provenance, retention, confidence og promotion | Ephemeral knowledge kan ikke blive authoritative uden promotion |
| **V8.3** | **Autonomous Operations** | Proactive missions, incident response, maintenance, recurring workflows | Autonomy bounded af budgets, policy, evidence og kill switches |
| **V9.0** | **Verified Autonomous Organization** | Hele loopet fra mål → strategi → arbejde → verification → learning → næste mål | Langvarig autonom drift med human sovereignty |
| **V10.0** | **Aftergraph Platform** | Public SDK, integration protocol, external runtime adapters, ecosystem | Tredjepart kan integrere uden intern Aftergraph-kode |

## V6 Family

V6.0 is the foundation. One object across systems without authority leakage:

```text
Customer problem
     ↓
WI Observation
     ↓
WorkItem
     ↓ human promotion
WORKS Work
     ↓
AVC/Hermes Agent
     ↓
AIE delegation
     ↓
TG governed action
     ↓
Evidence
     ↓
Verified Outcome
     ↓
ISR research feedback
```

## V7: Intent Operating System

Intent resolution:
```text
Intent → Research plan → Relevant repo/object context → Capabilities → Research agents → Experiment → Evidence → Decision → Implementation mission → Authority / approval → WORKS execution → Verifier → Outcome
```

## V8: Institutional Intelligence

```text
Organization
 ├─ Humans
 ├─ Agents
 ├─ Policies
 ├─ Budgets
 ├─ Capabilities
 ├─ Knowledge
 ├─ Ventures
 ├─ Research
 └─ Evidence
```

Mandate:
```text
Company A grants Team B delegated capability C for purpose D under budget E until time F requiring evidence G
```

## V9: Verified Autonomous Organization

Sustained correct state, bounded authority, recovery, evidence, economic accounting, and verified outcomes across multi-week cycles.

## V10: North Star Architecture

```text
                   AFTERGRAPH

              Human Intent / Goals
                       │
             Intent Composition
                       │
                Object Graph
        ┌──────────────┼──────────────┐
        │              │              │
   Authority       Evidence      Capability
      Graph          Graph          Graph
        │              │              │
        └────────── Federation ───────┘
                       │
 ┌────────┬────────┬────────┬────────┬────────┐
 │   TG   │ WORKS  │  AVC   │  AIE   │   WI   │
 ├────────┼────────┼────────┼────────┼────────┤
 │ Skills │  ISR   │ Brain  │Connect │Future… │
 └────────┴────────┴────────┴────────┴────────┘
                       │
               Verified Outcomes
                       │
                  Learning
```
