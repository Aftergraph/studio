# Aftergraph Billing App

Aftergraph Billing turns verified operational work into a small, review-first invoicing queue. It is incubated in Aftergraph Studio, but the product experience is standalone at `/billing/`.

## Use

Open `/billing/` directly or launch **Aftergraph Billing** from Studio Work.

The app starts in **Indbakke** and prioritizes work in this order:

1. **Mangler oplysninger** — required actuals or billing/customer data are missing.
2. **Klar** — the billing window is closed and the item can be reviewed for an invoice.
3. **Venter** — work is valid but another visit or the current billing window must finish first.

**Faktureret** shows work already bound to an invoice and protected against duplicate invoicing.

## Source of truth

Calendar duration is planning data, never invoice evidence. Billing uses verified actual work minutes from the canonical Billing state.

The browser UI does not implement independent financial rules. Readiness, money projection, duplicate protection and issue transitions remain in the Billing domain/API.

## Review workflow

A normal ready item follows:

`Ready → Review → Draft → Issue`

For missing actuals:

`Needs info → Add actual work time → Re-evaluate → Ready/Waiting`

Draft and issue operations use the existing actor and idempotency guards. Repeated UI interaction must not create duplicate financial mutations.

## Installable app

Billing includes a Web App Manifest and service worker and can be installed as a standalone PWA in supported browsers.

Canonical app URL: `/billing/`

The legacy `/billing.html` URL redirects to the canonical app and preserves query/hash information.

## Offline behavior

Offline mode is deliberately conservative.

The app may show the last successfully synchronized, sanitized Billing projection. Cached state is labelled `Offline · senest synkroniseret …` and is never presented as current.

While offline or showing cached data:

- actuals cannot be recorded;
- invoice drafts cannot be created;
- invoices cannot be issued;
- no financial mutation is queued for later replay.

When connectivity returns, the app refreshes canonical state before financial controls become available again.

The read cache excludes operational access/key/alarm information and credentials.

## Mobile behavior

The UI is mobile-first and respects safe-area insets. The common phone path is intentionally short:

1. Open Inbox.
2. Open the first actionable item.
3. Add missing actuals or review the invoice.
4. Draft/issue when current online state allows it.
5. Return to the updated queue.

## Current incubation boundary

Studio currently provides the static host, durable state/API composition, CI, tokens and Work launcher. The Billing domain and app remain isolated so they can move to a dedicated repository without changing the financial workflow or HTTP contract.
