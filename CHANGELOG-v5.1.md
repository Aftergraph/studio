# Aftergraph Workspace V5.1 — Polyrepo Integration

Date: 2026-09-06

## Added

- First-party integration adapters for Trust Gateway, WORKS, AIE and Work Intelligence V2.
- Governance mission lifecycle adapter and exact-head source-truth validation.
- Read-only upstream synchronization into Work, Brain, Control and System surfaces.
- Explicit service-owned consequential operations for TG approvals, WORKS bridge controls, AIE tasks/messages and WI review/promotion.
- Source-truth UI primitives with canonical owner, role and exact reviewed HEAD provenance.
- Polyrepo browser E2E using real HTTP adapters and durable V5 server state.
- Background reconciliation that preserves user-owned Chat/Work/Space and domain navigation during SSE/upstream updates.
- Exact contract materialization and release-time drift detection.
- `POLYREPO-INTEGRATION.md` and `upstreams.env.example`.

## Safety / authority boundaries

- Upstream sync is read-only.
- Work Intelligence remains detection/observation/proposal-only and cannot auto-execute.
- WI promotion requires explicit confirmation and a human actor before the request is delegated upstream.
- Credentials never enter browser projections, durable workspace state, screenshots or source-truth metadata.
- ISR remains research reference only.

## Transport limitation

A normal Git clone was attempted, but this container could not resolve `github.com`. Current readable default-branch heads and source contracts were therefore reviewed through the authenticated GitHub connector. The integration bundle distinguishes exact contract materialization from reviewed interface notes and does not describe inaccessible repositories as cloned.
