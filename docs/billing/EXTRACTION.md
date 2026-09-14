# Aftergraph Billing Extraction Contract

This contract defines how Billing can move from `Aftergraph/studio` to a dedicated `Aftergraph/billing` repository without redesigning the workflow or document semantics.

## Future repository ownership

`Aftergraph/billing` should own:

- `src/billing/readiness.mjs`, `money.mjs`, `mutations.mjs` and `app-state.mjs`;
- `src/billing/browser-client.mjs`, `billing-app.mjs` and `pwa.mjs`;
- `src/billing/artifact.mjs` for PDF rendering;
- `src/billing/document-profile.mjs` for the versioned semantic invoice contract;
- `src/billing/peppol-bis3.mjs` and later document-profile adapters;
- `server/billing-server.mjs` and `server/billing-delivery.mjs`;
- the `/billing/` shell, manifest, icons and service worker;
- Billing-specific storage, tests, docs, release and deployment configuration.

Reference fixtures may move only as non-sensitive pilot/test data. They are not product rules.

## Studio after extraction

Studio should retain only a launcher, authenticated deep links and optional read-only status projection. It must not retain a second readiness engine, money implementation, invoice sequence, document model or delivery state machine.
## Stable HTTP contract

Extraction should initially preserve:

- `GET /api/v1/billing`;
- `POST /api/v1/billing/settings`;
- `POST /api/v1/billing/actuals`;
- `POST /api/v1/billing/invoices/draft`;
- `POST /api/v1/billing/invoices/:id/issue`;
- `GET /api/v1/billing/invoices/:id/artifact`;
- `GET /api/v1/billing/invoices/:id/document`;
- `GET /api/v1/billing/invoices/:id/peppol-bis3`;
- `POST /api/v1/billing/invoices/:id/deliver`.

The canonical semantic document identifier is `aftergraph.invoice.semantic.v1`. Host/base URL may change after extraction, but request/response and document semantics should remain compatible.

## Canonical invariants

1. Planned calendar duration is not billable evidence.
2. Verified actual work minutes are authoritative.
3. Money uses integer minor units.
4. Missing or contradictory financial inputs fail closed.
5. A visit cannot be bound to more than one active invoice.
6. Invoice numbers are atomically reserved server-side.
7. Issued documents use immutable issuer/customer/service snapshots.
8. Consequential writes require actor, capability and idempotency protection.
9. Offline financial mutations are prohibited and never replayed.
10. Delivery requires a provider receipt before `emailed`/delivered state.
## Native client rule

Expo/iOS/Android clients are presentation clients of the canonical Billing API. They may add platform value, but must not reimplement readiness, tax/money, duplicate protection, invoice numbering, document semantics or lifecycle transitions.

## Extraction readiness gate

Create the dedicated repository/deployment when:

- exact-head Billing and Studio CI are green;
- state/storage and authentication ownership are explicit;
- production persistence and deployment targets are selected;
- delivery/document validator integrations have production configuration;
- Studio deep links can move to the Billing deployment without changing operator flow;
- rollback from the extracted deployment is tested.

The current implementation already satisfies the product/domain isolation side of this gate. Remaining work is deployment and operational ownership, not a financial-model rewrite.

## Operational source boundary

Extraction must also move `src/billing/source-contract.mjs`, `src/billing/source-sync.mjs` and the producer-facing push contract. Preserve `POST /api/v1/billing/sync` and the `aftergraph.billing.source.v1` schema during the first extraction.

`billing.sync` remains distinct from `billing.manage`. Producers may upsert their owned operational customer/visit projections with revision provenance, but cannot mutate invoice ledger, invoice sequence or contradictory established actual evidence.
