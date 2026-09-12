# Interaction Fabric v1 — Wave 2 Evidence

Evidence cut for Studio production experience persistence.

## Bound implementation

- Studio implementation SHA: `4863b9b7baad281bf431d3caff292e46a2678c9a`
- Base Wave 0/1 evidence SHA: `90515dddf97792c740b9fe9c65a2a839db1f13ce`
- Branch: `feat/studio-interaction-fabric-wave-2`
- Experience document schema: `aftergraph.studio-experience/1.0`
- Experience event schema: `aftergraph.experience-event/1.0`
- SQLite migration version: `1`
- SQLite driver: `better-sqlite3@13.0.3`
- SQLite engine observed: `3.53.4`

## Implemented scope

Wave 2 adds a transactional, tenant-bound Studio experience-state contract and SQLite adapter. The store persists only Studio-owned presentation/navigation state plus typed canonical references. It does not persist canonical upstream payload truth.

The adapter provides WAL-backed file storage, deterministic migration, optimistic versions, idempotent writes, ordered experience events, cursor reads, monotonic history pruning, explicit resync, integrity diagnostics, backup, close/reopen recovery, and a driver-neutral interface for a future managed-store adapter.

## Server composition

The production experience routes are available only when both an experience store and an injected `tenantBindingProvider` are configured. Studio does not derive tenant authority from actor identifiers.

Exposed routes:

- `GET /api/v1/experience`
- `PUT /api/v1/experience`
- `GET /api/v1/experience/events`

Conflict semantics are fail-closed: stale optimistic versions and conflicting idempotency-key reuse map to HTTP 409. Missing store or tenant binding maps to 503.

## Fresh verification at implementation SHA

Targeted command covered runtime/dependency contract, experience document boundary, driver contract, SQLite behavior, server routes, and API client.

Result: `24 passed, 0 failed`.

A full CI-equivalent run immediately before the final hardening commit produced `692 passed, 0 failed`; workspace verify, V6 secret scan, and production dependency audit all exited 0. A fresh post-evidence-commit full verification is required before closing the wave.

## Explicit non-claims

Wave 2 does **not** claim any of the following:

- no general Runtime `InteractionThread` / `InteractionTurn` adapter
- no canonical conversation persistence in Studio
- no WORKS durable execution ownership
- no Trust Gateway or AIE authority ownership
- no Sentinel verification ownership
- no PostgreSQL or managed multi-tenant adapter
- no cross-device Runtime continuity proof
- no Relay operator composition
- no L3, L4, or L5 platform conformance

The existing local Studio conversation path remains `reference-local` and `authoritative:false`. Wave 3 is responsible for the real Runtime interaction adapter; Wave 2 deliberately does not fake that seam inside Studio.

## Verification environment

The VDS baseline uses Node 22 and a CI-like Python environment containing Pillow and NumPy for visual-diff tests. The first raw full-suite attempt with system Python failed only because those visual-test dependencies were absent; the same known baseline requirement is documented in Wave 0/1 evidence.
