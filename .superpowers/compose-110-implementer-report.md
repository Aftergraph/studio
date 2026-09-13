# COMPOSE-110 implementer report

Status: implementation complete; local verification green.
Branch: feat/compose-device-stack-v1
Repository: C:\Users\empir\aftergraph-compose-devstack-0913
Push/merge: not performed.

## Files changed

- `scripts/compose-dev-lib.mjs`
  - Added Tailscale IPv4 parsing and explicit-host precedence.
  - Added validated defaults/overrides for Hermes 8643, Studio 8000, and Expo 8081.
  - Added duplicate-port rejection and listener/PID ownership checks.
  - Added loopback-only Hermes URL validation.
  - Added safe Studio/Expo environment builders; Expo receives only `EXPO_PUBLIC_AFTERGRAPH_API_URL` among public variables and strips server credential variables.
  - Added deterministic plan fields and health URLs.
- `scripts/compose-dev.mjs`
  - Added the one-command dry-run and actual-mode entrypoint.
  - Dry-run performs no service start and prints only deterministic URLs/public configuration.
  - Actual mode validates the existing dedicated Hermes API on `127.0.0.1`, checks Studio/Expo ports before starting, starts only the Studio and Expo children, suppresses child logs, waits for health, prints exact URLs/health, and cleans up only tracked child process trees.
  - Uses the installed Expo CLI directly when available and falls back to `npx --no-install`.
- `tests/compose-dev.test.mjs`
  - Preserved the existing dry-run contract and added RED/GREEN coverage for host discovery, port validation, ownership fail-closed behavior, plan port fields, environment separation, and listener parsing.
- `package.json`
  - Added `npm run compose:dev`.
- `README.md`
  - Added device-stack usage, dry-run usage, defaults, binding, credential, and port-safety notes.
- `.superpowers/compose-110-implementer-report.md`
  - This report.

The pre-existing untracked `scripts/compose-dev.next.txt` was not modified or staged.

## TDD evidence

- Initial focused state: 1 pass and 3 expected RED failures for the missing host, port, and ownership APIs.
- Added additional contract tests before the corresponding implementation changes.
- Verified RED for each new behavior, then implemented the minimal supporting code and reran GREEN.
- Final focused result: 7/7 passed.

## Verification

- `node --test tests/compose-dev.test.mjs` — 7/7 passed.
- `npm test` — 695/695 passed.
- `npm run verify` — passed all workspace, syntax, platform, and source-truth checks.
- `cd platforms/expo && npm run typecheck` — passed.
- `cd platforms/expo && npx expo-doctor` — 21/21 checks passed.
- `npm run compose:dev -- --dry-run` — dynamically discovered Tailscale IPv4 `100.72.80.64` and printed the expected loopback Hermes plus device Studio/Expo URLs without starting services.
- Actual-mode live smoke with Hermes on loopback and custom free ports 18000/18081 — printed exact Hermes/Studio/Expo URLs and `Health: Hermes=ok Studio=ok Expo=ok`; the started process trees were stopped and the custom listeners were verified gone.
- Actual-mode occupied-port smoke — returned `port_in_use_by_unrelated_process` with exit code 2 before starting Studio or Expo.
- `git diff --check` — passed.

## Remaining concerns

- Actual mode intentionally requires the dedicated Hermes Compose API to already be healthy on `http://127.0.0.1:8643`; this change validates/reuses it and does not start an unrelated Hermes or other external service.
- The live smoke used loopback host/custom ports, not Expo Go on a physical phone over Tailscale. Physical-device behavior remains operator verification.
- The workspace still contains the pre-existing untracked `scripts/compose-dev.next.txt`; it is intentionally outside this implementation commit.
- Default ports 8000/8081 are occupied by existing unrelated listeners in this environment, so actual mode correctly refuses those defaults until the caller supplies free overrides.
