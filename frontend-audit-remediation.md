# V8.1 Remediation Log

This log tracks the frontend-audit remediation stream separately from the roadmap milestone V8.1 Distributed Aftergraph. The roadmap milestone remains open and is explicitly deferred in `docs/V8.1-DISTRIBUTED-DEFERRAL.md`.

## V81-007 — Runtime fixture separation

Status: RESOLVED.

- `createInitialState({ fixtures })` makes fixture intent explicit.
- Production `server.mjs` defaults to `fixtures: false`.
- Smoke and bridge harnesses opt in with `AFTERGRAPH_DEMO_FIXTURES=true`.
- HTTP bootstrap refuses to hydrate from stored demo fixture state.
- State carries `fixtureMode` and `source` provenance.

Evidence:

- Focused state/server tests: 13/13 PASS at commit `b68825d`.
- Full Node suite and release gates were green before the next remediation.

## V81-015 — Backend contract boundary

Status: RESOLVED.

- `validateWorkspacePayload()` is the canonical structural boundary in `src/backend-reconciliation.mjs`.
- `createBackendSession()` validates before `onState()` or `current` status.
- Bootstrap injects the validator; malformed backend state becomes stale and cannot become current truth.
- Gate 25: `V8.1-A Backend Contract Boundary Exit Gate`.
- `tests/v81-backend-contract.test.mjs` covers valid, malformed, nested-record and non-mutation cases.

Evidence:

- Focused contract/session tests: 10/10 PASS.
- Full Node suite before V81-016: 481/481 PASS.
- Release/browser/accessibility/CI evidence is superseded by the final V81-016 verification below.

## V81-016 — Consequential action guard

Status: RESOLVED.

Promoted at exact HEAD `3660b12`; GitHub Actions run `34062359350` passed.

Changes:

- `src/action-guard.mjs` provides bounded idempotency, replay, failure release and actor-capability checks.
- Approval and mission-control endpoints require actor identity, capability and idempotency key.
- Reset requires actor authority plus explicit `RESET_WORKSPACE` confirmation token.
- Memory revoke requires actor authority plus idempotency key.
- UI approval actions disable while loading, preserve pending state on failure and show retryable error semantics.
- `AGConfirmationSheet` provides dialog labels, error/status semantics, disabled loading state and Escape guidance.
- Gate 26: `V8.1-A Destructive Action Guard Exit Gate`.
- `tests/v81-destructive-action.test.mjs` covers domain guard and UI contract; fullstack tests cover 403/422/409 behavior.

Acceptance evidence:

- Focused destructive/fullstack/UI tests: 17/17 PASS.
- Full Node suite at slice time: 488/488 PASS (superseded: suite has since grown with V8.1 distributed slices).
- Remaining release, browser, accessibility and exact-head CI checks are run before promotion.
