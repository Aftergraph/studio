# Aftergraph Billing Hybrid App — Design

## Status

Approved by the user on 2026-09-11 with the direction to combine a dedicated Aftergraph product identity, an installable web app, Studio integration, and a path to native mobile without duplicating billing logic.

## Product boundary

**Aftergraph Billing** is the product. Studio is an integration surface, not the permanent owner of the product experience.

For the incubation phase, the product ships from `Aftergraph/studio` so it can reuse the verified Billing domain, API, state, CI and design tokens already implemented on `feature/billing-workflow-v1`. The product must nevertheless behave as a standalone app and preserve an extraction boundary to a future `Aftergraph/billing` repository.

The hybrid model is:

1. **Billing PWA** — primary operator experience on desktop and mobile.
2. **Studio integration** — launcher/back-office entry into the same Billing app.
3. **Billing domain/API** — one canonical readiness, money, mutation and ledger model.
4. **Future native shell** — optional Expo/iOS/Android client consuming the same API; no duplicated financial rules.
5. **Future repository extraction** — move app/domain/runtime to `Aftergraph/billing` when repository creation and deployment ownership are ready, without redesigning the workflow.

## Success criteria

A user can install Billing on a phone or desktop, open it directly, understand invoice state in seconds, enter missing actuals, review a ready invoice, create a draft and issue it without using Studio navigation.

The app must remain useful when temporarily offline for reading previously synchronized non-sensitive billing projections, but consequential writes are online-only and fail closed.

## App shell

Billing becomes a standalone app route rooted at `/billing/` while `/billing.html` remains a compatibility redirect during incubation.

Required shell behavior:

- standalone app identity: `Aftergraph Billing`;
- own manifest and app metadata;
- `display: standalone` with browser fallback;
- installable on supported browsers;
- safe-area support for iPhone;
- responsive phone/tablet/desktop layout;
- explicit online/offline state;
- one primary navigation model inside Billing, independent of Studio's Chat/Work/Space modes;
- Studio link remains available as a secondary exit/back-office action.

## Information architecture

Primary views:

- **Inbox** — combined actionable queue, ordered `needs_info`, `ready`, `waiting`.
- **Ready** — items that can become invoices now.
- **Waiting** — valid work waiting for the billing window to close.
- **Needs info** — missing actuals or financial/customer data.
- **Invoices** — draft, issued, emailed and void records.

The existing four queue statuses remain canonical domain states. Navigation is merely a user-facing projection.

## Mobile workflow

The mobile app must optimize for the common operational path:

1. Open app.
2. See a small action count, not a dashboard wall.
3. Tap a customer/task.
4. Add missing actuals or review invoice.
5. Confirm draft/issue.
6. Return to queue with the item moved immediately.

Primary actions must remain thumb-reachable on narrow screens and respect safe-area insets.

## Offline policy

Billing may cache the most recent successful `GET /api/v1/billing` response for read-only rendering.

Offline rules:

- clearly label cached state with its synchronization time;
- never claim cached data is current;
- do not cache access/key/alarm/credential data;
- do not permit `actuals`, `draft`, `issue`, email or accounting mutations while offline;
- do not queue consequential financial writes for later replay;
- reconnection triggers a canonical refresh before writes become available.

This intentionally favors correctness over optimistic offline mutations.

## PWA resources

Create:

- `/billing/manifest.webmanifest`
- `/billing/sw.js`
- `/billing/icons/*` from existing Aftergraph brand assets where available
- PWA registration/bootstrap module

Service-worker cache scope is restricted to Billing static assets plus the last successful read projection. Mutation endpoints are network-only.

## Canonical backend

The existing Billing interfaces remain the source of truth:

- `GET /api/v1/billing`
- `POST /api/v1/billing/actuals`
- `POST /api/v1/billing/invoices/draft`
- `POST /api/v1/billing/invoices/:id/issue`

No financial rule is implemented only in the frontend.

## Product extraction contract

The future `Aftergraph/billing` repository owns:

- `src/billing/` domain engine;
- Billing app shell and static assets;
- Billing API composition/storage adapter;
- product docs and release/deployment config.

Studio retains only:

- launcher/discovery integration;
- optional embedded summary/needs-you surface;
- authenticated deep link into Billing.

Extraction must preserve HTTP contracts and domain fixtures so Studio integration does not require a product rewrite.

## Native path

A future Expo client is allowed only after the PWA workflow is stable and exact-head verified.

The native client must consume the canonical Billing API and share only presentation-safe schemas/utilities. It must not fork readiness, money, duplicate prevention, invoice numbering or issue-transition rules.

Native-specific value must justify the client, for example push notifications, secure device integrations, background refresh or camera/document capture.

## UX rules

- Danish is the initial locale; strings remain centralizable for later localization.
- Use Aftergraph Studio tokens and visual language during incubation.
- Avoid generic dashboard density; the app is an operational work queue.
- One clear primary action per state.
- Show human reason text before internal reason codes.
- Show amount, covered visits, actual work evidence and next blocking event where relevant.
- Destructive/financial confirmation is explicit and accessible.
- Double-click/double-tap must not create duplicate financial mutations.

## Security and privacy

- Billing projections never include operational access/key/alarm data.
- Cached data is billing-minimal and scoped to the current workspace/user context.
- No credentials are stored by the service worker.
- Consequential mutations require the existing actor/idempotency guard.
- Offline writes are prohibited.
- A future native shell must use platform-secure credential/session storage rather than bundling secrets.

## Verification

Required additional verification beyond the existing Billing workflow tests:

- manifest contract and installability metadata;
- service-worker static caching behavior;
- no mutation endpoint is served from cache or queued offline;
- stale cache is visibly marked;
- online recovery refreshes canonical state;
- `/billing/` shell works without Studio navigation;
- narrow mobile safe-area layout contract;
- Studio launcher still deep-links into Billing;
- existing readiness/API/duplicate/idempotency tests remain green.

## Repository creation limitation

The current ChatGPT GitHub connector can mutate existing repositories but does not expose repository creation. The user's Remote Desktop Commander is offline at design time. Therefore the incubation branch remains the authoritative implementation location until `Aftergraph/billing` can be created through an authorized repository-creation path. This is an execution constraint, not an architectural change.
