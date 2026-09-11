# Aftergraph Billing Extraction Contract

This document defines how the incubated Billing product can move from `Aftergraph/studio` to a dedicated `Aftergraph/billing` repository without redesigning the workflow.

## Future repository ownership

`Aftergraph/billing` should own:

- `src/billing/model.mjs`
- `src/billing/readiness.mjs`
- `src/billing/money.mjs`
- `src/billing/mutations.mjs`
- `src/billing/browser-client.mjs`
- `src/billing/app-state.mjs`
- `src/billing/billing-app.mjs`
- `src/billing/pwa.mjs`
- the `/billing/` app shell, manifest, icons and service worker
- Billing API composition and its storage adapter
- Billing-specific tests, docs, release and deployment configuration

Reference fixtures may move only as non-sensitive test data. They are not product rules.

## Studio after extraction

Studio should retain only:

- a Work/Needs-you summary or launcher;
- authenticated deep links to the Billing product;
- optional read-only Billing status projection if useful to operators.

Studio must not retain a second readiness engine, money implementation, invoice sequence or mutation workflow.

## Stable HTTP contract

The extraction should initially preserve:

- `GET /api/v1/billing`
- `POST /api/v1/billing/actuals`
- `POST /api/v1/billing/invoices/draft`
- `POST /api/v1/billing/invoices/:id/issue`

A host/base-URL adapter may change, but request/response semantics should remain compatible so the PWA and Studio launcher do not require a workflow rewrite.

## Canonical invariants

These invariants move with the product and must not be reimplemented differently by clients:

1. Planned calendar duration is not billable evidence.
2. Verified actual work minutes are the billing time source.
3. Money uses integer minor units.
4. Missing or contradictory financial inputs fail closed.
5. A visit cannot be bound to more than one active invoice.
6. Billing-window rules determine Ready vs Waiting.
7. Consequential writes require actor/idempotency protection.
8. Offline financial mutations are prohibited and are never replayed later.

## Native client rule

An Expo/iOS/Android client is a presentation client of the canonical Billing API.

It may add native value such as push notifications, secure session storage, camera/document capture, background read refresh or platform sharing. It must not independently implement:

- readiness;
- tax/money calculation;
- discount authority;
- duplicate prevention;
- invoice numbering/reservation;
- draft/issue state transitions.

Those remain server/domain responsibilities.

## Extraction readiness gate

Create the dedicated repository when an authorized repository-creation and deployment path is available and all of the following are true:

- the PWA workflow is exact-head green in Studio CI;
- core Billing domain/API tests are stable;
- state/storage ownership is explicit;
- authentication/session ownership is explicit;
- deployment and persistence targets are selected;
- Studio deep links can point to the product deployment without breaking operator flow.

Extraction is then a packaging/deployment move, not a product redesign.

## Current limitation

At the time of this document, the available GitHub connector can modify existing repositories but does not expose repository creation, and the authorized Remote Desktop Commander device is offline. The implementation therefore remains on the isolated Studio feature branch until a repository-creation path is available.
