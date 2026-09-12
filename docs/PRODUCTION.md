# Aftergraph Studio — Production Runbook

How to host a single-tenant Aftergraph Studio instance with auth enforcement on.

## 1. Environment

| Variable | Required | Purpose |
|---|---|---|
| `PORT` / `HOST` | no (8000 / 127.0.0.1) | Listen address. Bind `127.0.0.1` behind a reverse proxy. |
| `AFTERGRAPH_STATE_FILE` | no (`.runtime/workspace-state.json`) | State base path. Per-user files are stored as `<base>.<userId>`. Back up the whole `.runtime/` directory. |
| `AFTERGRAPH_AUTH_SECRET` | YES in production | HMAC secret for magic-link tokens. Never commit it. Auth-enforced startup fails fast if it is missing or equals the development secret. |
| `AFTERGRAPH_REQUIRE_AUTH` | YES (`'true'`) | Rejects every API route without a valid Bearer token, except `/healthz` and `/api/v1/auth/*`. |
| `AFTERGRAPH_DEMO_FIXTURES` | no (`'true'` to seed demo content) | Leave unset in production for empty workspaces. |
| `AFTERGRAPH_RUNTIME_INTERVAL_MS` | no (1250) | Mission runtime tick. |
| `AFTERGRAPH_RELEASE_SHA` | YES in production | Exact immutable commit SHA served by this deployment; exposed by /healthz and /readyz. |
| `AFTERGRAPH_BACKUP_DIR` | YES for production recovery | Root directory for checksummed state snapshots; keep outside the live state directory. |

## 2. First boot (operator onboarding)

1. Start with `AFTERGRAPH_REQUIRE_AUTH=true` and `AFTERGRAPH_AUTH_SECRET` set.
2. From a trusted operator shell on the host, run
   `npm run auth:bootstrap-token` and pass the output directly into the
   sign-in flow. The service never writes bearer tokens to stdout or logs.
3. Open the app, click the profile avatar, and sign in as `demo-user` (or
   your operator id). The token persists in the browser.
4. Create real users via `POST /api/v1/users` (capability `user.manage`),
   each with the minimal capability set they need. Never grant `*`
   (rejected by validation).
5. Do not store the bootstrap token. It expires after 24h. Mint fresh
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

- Token issuance is capability-gated (not email-challenged) and throttled
  to 10 issuances per IP per hour. Do not expose
  `/api/v1/auth/magic-link` to untrusted operators without an email
  challenge in front.
- Idle user scopes are evicted past `maxUserStores` (default 100, never the
  default scope) and reseed from their per-user stateFile on next access.
- Backups are file copies of `.runtime/`; no point-in-time restore UI.
- Single-process scope (V8.1): horizontal scaling needs the distributed
  log work, currently deferred beyond single-process convergence.

## 5. Release process

- `main` is queue-gated (merge queue + 1 review). CI runs node tests,
  43+ release gates, browser QA, viewport sweep, axe a11y, CodeQL, Scorecard.
- Release Drafter maintains the draft; publish it from the releases page.
- Verify a release: `npm test` then `node scripts/v6_release_verify.mjs`.

## 6. Billing production configuration

Billing is inert with respect to outbound delivery unless a provider is explicitly configured.

| Variable | Required | Purpose |
|---|---|---|
| `AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_URL` | only for outbound delivery | HTTPS endpoint that accepts the versioned Billing delivery payload. |
| `AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_TOKEN` | provider-dependent | Optional bearer credential sent only in the Authorization header. Never commit or log it. |
| `AFTERGRAPH_BILLING_DELIVERY_TIMEOUT_MS` | no (8000) | Timeout for the outbound delivery request. |

The webhook receives the immutable invoice recipient, invoice metadata and the generated PDF as a base64 attachment. It must return JSON containing a non-empty `messageId` and an ISO `deliveredAt` timestamp. Billing records `pending` before the call and records delivered/email state only after that receipt validates.

The webhook URL must use HTTPS. With no webhook configured, `POST /api/v1/billing/invoices/:id/deliver` fails closed with provider unavailable and the issued invoice remains retryable.

Provider credentials belong in the deployment secret store, not tenant Billing settings. Tenant settings contain business identity, invoice sequence, payment copy and optional Peppol/Nemhandel identifiers, but never delivery-provider secrets.

## 7. Billing operational source sync

Production tenants start without demo customers or visits. A producer with only the `billing.sync` capability can push the versioned `aftergraph.billing.source.v1` envelope through `POST /api/v1/billing/sync`.

For the supplied producer CLI, configure `AFTERGRAPH_BILLING_BASE_URL`, `AFTERGRAPH_BILLING_SYNC_ACTOR` and `AFTERGRAPH_BILLING_SYNC_TOKEN`, then run `node scripts/billing_source_push.mjs <envelope.json>`. Production base URLs must use HTTPS; plain HTTP is accepted only for localhost QA.

Give source workers `billing.sync`, not `billing.manage`, unless they are also human Billing operators. Every push is bearer-bound and idempotency-protected. Source revisions are replay-safe, while the same revision with changed contents is rejected.

The source boundary can update owned customer/visit projections and insert compatible actual evidence. It cannot mutate invoices or invoice sequence, and it rejects contradictory actuals instead of overwriting financial evidence.

## 8. Deployment provenance and state recovery

Deploy each release into a versioned directory:
/opt/aftergraph-studio/releases/<exact-commit-sha>.
Point /opt/aftergraph-studio/current at that directory with an
atomic symlink replacement. Set AFTERGRAPH_RELEASE_SHA to the same
full commit SHA in the service environment; never deploy with unknown.

Use deploy/studio-backend.service as the service template. It starts
the versioned current target, gives systemd a 90-second graceful
SIGTERM drain window, and restarts only after an unexpected failure.
After activation, verify both endpoints without credentials:
- /healthz is HTTP 200 and returns the exact release SHA;
- /readyz is HTTP 200 with persistence and configured-auth true;
- authenticated Billing and source-sync smoke checks use the same SHA.

The state backup job uses scripts/state_backup.mjs and
deploy/studio-state-backup.{service,timer}. Set
AFTERGRAPH_BACKUP_DIR to a protected directory outside the live state
directory. The backup manifest records each state file byte length and
SHA-256. A backup is not release evidence until a restore drill succeeds
into a new empty directory.

For a restore drill, set AFTERGRAPH_BACKUP_PATH and
AFTERGRAPH_RESTORE_DIR and restore only into an isolated, non-live
directory. Never overwrite the active state directory in place. Rollback
is the inverse of deployment: repoint current to the previous versioned
release, restart studio-backend.service, then recheck /healthz, /readyz,
and authenticated smoke tests.
