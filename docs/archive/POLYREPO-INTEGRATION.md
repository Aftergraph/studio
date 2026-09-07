> ⚠️ **SUPERSEDED** — This V5.1 doc is archived. Current polyrepo plan: see `POLYREPO-INTEGRATION-V6.md`.

# Aftergraph V5.1 Polyrepo Integration

## Scope

This workspace connects the V5 Agentic Operating Environment to the canonical Aftergraph service boundaries that were independently readable at their verified default-branch heads on 2026-09-06.

The container could not resolve `github.com`, so a normal Git clone was attempted but could not complete. The connected GitHub source was therefore used to verify current heads, inspect source/API contracts, and materialize the exact contracts needed by the integration. `../upstreams/SOURCE-MATERIALIZATION.json` distinguishes byte-faithful contracts from reviewed interface notes. Nothing inaccessible is represented as cloned or live-connected.

## Ownership

| Layer | Canonical owner | V5.1 integration |
|---|---|---|
| Runtime enforcement, approvals, audit | Trust Gateway | `src/integrations/trust-gateway.mjs` |
| Durable Work, events, evidence, handoff, Brain | WORKS | `src/integrations/works.mjs` |
| Authority / A2A task operations | AIE | `src/integrations/aie.mjs` |
| Detection / observation / proposals | Work Intelligence V2 | `src/integrations/work-intelligence.mjs` |
| Cross-repo contracts | Governance | `src/integrations/governance.mjs` + materialized contracts |
| HCI/research constraints | ISR | Reference only; no runtime dependency |

Work Intelligence is intentionally proposal-only. It cannot auto-execute or silently become a WORKS Work. Promotion requires an explicit actor and confirmation, and the upstream Work Intelligence policy remains authoritative.

## Configuration

Copy `upstreams.env.example` into your process environment. Credentials are service-specific and are never serialized into workspace state or browser projections.

- `AFTERGRAPH_TG_URL`, `AFTERGRAPH_TG_TOKEN`
- `AFTERGRAPH_WORKS_URL`, `AFTERGRAPH_WORKS_TOKEN`, optional `AFTERGRAPH_WORKS_BRAIN_PREFIX`
- `AFTERGRAPH_AIE_URL`, optional `AFTERGRAPH_AIE_TENANT`
- `AFTERGRAPH_WI_URL`, `AFTERGRAPH_WI_TOKEN`

No AIE bearer scheme is invented by this workspace. The AIE adapter follows the reviewed A2A HTTP+JSON surface; deployment identity/TLS remains an AIE concern.

## Read path

`POST /api/v1/upstreams/sync` performs read-only projections from all configured services. It never approves, promotes, cancels, resumes, or executes anything. Background source-truth reconciliation updates upstream projections without stealing the user's Chat/Work/Space or domain navigation state.

## Consequential writes

Writes are explicit and service-owned:

- TG approval: `POST /api/v1/upstreams/trust-gateway/approvals/:id/decision`
- WORKS suspend/resume/cancel: `POST /api/v1/upstreams/works/:id/control`
- AIE task cancel/message: `/api/v1/upstreams/aie/...`
- WI review/promotion: `/api/v1/upstreams/work-intelligence/...`

WI promotion fails closed unless `confirmed: true` and a human `actor` are supplied. This local check supplements, never replaces, the upstream policy gate.

## Source truth and drift

`npm run verify:upstreams` compares the materialized upstream manifest with the exact revisions compiled into the integration and validates the mission-state, policy.token, and WI boundary contracts. A head mismatch is a release failure.

## Connector-limited repositories

Governance tracks additional private repositories including the agent workforce, skills library, and Work Intelligence web product. They were not independently readable through the available GitHub connector in this session, and Git transport was DNS-blocked. They are recorded as `tracked_but_not_materialized`, not silently mocked into the runtime.
