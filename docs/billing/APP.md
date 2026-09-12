# Aftergraph Billing App

Aftergraph Billing turns verified operational work into a review-first invoicing product. It is currently incubated in Aftergraph Studio, while the installable product surface is standalone at `/billing/`.

Rendetalje is the first pilot tenant. Company identity, payment data, invoice sequence and electronic invoicing settings are tenant configuration, not product rules.

## Use

Open `/billing/` directly or launch **Aftergraph Billing** from Studio Work.

The inbox prioritizes:

1. **Mangler oplysninger** — actuals or required customer/company data are missing.
2. **Klar** — the billing window is closed and the work can be reviewed.
3. **Venter** — valid work remains inside an open billing window.
4. **Faktureret** — work is already bound to an invoice and duplicate-protected.

## Source of truth

Calendar duration is planning data, never billing evidence. Verified actual work minutes are authoritative. Money remains integer minor units and financial rules live in the Billing domain/API, not the browser.

Invoice creation snapshots issuer, customer and service identity so an issued document cannot silently change when account data changes later.
## Virksomhedsprofil

The **Virksomhed** surface manages tenant-specific billing configuration:

- business name and address;
- country and registration identity;
- contact and payment information;
- default service label;
- next invoice number;
- optional Peppol/Nemhandel endpoint identity.

CVR is the Danish pilot scheme, not a core product requirement. Invoice numbers are reserved atomically by the server.
## Review and document workflow

A normal item follows:

`Ready → Review → Draft → Issue → PDF / UBL → Delivery status`

For missing actuals:

`Needs info → Add actual work time → Re-evaluate → Ready/Waiting`

Issued invoices can be downloaded as deterministic A4 PDF documents. Long invoices paginate across multiple pages. The same immutable semantic invoice can also be exported as canonical JSON or, when preflight passes, Peppol BIS Billing 3.0 UBL.
## Delivery

Delivery is provider-neutral. Billing persists `pending` before the provider side effect and marks an invoice delivered only after a provider receipt supplies a message id and delivery timestamp. Provider failure leaves the invoice issued with a retryable failure state.

The production server can opt into an HTTPS webhook delivery adapter. With no adapter configured, delivery fails closed and no external side effect occurs.

## Installable and offline app

Billing includes a Web App Manifest and service worker. Canonical app URL: `/billing/`; `/billing.html` redirects to it.

Offline mode is deliberately read-only. The app may display a sanitized, identity-scoped last-synced projection, but actuals, drafts, issue, delivery and other financial writes are never queued or replayed offline.

When live connectivity returns, Billing re-synchronizes canonical state before financial controls become available again.

## Mobile behavior

The app is mobile-first, respects safe-area insets and keeps the common operator path short: inbox, actuals/review, issue, document/download, then updated queue.

## Current product boundary

Studio currently supplies hosting composition, authentication, durable state, CI and the Work launcher. Billing remains isolated so extraction to a dedicated Aftergraph Billing deployment is a packaging move rather than a financial-workflow redesign.

## Governed operational source ingestion

Production Billing does not depend on demo fixtures. Operational systems push a versioned `aftergraph.billing.source.v1` envelope to `POST /api/v1/billing/sync` using a dedicated `billing.sync` capability.

The source contract is tenant-neutral. Rendetalje/RenOS is the first producer, but Billing only receives customers, visits, source identity, revision and verified actual evidence. Source replay is idempotent; reusing a revision with different data is rejected.

Source sync may upsert operational customer/visit data, but it never owns invoices, invoice numbering or immutable invoice snapshots. Existing financial actuals cannot be silently overwritten by a contradictory producer payload.
