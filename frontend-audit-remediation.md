# V8.1 Remediation Log

## V81-015 — Backend contract boundary

Status: IN PROGRESS → implementation complete, pending CI promotion.

Audited finding: backend payload consumers could accept partial or malformed state shapes and rely on scattered fallback behavior.

Changes:

- `validateWorkspacePayload()` is now the canonical structural boundary in `src/backend-reconciliation.mjs`.
- The validator checks the payload envelope, canonical arrays, replay object and IDs on core records.
- `createBackendSession()` accepts `validatePayload` and validates before `onState()` or `current` status.
- Bootstrap injects `validateWorkspacePayload`; malformed backend state becomes stale and cannot become current truth.
- Gate 25 added: `V8.1 Backend Contract Boundary Exit Gate`.
- `tests/v81-backend-contract.test.mjs` covers valid, malformed, nested-record and non-mutation cases.

Acceptance evidence so far:

- Focused contract/session tests: 10/10 PASS.
- Full Node suite: 481/481 PASS.
- Existing runtime/session tests remain green.

Remaining verification:

- Monolithic release runner, browser/accessibility gates, exact-head CI and clean-tree verification after commit.
