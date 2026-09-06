# V8.1 Remediation Log

## V81-007 — Runtime fixture separation

Status: RESOLVED in this slice.

Audited finding: `src/state.mjs` exposed demo users, missions, approvals, agents, conversations, artifacts and telemetry through the same initializer used by runtime/server paths.

Changes:

- `createInitialState({ fixtures = true })` now makes fixture intent explicit.
- `createInitialState({ fixtures: false })` returns an empty `runtime-empty` state with no demo records and unavailable telemetry.
- Production `server.mjs` defaults to `fixtures: false`.
- The bridge/browser smoke harnesses opt into `AFTERGRAPH_DEMO_FIXTURES=true` explicitly, preserving deterministic test fixtures without making them a production default.
- Browser bootstrap uses fixture state only for non-HTTP harnesses and refuses to hydrate an HTTP runtime from stored demo state.
- State carries `fixtureMode` and `source` provenance.

Acceptance evidence:

- Focused state/server tests: 13/13 PASS.
- Full Node suite: 477/477 PASS.
- Monolithic release verification: 24/24 PASS.
- Browser V4, V5, fullstack bridge and polyrepo bridge: PASS.
- Accessibility gate: PASS.
- No secrets or credentials introduced.

Remaining boundary:

- `createInitialState()` retains `fixtures: true` as a backwards-compatible deterministic test default. New production callers must pass `fixtures: false` or use the production server entrypoint.
- Existing audit artifacts remain historical evidence for the pre-remediation revision; this log records the exact remediation and fresh verification.
