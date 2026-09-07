# Aftergraph Studio — Production Runbook

How to host a single-tenant Aftergraph Studio instance with auth enforcement on.

## 1. Environment

| Variable | Required | Purpose |
|---|---|---|
| `PORT` / `HOST` | no (8000 / 127.0.0.1) | Listen address. Bind `127.0.0.1` behind a reverse proxy. |
| `AFTERGRAPH_STATE_FILE` | no (`.runtime/workspace-state.json`) | State base path. Per-user files are stored as `<base>.<userId>`. Back up the whole `.runtime/` directory. |
| `AFTERGRAPH_AUTH_SECRET` | YES in production | HMAC secret for magic-link tokens. Never commit it. Without it the server falls back to a dev secret and prints no warning — set it. |
| `AFTERGRAPH_REQUIRE_AUTH` | YES (`'true'`) | Rejects every API route without a valid Bearer token, except `/healthz` and `/api/v1/auth/*`. |
| `AFTERGRAPH_DEMO_FIXTURES` | no (`'true'` to seed demo content) | Leave unset in production for empty workspaces. |
| `AFTERGRAPH_RUNTIME_INTERVAL_MS` | no (1250) | Mission runtime tick. |

## 2. First boot (operator onboarding)

1. Start with `AFTERGRAPH_REQUIRE_AUTH=true` and `AFTERGRAPH_AUTH_SECRET` set.
2. The server prints a one-time operator boot token on listen:
   `Operator boot token (valid 24h, AFTERGRAPH_AUTH_SECRET): v1.…`
3. Open the app, click the profile avatar, request a token for `demo-user`
   (or your operator id), sign in. The token persists in the browser.
4. Create real users via `POST /api/v1/users` (capability `user.manage`),
   each with the minimal capability set they need. Never grant `*`
   (rejected by validation).
5. Store the boot token nowhere — it expires after 24h. Mint fresh
   operator tokens via `/api/v1/auth/magic-link` (capability `auth.issue`).

## 3. Security boundaries (verified by gates)

- Workspaces are per-actor isolated (store + runtime hub + sync log).
  Cross-user objects return 404 (no existence oracle).
- Unregistered actors get 403 everywhere; unknown users cannot be minted
  without `user.manage`.
- Autonomy kill-switches and the cost ledger stay GLOBAL on purpose:
  one portfolio-wide stop covers every user.
- Bearer tokens bind the request: token subject ≠ claimed actor → 403.
- Tokens are HMAC-SHA256, 15-minute TTL (24h for the boot token only).

## 4. Known ceilings (next slices)

- Token issuance is capability-gated, not email-challenged. Do not expose
  `/api/v1/auth/magic-link` to untrusted operators without an email
  challenge in front.
- No per-user state eviction: idle user stores stay in memory until restart.
- Backups are file copies of `.runtime/`; no point-in-time restore UI.
- Single-process scope (V8.1): horizontal scaling needs the distributed
  log work, currently deferred beyond single-process convergence.

## 5. Release process

- `main` is queue-gated (merge queue + 1 review). CI runs node tests,
  43+ release gates, browser QA, viewport sweep, axe a11y, CodeQL, Scorecard.
- Release Drafter maintains the draft; publish it from the releases page.
- Verify a release: `npm test` then `node scripts/v6_release_verify.mjs`.
