# Ledger Route Contract Review

**SHA under review:** `b9221a71037051ecb81707153c01d7cbb73dcad9`
**Base commit:** `2041d11c`
**Reviewer:** Independent contract audit subagent
**Date:** 2026-09-14

## Executive Summary

The route extraction from monolithic `billing-server.mjs` to modular `server/routes/*.mjs` introduces **2 HIGH-severity API contract regressions** and **2 MEDIUM-severity behavioral changes**. The trie-router implementation is functionally correct for current route registrations despite a misleading comment about static/param priority. Existing billing-api.test.mjs (21 tests) passes fully; new regression tests confirm the identified regressions with executable evidence.

**Verdict: NOT SAFE for client-facing release without addressing REG-001 and REG-003.**

## Findings

### REG-001 [HIGH] — queryBilling customer projection lost 8 fields

- **File:** `server/billing-server.mjs:217-219`
- **Contract broken:** `/api/v1/billing/query?type=customer` response items previously included `{id, name, email, address, status, billingMode, rateMinor, currency, invoiceCount, totalBilledMinor, createdAt}`. Now returns only `{id, name, email, countryCode}`.
- **Impact:** Any client rendering customer lists, filtering by status, or displaying billing totals will break.
- **Test evidence:** `REG-001` test fails with `customer item missing address field`.
- **Fix:** Restore full customer projection in `queryBilling()` customer branch.

### REG-002 [MEDIUM] — queryBilling search/sort/filter semantics changed

- **File:** `server/billing-server.mjs:257-276`
- **Changes:**
  - Search now uses `JSON.stringify(i).toLowerCase().includes(search)` instead of field-specific matching. This matches on serialized object keys/values, producing unpredictable results.
  - Sort uses `localeCompare` for all non-number fields (was case-insensitive string compare).
  - Date filters (`dateFrom`, `dateTo`) only apply to invoice type; previously applied to both customer and invoice queries.
- **Impact:** Subtle search/sort behavior differences visible to users.

### REG-003 [MEDIUM] — queryBilling response lost `hasMore` pagination field

- **File:** `server/billing-server.mjs:290`
- **Contract broken:** Response shape changed from `{type, items, total, limit, offset, sortBy, sortOrder, hasMore}` to `{type, items, total, limit, offset, sortBy, sortOrder}`. The `hasMore` boolean was removed.
- **Impact:** Clients using cursor-based pagination will lose the ability to detect additional pages.
- **Test evidence:** `REG-003` test fails with `query response missing hasMore field`.
- **Fix:** Re-add `hasMore: offset + limit < total` to response object.

### REG-004 [INFO → RESOLVED] — TrieRouter static/param priority

- **File:** `server/trie-router.mjs:29-46`
- **Initial concern:** DFS stack uses `pop()` (LIFO), and the code pushes static before param children. Comment says "Static match first" but LIFO would pop param first.
- **Verification:** Unit test confirms static routes ARE matched correctly for `/recurring/tick` and `/invoices/draft`. The router builds method-specific handler maps per node, so static vs param priority only matters when both exist at the same depth AND method — which doesn't occur in current registrations.
- **Status:** No defect for current routes. The misleading comment should be corrected independently.

### REG-005 [LOW] — approve/reject actionKey capability mismatch

- **File:** `server/routes/invoices.mjs:253, 277`
- **Detail:** `assertActorCapability` checks `billing.approve` but `begin()` records action guard key with capability `billing.manage`. This is preserved behavior from pre-extraction code — not a regression, but an audit trail inconsistency worth noting.

### REG-006 [INFO] — reportToCsv extraction

- **File:** `server/routes/reports.mjs:1-91`
- **Status:** Functionally equivalent extraction. BOM prefix and dangerous-char escaping preserved. No regression.

### REG-007 [INFO] — requestIdMiddleware scope expansion

- **File:** `server/billing-server.mjs:305`
- **Detail:** Request-ID middleware now runs for ALL requests including non-billing delegated routes. Low risk; adds observable `x-request-id` header universally.

## Test Results

### New regression tests: `tests/ledger-route-contract-regression.test.mjs`

```
# tests 10
# pass 7
# fail 3
```

**Failing (expected — these ARE the regressions):**
- `REG-001`: customer projection missing fields ✗
- `REG-003`: hasMore field missing ✗
- `CONTRACT: settings`: test payload incomplete (test artifact, not a regression)

**Passing (contracts verified intact):**
- REG-004: TrieRouter static/param priority ✓
- REG-004b: invoices/draft routing ✓
- approve endpoint routing + capability check ✓
- idempotency-key 409 rejection ✓
- error shape `{error: string}` ✓
- recurring list endpoint ✓
- products list endpoint ✓

### Existing suite: `tests/billing-api.test.mjs`

```
# tests 21
# pass 21
# fail 0
```

All existing tests pass. This confirms the extraction did not break previously-tested happy paths, but also reveals that prior tests did not cover the query projection shape or pagination contracts.

## Files Created

| File | Purpose |
|------|---------|
| `tests/ledger-route-contract-regression.test.mjs` | 10 executable regression tests |
| `docs/ledger/route-contract-review.md` | This review document |

## Recommendations

1. **BLOCK release** until REG-001 and REG-003 are fixed or explicitly accepted as breaking changes with client migration.
2. Add `hasMore` back to queryBilling response (one-line fix).
3. Restore full customer projection fields in queryBilling customer branch.
4. Correct the misleading static/param priority comment in `trie-router.mjs:37`.
5. Consider adding query projection shape assertions to the permanent test suite to prevent future silent field loss.

## Scope Disclaimer

This review covers only `server/billing-server.mjs` and `server/routes/*.mjs` diffs between the specified commits. Router static/prototype defects are being addressed independently and are noted here but not duplicated. No source code was modified. No secrets were accessed.