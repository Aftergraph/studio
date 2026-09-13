# Aftergraph Billing Audit Report

**Repository:** Aftergraph/studio  
**Branch:** `audit/billing-production`  
**SHA:** `fae2ec1fd07e1ee9815d39d09d923d71a59e445a`  
**PR:** #55 (OPEN, not merged)  
**Date:** 2026-09-13  
**Auditor:** Hermes Agent (autonomous, read-only)  
**Test Evidence:** 780/780 pass (full suite), 114/114 billing, 35/35 source/distributed

---

## Executive Summary

Billing-modulet er **funktionelt korrekt og sikkert i kerne-flowet**. State machine, invoice immutability, PDF determinism, offline read-only, og concurrent mutation serialization er alle verified. Zero external dependencies eliminerer supply chain risk.

**Release blockers (eksterne):**
- **OPS-501**: Manglende production backup/restore evidence
- **COMP-601**: Peppol BIS 3.0 ekstern Schematron-validator ikke integreret i export-flow

**Must-fix før merge (interne):**
- L1-SEC-005: GET billing endpoints mangler capability checks (HIGH)
- L1-SEC-006: Demo-user auto-elevated til billing.manage ved boot (MEDIUM)
- L3-CONS-002: Dual token-system med divergerende farver (HIGH)

---

## Kategori A — Foundation & Provenance

| ID | Finding | Severity | Status |
|---|---|---|---|
| A-001 | SHA discrepancy: user context `48b571db` vs actual `fae2ec1f` | INFO | Expected (rebase) |
| A-002 | 642 files cataloged across all evidence categories | POSITIVE | Complete |
| A-003 | 8/9 claims VERIFIED, 1 UNVERIFIED (Peppol production export) | MIXED | See COMP-601 |

---

## Kategori B — Code & Security

### 🔴 HIGH

**L1-SEC-005** — GET billing endpoints lack capability checks  
`server/billing-server.mjs:111-179`  
Alle fire GET endpoints (`/api/v1/billing`, `/artifact`, `/document`, `/peppol-bis3`) kalder kun `resolveScope()` men aldrig `assertActorCapability()`. Enhver authenticated bruger kan læse alle fakturaer, PDFs, og Peppol XML.  
**Fix:** Tilføj `assertActorCapability({ capability: 'billing.read' })` efter `resolveScope()` i hver GET handler.

### 🟡 MEDIUM

**L1-SEC-006** — Demo user auto-elevated to billing.manage at boot  
`server/billing-server.mjs:44-48, 74`  
`ensureDemoBillingCapability()` kører unconditionalt ved server start. I production med `AFTERGRAPH_REQUIRE_AUTH=true`, hvis `demo-user` er reachable via fallback (line 86), bliver requests uden bearer silently fuldt-capable billing admin.  
**Fix:** Gate bag `!requireAuth` eller `NODE_ENV !== 'production'`. Fjern `'demo-user'` fallback når `requireAuth=true`.

**L1-ARCH-002** — Dual trust boundary mellem billing-server og app-server  
`server/billing-server.mjs:62-76, 331-339` vs `server/app-server.mjs:189-215`  
To uafhængige auth/scope resolution systems med divergerende fallback-logik (`demo-user` vs `DEFAULT_ACTOR`) og tenant store resolution.  
**Fix:** Extract shared `createRequestScope()` factory brugt af begge servers.

**L1-SEC-007** — Body actor claim accepted before auth verification on POST  
`server/billing-server.mjs:182-183`  
`body.actor` bruges som identity før capability check. Når `requireAuth=false`, vælger caller sin egen identitet via request body.  
**Fix:** Valider `claimedActor` mod registered user selv når `requireAuth=false`.

**L1-SEC-005** (temporal) — Unsafe JSON.parse from query params  
`server/app-server.mjs:546,549`  
`JSON.parse(url.searchParams.get('event'))` uden try/catch. Malformed input lækker stack trace.  
**Fix:** Wrap i try/catch, return 422 på parse failure.

**L1-SEC-006** (action-guard) — In-memory idempotency with 5s TTL  
`src/action-guard.mjs:13-21`  
Tabes ved restart. Post-restart duplicate mutations mulige.  
**Fix:** Persist action guard records til workspace state file eller audit log.

### ✅ RESOLVED (fra tidligere audit)

- **L1-ARCH-001** (store race): `enqueueMutation` serialiserer korrekt via promise chain
- **L1-SUPPLY-001** (missing lockfile): package-lock.json exists, zero external deps confirmed

### ✅ POSITIVE VERIFICATIONS

- XSS: Alle innerHTML bruger `esc()` korrekt (`billing-app.mjs:31-38`)
- Path traversal: `static-handler.mjs:8-10` containment korrekt
- JSON serialization: Escaper `<>&U+2028U+2029` (`http-utils.mjs:3-13`)
- Ingen hardcoded secrets, ingen eval/exec, ingen console.log leakage
- Webhook token aldrig logged eller returneret i responses

---

## Kategori C — Functional & Product

### ✅ VERIFIED

**L2-STATE-001** — State machine sound  
Alle 4 states (needs_info/waiting/ready/invoiced) reachable via valid transitions. Unidirectional, ingen illegal jumps. `createBillingDraft` re-evaluerer readiness atomisk.

**L2-STATE-002** — Invoice status linear and idempotent  
`draft → issued → emailed`. Hver transition returnerer early hvis allerede i target state. Delivery failure bevarer `issued` med retryable `delivery.state=failed`.

**L2-FUNC-002** — billableHours fra verified actuals only  
Integer `workMinutes` required. Calendar duration aldrig brugt. Gross calculation: `Math.round((workMinutes * rateMinor) / 60)` sikrer integer minor units.

**L2-STATE-003** — Actuals locking post-invoice  
`recordBillingActual` og `correctBillingActual` checker `activeInvoiceForVisit()`. Non-void invoice blokerer mutation med `actuals_locked` (409).

**L2-FUNC-001** — Invoice sequence/uniqueness  
Auto-increment + uniqueness check mod non-void invoices. Manual numbers ≥ nextNumber advance sequence. Sequence reset rejects reuse af reserved numbers.

**L2-FUNC-002** — Issued invoice immutability  
Ingen mutation path eksisterer til at ændre issued invoice fields. Actuals locked once active invoice references visit.

**L2-FUNC-003** — PDF rendering deterministic  
Pure functions, ingen timestamps/random/external I/O. Samme input = identisk byte output.

**L2-FUNC-004** — Delivery receipt state machine  
Requires `provider`, `messageId`, `deliveredAt`. Fail-closed. Duplicate delivery idempotent på `emailed`.

**Offline read-only** — SW skipper non-GET, ingen mutation queue, financial buttons disabled offline  
**Cold reload** — Memory snapshot restore + SHA-256 token fingerprint identity binding  
**Concurrent mutations** — Server-side serialization via mutex, 409 på duplicate delivery  
**Negative values** — Rejected i alle lag (mutations, money, frontend)

### ⚠️ OBSERVATIONS

**L2-FUNC-001** — Visit-level discount overrides customer discount uden audit trail (LOW)  
`src/billing/money.mjs:6-14`

**L2-EDGE-001** — Date validation regex-only, accepterer `2026-02-30` (KNOWN)  
`src/billing/mutations.mjs:40`

**L2-EDGE-002** — Zero workMinutes accepted uden warning  
`src/billing/mutations.mjs:27`

**L2-EDGE-003** — Ingen max-length på issuer/customer fields  
Server trusts client-provided strings uden truncation.

### ❌ UNVERIFIED

**Peppol BIS 3.0 UBL Export** — COMP-601 blocker  
Lokal preflight OK, men ekstern Schematron-validator (`billingDocumentValidatorFromEnv`) ikke integreret i `/peppol-bis3` endpoint. Export producerer syntaktisk valid UBL XML men compliance verification mangler.

---

## Kategori D — UI & Accessibility

### 🔴 HIGH

**L3-CONS-002** — Dual token system  
`styles/tokens.css` vs `packages/brand/tokens.css` med divergerende farver. Brand-opdateringer propagerer ikke automatisk til billing. Dark mode værdier divergerer også.

### 🟡 MEDIUM

**L3-CONS-001** — Hardcoded spacing (28px, 58px, 96px...) i stedet for ADS space-tokens  
**L3-CONS-004** — Font sizes hardcoded (34px, 52px, 22px...) i stedet for ADS type-scale  
**L3-CONS-006** — Ingen explicit loading-state komponent (blank liste under fetch)  
**L3-A11Y-001** — Tablist mangler `aria-controls`, roving tabindex, Arrow/Home/End handlers  
**L3-A11Y-002** — Touch targets 36-40px, alle under WCAG 2.2 44px minimum  
**L3-A11Y-003** — `--success` (#15985d, 3.7:1) og `--warning` (#b57300, 3.9:1) fejler AA contrast  
**L3-A11Y-005** — Toast auto-dismiss 2400ms uden pause-on-hover/focus  
**L3-UX-004** — `issueInvoice` ingen confirmation dialog (irreversibel handling)  
**L3-USE-002** — Form errors generic `[role=alert]`, ingen field-level `aria-invalid`/`aria-describedby`

### LOW

**L3-CONS-003** — Local `.billing-page` color overrides uden dark mode counterparts  
**L3-CONS-005** — Dialog radius 20px vs ADS sheet 22px  
**L3-CONS-007** — Ingen single-column layout <400px  
**L3-A11Y-006** — Status dot aria-hidden men tekst ikke programmatisk linked  
**L3-A11Y-007** — Peppol button stale disabled state hvis connectivity ændres mens dialog åben  
**L3-UX-005** — Download ingen feedback hvis popup blocker forhindrer  
**L3-UX-006** — Header buttons ingen separation fra brand area på mobile  
**L3-UX-007** — Dialog focus setTimeout race condition

### ✅ POSITIVE

- XSS: Alle innerHTML bruger `esc()` korrekt
- Native `<dialog>` med backdrop, Escape, inert background
- `aria-live="polite"` på connection, summary, list, toast
- Alle inputs har `<label for="">`
- `prefers-reduced-motion` respekteret
- Focus-visible styling med accent ring
- Offline states: både `disabled` + `aria-disabled="true"`
- Heading hierarchy H1→H2→H3, ingen spring

---

## Kategori E — Verification

**E-001 Test Results (2026-09-13 @ fae2ec1f):**
- Full suite: **780/780 pass**, 0 fail, 16.1s
- Billing only: **114/114 pass**, 1.9s
- Source/distributed: **35/35 pass**, 0.6s

---

## External Blockers

| ID | Description | Owner | Impact |
|---|---|---|---|
| OPS-501 | Production backup/restore evidence missing | Infra/Ops | Blocks full release approval |
| COMP-601 | Peppol validator production contract missing | External vendor | Blocks production UBL export compliance |

---

## Remediation Priority

### P0 — Must-fix before merge
1. L1-SEC-005: Add capability checks to GET billing endpoints
2. L1-SEC-006: Gate demo-user elevation behind environment check
3. L3-CONS-002: Unify token systems (alias or migrate to ADS)

### P1 — Should-fix before merge
4. L1-ARCH-002: Extract shared scope resolution factory
5. L1-SEC-007: Validate claimedActor even when requireAuth=false
6. L3-A11Y-002: Increase touch targets to 44px minimum
7. L3-UX-004: Add confirmation dialog for issueInvoice

### P2 — Improve quality
8. L1-SEC-005 (temporal): Wrap JSON.parse in try/catch
9. L1-SEC-006 (action-guard): Persist idempotency state
10. L3-A11Y-001: Add keyboard navigation for tabs
11. L3-A11Y-003: Fix success/warning color contrast
12. L3-CONS-001/004: Replace hardcoded spacing/sizing with ADS tokens
13. L3-CONS-006: Add loading skeleton component

### P3 — Nice-to-have
14. L2-EDGE-001: Semantic date validation
15. L2-EDGE-003: Max-length enforcement on text fields
16. L3-A11Y-005: Toast pause-on-hover
17. L3-USE-002: Field-level form error associations
