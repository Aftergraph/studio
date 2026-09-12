# Studio Interaction Fabric Wave 2 — Production Experience Store

**Goal:** Replace JSON-only production assumptions with a transactional, tenant-bound Studio experience store while preserving the legacy JSON path as explicit reference compatibility.

**Baseline:** `90515dddf97792c740b9fe9c65a2a839db1f13ce`

**Non-goals:** Runtime InteractionThread/Turn persistence, WORKS durable work, Trust/AIE authority, Sentinel verification truth, managed PostgreSQL implementation, or migration of legacy local conversations into canonical interaction truth.

## Architecture decision

Use `better-sqlite3@13.0.3` for the local/private production adapter. The package supports Node >=22 and avoids relying on Node 22's experimental `node:sqlite` surface. CI becomes dependency-aware with `npm ci`.

The storage interface remains driver-neutral so a PostgreSQL adapter can implement the same logical contract later.

Every production write is tenant-bound, transactionally versioned, idempotent, and emits an ordered experience event. Optimistic version conflicts fail closed. Missing event history produces an explicit resync requirement.

## Task 1 — Dependency and CI contract

Files:
- Modify `package.json`
- Create `package-lock.json`
- Modify `.github/workflows/ci.yml`
- Create `tests/persistence-runtime-contract.test.mjs`

RED: assert `better-sqlite3` is resolvable and the package engine remains Node >=22.

GREEN: add exact dependency `better-sqlite3@13.0.3`, generate lockfile, and add `npm ci` before Node verification in CI.

Gate: existing `npm test` and `npm run verify` remain green after dependency installation.

## Task 2 — Closed Studio experience document

Files:
- Create `src/persistence/experience-document.mjs`
- Create `tests/experience-document.test.mjs`

Define `createExperienceDocument(input)` for Studio-owned state only: tenant id, Projects, Recents, layout, surfaces, preferences, active project, and presentation metadata.

Reject embedded conversations, Runtime threads/turns, missions, approvals, authority, execution, verification, memory, agents, credentials, and unknown top-level fields. Freeze nested state and enforce same-tenant references.

## Task 3 — Transactional SQLite adapter

Files:
- Create `src/persistence/experience-store-contract.mjs`
- Create `src/persistence/sqlite-experience-store.mjs`
- Create `tests/sqlite-experience-store.test.mjs`

Schema v1 stores: migrations, one versioned experience document per tenant, idempotency records, ordered experience events, and per-tenant history floor.

On open: enable WAL, foreign keys, busy timeout and durable synchronous mode; run deterministic migrations in a transaction.

`write()` requires tenant id, expected version and idempotency key. A successful write increments the tenant version exactly once and appends an event in the same transaction. Replaying the same key and payload returns the original result; reusing the key for another payload fails closed. Stale expected versions return `version_conflict`.

`read()` returns `{tenantId, version, document}`. The adapter exposes `integrityCheck()` and `close()` and conforms to the driver-neutral store contract.

## Task 4 — Delta cursor and explicit resync

Extend SQLite tests and implementation with `readEvents(tenantId,{after,limit})` and `pruneEventsThrough(tenantId,sequence)`.

Events are ordered by the same monotonically increasing version written with the document. Duplicate delivery cannot duplicate a sequence. If a caller's cursor is older than the retained history floor, return `resyncRequired:true` with current version and no fabricated gap fill.

## Task 5 — Backup, recovery and restart proof

Add behavioral tests that:
- close and reopen the database without state loss,
- reject a failed transaction without partial document/event/idempotency state,
- pass `PRAGMA quick_check`,
- create a restorable SQLite backup and reopen it independently.

No test may accept a successful API return as recovery proof without reopening the persisted database.

## Task 6 — Server composition seam without fake tenant authority

Files:
- Create `server/experience-routes.mjs`
- Modify `server/app-server.mjs`
- Modify `src/api-routes.mjs`
- Modify `src/api-client.mjs`
- Create `tests/experience-routes.test.mjs`

`createAppServer` may receive `experienceStore` plus an injected `tenantBindingProvider(req)`. Without both, the production experience route is unavailable rather than treating actor id as tenant id.

Expose read/write/delta endpoints for Studio experience state. Writes require idempotency key and expected version. The route projects store errors into stable 409/422/503 responses and never mints tenant authority.

## Task 7 — Evidence and exit gate

Create `evidence/interaction-fabric-v1/wave-2/README.md` with exact source SHA, driver version, SQLite version, migration version, commands, test counts and explicit non-claims.

Required targeted tests cover document boundaries, store contract, WAL/migration, tenant isolation, optimistic conflict, idempotent replay/conflict, event ordering, resync after pruning, failed transaction rollback, restart, integrity and backup restore, plus server routes with and without injected tenant binding.

Run full `npm test`, `npm run verify`, secret scan, `git diff --check`, and dependency audit. No Wave 3 work begins until these gates are green.

## Exit condition

Wave 2 is complete only when Studio has a real transactional SQLite experience-state implementation with durable restart/recovery behavior and an authority-safe server seam, while the old JSON conversation path remains explicitly `reference-local` and no Runtime/WORKS/Trust/Sentinel truth has migrated into Studio storage.
