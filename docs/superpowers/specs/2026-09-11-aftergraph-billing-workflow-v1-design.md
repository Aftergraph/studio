# Aftergraph Billing Workflow V1 — Design

## Status

Approved for implementation by the user on 2026-09-11 with the instruction to start execution, publish under Aftergraph, and optimize for working software, usability, and simpler invoicing.

## Product position

**Billing** is an Aftergraph Studio Work surface for turning operational work evidence into safe, easy-to-review invoices. Rendetalje is the first reference implementation, but the domain model is generic and must not encode cleaning-specific business logic into the core engine.

This is an incubation slice inside `Aftergraph/studio`, not a claim that Studio permanently owns the billing runtime. Studio owns the human experience. The billing domain is intentionally isolated under `src/billing/` so a dedicated product/runtime repository can be extracted later without redesigning the operator flow.

## User outcome

A user should be able to open Billing and answer four questions immediately:

1. What can I invoice now?
2. What is waiting, and why?
3. What information is missing?
4. What has already been invoiced?

The default workflow must reduce manual reasoning, not merely display data.

## V1 workflow

Billing presents four queues:

- **Ready** — billing window is closed and all required evidence exists.
- **Waiting** — valid work exists, but another visit in the same billing window is still expected.
- **Needs info** — actuals, rate, customer identity, or another required field is missing or contradictory.
- **Invoiced** — one or more visits are already bound to a finalized invoice.

The primary action on a Ready item is **Review invoice**. V1 does not silently auto-send invoices.

## Canonical model

### Customer

Fields required by the engine:

- `id`
- `name`
- `email`
- `status`: `active | paused | closed`
- `billing.mode`: `per_visit | monthly_batch`
- `billing.paymentTermsDays`
- `billing.rateMinor`
- `billing.currency`
- optional `billing.discountPercent`

Operational metadata such as access instructions may exist in the source system but must never be copied into invoices or outbound customer email.

### Visit

- `id`
- `customerId`
- `scheduledStart`
- `scheduledEnd`
- `status`: `planned | completed | cancelled | no_show | hold`
- optional `actual`

### Actual

- `startedAt`
- `endedAt`
- `workers`
- `workMinutes`
- optional `segments[]` for service areas such as clinic/house
- optional `discountPercent`
- optional `notes`

Calendar duration is planning evidence only. Billing uses verified actual work minutes.

### Invoice

- `id`
- `number`
- `customerId`
- `visitIds[]`
- `issueDate`
- `dueDate`
- `status`: `draft | issued | emailed | void`
- line items with immutable money values in minor units

A visit may belong to at most one non-void invoice.

## Readiness rules

Evaluation is deterministic and fail-closed.

A visit/customer set is **Ready** only when:

- customer is active;
- at least one completed, unbilled visit exists;
- all included visits have actuals;
- rate and currency are known;
- email is known;
- no duplicate invoice binding exists;
- billing window is closed.

For `per_visit`, the window closes after the completed visit.

For `monthly_batch`, the window stays open while another planned visit for the same customer exists in the same calendar month after the latest completed visit. It closes after the final expected visit is completed/cancelled or the month has ended.

A planned future visit in a later month must not block billing for the current month.

## Money rules

- Money is represented in integer minor units.
- Quantity for hourly work is derived from verified work minutes.
- Rate is minor units per hour.
- Discount is applied after gross line calculation.
- VAT/tax is represented explicitly in generated invoice projection; V1 fixture uses 25% VAT but the core evaluator accepts a supplied tax rate.
- Rounding occurs only at line/invoice projection boundaries and is deterministic.

## Duplicate protection

The engine rejects a Ready verdict when any candidate visit is already referenced by a non-void invoice.

Invoice number allocation is deliberately outside the pure readiness evaluator. V1 API supports draft creation with a supplied/reserved number; production numbering must be backed by an atomic sequence when the runtime is extracted from Studio.

## Rendetalje reference fixtures

The V1 demo/reference data encodes known operational patterns without leaking sensitive access details:

- **Katrine** — per-visit billing; 2026-09-07 completed; next visit 2026-10-05; Ready.
- **Anton** — monthly batch; 2026-09-09 completed and 2026-09-23 planned; Waiting.
- **Heidi** — monthly batch; 2026-09-08 completed and 2026-09-22 planned; Waiting.
- **Casper & Nora** — monthly batch with weekly September visits; Waiting until final September visit.
- **Peder** — completed visit without actuals; Needs info.

Fixtures use synthetic IDs and only the minimum customer information needed for the workflow.

## API

V1 adds:

- `GET /api/v1/billing` — returns customers, visits, invoices, queue projections, totals, and reason codes.
- `POST /api/v1/billing/actuals` — records/replaces actuals for a visit.
- `POST /api/v1/billing/invoices/draft` — creates a draft for a Ready group only; requires explicit actor and idempotency key.
- `POST /api/v1/billing/invoices/:id/issue` — transitions a validated draft to issued; explicit actor and idempotency key.

V1 does not send email. Email/provider integration remains a downstream adapter so the core remains provider-neutral.

## Persistence

Billing data lives inside Studio workspace state under a `billing` key for incubation:

```text
billing:
  customers: []
  visits: []
  invoices: []
  settings: { taxRateBps, locale }
```

State mutations use the existing durable store and action/idempotency guard.

## UX

A focused `/billing.html` surface is added under Studio using first-party tokens and zero external dependencies.

Desktop layout:

- compact Aftergraph header;
- top summary: Ready amount, waiting amount, items needing info;
- segmented queue navigation;
- invoice cards with customer, amount, covered visits, concise reason, and one primary action;
- right-side review drawer for Ready items.

Mobile layout collapses to one column with a sticky queue switcher and bottom review action.

Language is plain and operational. Examples:

- `Ready to invoice`
- `Waiting for 23 Sep visit`
- `Missing actual hours`
- `Already invoiced`

Never show internal rule jargon when a human explanation is possible.

## Safety and privacy

- Access/key/alarm instructions are operational secrets and are excluded from billing projection and fixture payloads.
- No credentials are stored in frontend state.
- Consequential issue transition uses the existing actor/idempotency guard.
- V1 is review-first; no automatic sending.
- Unknown/contradictory financial inputs fail closed to Needs info.

## Verification

Required tests:

- per-visit Ready decision;
- monthly batch Waiting decision;
- missing actuals Needs info;
- duplicate visit protection;
- future-next-month visit does not block current billing;
- deterministic money/discount/tax projection;
- persistence through API mutation;
- draft creation rejects non-Ready group;
- issue transition is idempotent;
- billing page source contract and accessibility smoke assertions.

## Extraction boundary

If the workflow proves useful outside Studio, extract `src/billing/` and API storage into a dedicated Aftergraph product repository. Studio then consumes it through an adapter. No UI redesign should be required.

## Non-goals for V1

- bookkeeping/general ledger;
- payment reconciliation;
- tax filing;
- fully autonomous invoice sending;
- accounting-provider-specific APIs;
- calendar/Gmail credentials in Studio;
- replacing source systems for scheduling or customer communication.
