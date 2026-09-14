# Aftergraph Billing Remediation Plan

**Source:** AUDIT_REPORT.md (2026-09-13 @ fae2ec1f)  
**Status:** READ-ONLY PLAN — ingen kodeændringer i dette dokument  
**PR Target:** #55 (audit/billing-production → main)

---

## P0 — Must-fix before merge

### R-001: L1-SEC-005 — GET billing capability checks

**File:** `server/billing-server.mjs`  
**Lines:** 111-179 (4 GET handlers)  
**Change:** Tilføj capability check efter `resolveScope()` i hver GET handler.

```mjs
// FØR (line 111-118):
const scope = resolveScope({ store, bearer, claimedActor: null, users, requireAuth });
const invoices = selectBillingInvoices(scope.state);
json(res, { invoices });

// EFTER:
const scope = resolveScope({ store, bearer, claimedActor: null, users, requireAuth });
assertActorCapability({
  state: scope.state,
  actor: scope.actor,
  capability: 'billing.read',
  users
});
const invoices = selectBillingInvoices(scope.state);
json(res, { invoices });
```

**Gentag for:** `/artifact` (line ~120), `/document` (line ~133), `/peppol-bis3` (line ~141).  
**Ny capability:** Tilføj `'billing.read'` til `capability-set.mjs` eller reuse `'billing.manage'` hvis read/manage ikke skal adskilles.  
**Test:** Add test i `tests/billing-api.test.mjs`: authenticated user uden billing capability → 403 på alle GET endpoints.

---

### R-002: L1-SEC-006 — Demo-user elevation gate

**File:** `server/billing-server.mjs`  
**Lines:** 44-48, 74, 86  
**Change:** Gate demo-user bag environment check + fjern fallback i production.

```mjs
// FØR (line 74):
ensureDemoBillingCapability(store, users);

// EFTER:
if (!requireAuth) {
  ensureDemoBillingCapability(store, users);
}

// FØR (line 86):
const actor = bearer || claimed || 'demo-user';

// EFTER:
const actor = bearer || claimed;
if (!actor) {
  if (requireAuth) throw new Error('authentication_required');
  actor = 'demo-user'; // kun reachable når requireAuth=false
}
```

**Test:** Verify at `AFTERGRAPH_REQUIRE_AUTH=true` + no bearer → `authentication_required` error (ikke silent demo-user).

---

### R-003: L3-CONS-002 — Unify token systems

**Files:** `styles/tokens.css`, `styles/billing.css`  
**Change:** Alias semantic tokens til ADS primitives.

```css
/* FØR (styles/tokens.css): */
--success: #15985d;
--danger: #d24242;
--bg: #ffffff;

/* EFTER (styles/tokens.css): */
@import '../packages/brand/tokens.css';

:root {
  --success: var(--ag-brand-evidence);
  --danger: var(--ag-brand-critical);
  --bg: var(--ag-brand-canvas);
  /* ... remaining aliases ... */
}
```

**Fjern:** Local overrides i `.billing-page` (`billing.css:18-22`) — promotér til named tokens med dark mode support hvis nødvendigt.  
**Verify:** Visual regression test (screenshot diff) før/efter.

---

## P1 — Should-fix before merge

### R-004: L1-ARCH-002 — Shared scope resolution

**New file:** `server/request-scope.mjs`

```mjs
export function createRequestScope({ store, bearer, claimedActor, users, requireAuth }) {
  // Unified implementation replacing both:
  // - billing-server.mjs:resolveScope (lines 77-97)
  // - app-server.mjs:rescope (lines 189-215)
  // Single source of truth for auth, tenant isolation, fallback logic
}
```

**Refactor:** Replace both `resolveScope` og `rescope` med import fra `request-scope.mjs`.  
**Test:** Existing auth/isolation tests skal fortsat passere.

---

### R-005: L1-SEC-007 — Validate claimedActor

**File:** `server/billing-server.mjs`  
**Line:** 182-189  
**Change:**

```mjs
// FØR:
const claimedActor = body.actor;
const scope = resolveScope({ store, bearer, claimedActor, users, requireAuth });
begin({ store, scope, method, path, key, actor: scope.actor });

// EFTER:
const claimedActor = body.actor;
if (claimedActor && !users.has(claimedActor)) {
  return json(res, { error: 'unknown_actor' }, 422);
}
const scope = resolveScope({ store, bearer, claimedActor, users, requireAuth });
begin({ store, scope, method, path, key, actor: scope.actor });
```

---

### R-006: L3-A11Y-002 — Touch targets ≥44px

**File:** `styles/billing.css`  
**Lines:** 87, 220, 449, 676, 767  
**Change:**

```css
/* FØR: */
.billing-primary-button { min-height: 40px; }
.billing-quiet-button { min-height: 36px; }

/* EFTER: */
.billing-primary-button { min-height: 44px; }
.billing-quiet-button { min-height: 44px; padding-block: 8px; }
```

**Mobile:** Justér `@media (max-width: 760px)` breakpoints tilsvarende.  
**Verify:** Axe-core target-size audit.

---

### R-007: L3-UX-004 — Issue invoice confirmation

**File:** `src/billing/billing-app.mjs`  
**Line:** ~598-617 (`issueInvoice` function)  
**Change:**

```mjs
// FØR:
async function issueInvoice(invoiceId) {
  const result = await client.issueBillingInvoice({ invoiceId });
  showToast('Faktura udstedt');
  refresh();
}

// EFTER:
async function issueInvoice(invoiceId) {
  const confirmed = await showConfirmDialog({
    title: 'Udsted faktura?',
    message: 'Denne handling kan ikke fortrydes. Fakturaen låses og sendes.',
    confirmLabel: 'Udsted',
    cancelLabel: 'Annuller'
  });
  if (!confirmed) return;
  const result = await client.issueBillingInvoice({ invoiceId });
  showToast('Faktura udstedt');
  refresh();
}
```

**Implementér:** `showConfirmDialog()` som wrapper omkring native `<dialog>` (reuse existing dialog pattern).

---

## P2 — Improve quality

### R-008: L1-SEC-005 (temporal) — JSON.parse safety

**File:** `server/app-server.mjs`  
**Lines:** 546, 549  

```mjs
// FØR:
const event = JSON.parse(url.searchParams.get('event') || '{}');

// EFTER:
let event = {};
try {
  event = JSON.parse(url.searchParams.get('event') || '{}');
} catch {
  return json(res, { error: 'invalid_event_json' }, 422);
}
```

### R-009: L1-SEC-006 (action-guard) — Persist idempotency

**File:** `src/action-guard.mjs`  
**Change:** Write completed action keys to `state.auditLog` eller dedicated durable store. Minimum: append `{ key, completedAt }` til workspace state ved completion.

### R-010: L3-A11Y-001 — Tab keyboard navigation

**File:** `src/billing/billing-app.mjs`  
**Change:** Add `keydown` handler på tablist container:
- ArrowLeft/ArrowRight: move focus between tabs
- Home: first tab
- End: last tab  
Add `aria-controls="<panel-id>"` til hver tab. Implementér roving tabindex.

### R-011: L3-A11Y-003 — Color contrast fix

**File:** `styles/tokens.css`  
**Change:**

```css
/* FØR: */
--success: #15985d; /* 3.7:1 vs white */
--warning: #b57300; /* 3.9:1 vs white */

/* EFTER: */
--success: #0b7a47; /* 5.9:1 vs white ✓ */
--warning: #8a5700; /* 5.1:1 vs white ✓ */
```

**Dark mode:** Verify mod dark canvas også.

### R-012: L3-CONS-001/004 — ADS spacing/type tokens

**File:** `styles/billing.css`  
**Change:** Systematisk replace hardcoded values:
- `28px` → `var(--ag-brand-space-lg)`
- `34px` font → `var(--ag-brand-type-title)`
- etc.  
Mapping table fra ADS tokens.css.

### R-013: L3-CONS-006 — Loading skeleton

**File:** `src/billing/billing-app.mjs` + `styles/billing.css`  
**Change:** Render skeleton rows (3-5 placeholder cards med pulse animation) mens `refresh()` kører. Fjern når data loaded.

---

## P3 — Nice-to-have

| ID | Fix | Effort |
|---|---|---|
| R-014 | L2-EDGE-001: Semantic date validation (`new Date()` roundtrip check) | Low |
| R-015 | L2-EDGE-003: Max-length enforcement på text fields | Low |
| R-016 | L3-A11Y-005: Toast pause-on-hover/focus | Medium |
| R-017 | L3-USE-002: Field-level `aria-invalid` + `aria-describedby` | Medium |
| R-018 | L3-CONS-003: Remove `.billing-page` local color overrides | Low |
| R-019 | L3-CONS-005: Dialog radius 20px → 22px (ADS sheet) | Trivial |
| R-020 | L3-A11Y-007: Dynamic Peppol button disabled state update | Low |

---

## Implementation Order

1. **R-001 + R-002** (security, independent, test-first)
2. **R-003** (tokens, visual regression risk — do after security)
3. **R-004** (refactor, depends on R-001/R-002 being stable)
4. **R-005 + R-006 + R-007** (P1 batch, parallel)
5. **R-008 through R-013** (P2, pick by sprint capacity)
6. **R-014 through R-020** (P3, backlog)

## Verification Gates per Remediation

| Remediation | Required Tests | Visual Check | Axe Check |
|---|---|---|---|
| R-001 | New 403 test for unauthorized GET | No | No |
| R-002 | Auth-required + no-bearer → error | No | No |
| R-003 | Existing tests pass | Screenshot diff | No |
| R-004 | All auth/isolation tests pass | No | No |
| R-005 | Unknown actor → 422 test | No | No |
| R-006 | Existing layout tests | Mobile viewport | Target-size |
| R-007 | Cancel flow test + confirm flow test | No | No |
| R-011 | Contrast ratio verification | Color swatch | Color-contrast |

---

## External Blockers (NOT solvable by code)

| ID | Action Needed | Owner |
|---|---|---|
| OPS-501 | Produce + verify production backup/restore runbook | Infra team |
| COMP-601 | Integrate external Peppol Schematron validator in `/peppol-bis3` endpoint | External vendor + backend |

Disse kræver ekstern koordinering. Audit kan ikke lukke dem.
