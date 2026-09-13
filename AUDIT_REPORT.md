# Aftergraph Billing — Senior Full-Stack Audit

Audit date: 2026-09-13  
Audit mode: read-only repository, runtime, test and UI audit  
Scope: Aftergraph/studio Billing route, Billing API, source ingestion, delivery, auth boundary, persistence/backup, release evidence and Billing UI

## Audit status

**BLOCKED_FOR_RELEASE / NOT_READY_FOR_RELEASE**

The exact audited source is commit 11eeb75e9ffd3db330ca8b4e609cd71e3f1d8c4a on audit/billing-production. The same SHA is deployed on VDS device vmi3517816 and is the head of PR #55. PR #55 is OPEN and was not merged.

Severity labels:

- **CRITICAL / must-fix** — credible account takeover, irreversible financial corruption or equivalent release blocker.
- **HIGH / must-fix** — material financial, operational or compliance risk.
- **MEDIUM / should-fix** — important correctness, accessibility, evidence or maintainability gap.
- **LOW / nice-to-have** — bounded usability/design/reproducibility improvement.
- **UNVERIFIED** — the repository does not provide sufficient evidence; this is not treated as a pass.

## Scope, authority and threat model

| Dimension | Audited boundary |
|---|---|
| Repository | https://github.com/Aftergraph/studio.git, audit worktree at /root/workspace/aftergraph/studio-billing-audit |
| Branch and SHA | audit/billing-production, 11eeb75e9ffd3db330ca8b4e609cd71e3f1d8c4a |
| Remote feature head | feature/billing-workflow-v1 = 11eeb75e9ffd3db330ca8b4e609cd71e3f1d8c4a |
| Pull request | Aftergraph/studio#55, OPEN, mergedAt null |
| Runtime | VDS vmi3517816, release directory /opt/aftergraph-studio/releases/11eeb75e9ffd3db330ca8b4e609cd71e3f1d8c4a |
| Sensitive data | bearer tokens, tenant/customer identity, invoice snapshots, rates, actual work evidence, delivery state and PDF/Peppol documents |
| Allowed effects | read-only inspection, health checks and isolated probes using temporary in-memory fixtures; no known-user token was issued and no production provider send was intentionally triggered |
| Completion contract | produce a traceable report; do not change product code, force-push or merge PR #55 |

## Architecture and major modules

| Module | Actual implementation and purpose | Evidence |
|---|---|---|
| Browser Billing shell | Plain HTML/CSS and vanilla ES modules; no React/Next.js layer | billing/index.html, src/billing/billing-app.mjs, src/billing/pwa.mjs |
| Billing domain | ESM domain mutations, projections, readiness, source sync, document profiles and renderers | src/billing/*.mjs |
| HTTP/API | Node.js ESM server with route composition and file-backed workspace state | server/server.mjs, server/app-server.mjs, server/billing-server.mjs |
| Persistence | JSON state files with atomic temp-file rename, but an unsynchronized read-modify-write mutation path | src/server-store.mjs:41-66 |
| Auth | Bearer subject binding, HMAC magic-link tokens and capability checks | server/app-server.mjs, src/auth/*.mjs |
| Test/release system | Node test runner, static UI contracts, Python smoke harnesses and release verification gates | tests/billing*.test.mjs, scripts/a11y_smoke.py, scripts/v6_release_verify.mjs |
| Dependencies | Package declares no runtime dependencies and no lockfile is present | package.json; no package-lock.json, npm-shrinkwrap.json, pnpm-lock.yaml or yarn.lock |

# 1. Executive summary

The Billing implementation has a coherent domain boundary, strong source/invoice invariants in the tested paths, defensive HTTP headers/serialization, memory-only Billing offline handling and a substantial automated suite. The exact SHA is locally green on 757/757 total tests, 15/15 source-contract tests, 98/98 Billing tests, 49/49 release gates, verify:secrets and npm run verify. It is nevertheless not release-ready: an unauthenticated caller can reach magic-link token issuance for a supplied user identity, financial actuals can overwrite evidence after invoice issue, concurrent deliveries can call the provider twice, and the production backup timer is failed with no backup artifact observed. Fresh production Billing browser QA is also UNVERIFIED/BLOCKED by the cloud-browser-to-VDS network boundary, while the existing green accessibility gate does not exercise the Billing route.

# 2. Authoritative state and capability status

| Capability or claim | Status | Evidence-based assessment |
|---|---|---|
| Production Billing route/API exists | IMPLEMENTED | Direct VDS checks returned 200 for /billing/, /healthz and /readyz; anonymous Billing API access returned 401 |
| Auth required for ordinary protected API routes | PARTIAL | Bearer auth is enforced outside /api/v1/auth/, but the magic-link route is explicitly exempt and reaches user lookup without a bearer |
| Source sync and invoice ownership separation | IMPLEMENTED BUT UNVERIFIED in fresh runtime | Source suite 15/15 and source-ingestion tests pass; no new live tenant sync was run in this audit |
| Memory-only Billing offline projection | IMPLEMENTED | Persistent Billing read-cache helpers are absent; PWA tests assert no Billing read-cache or mutation replay |
| Fresh production Billing browser QA | BLOCKED / UNVERIFIED | Cloud browser reached the public endpoint only far enough to receive HTTPS 502 connection refused; standalone Playwright was not used |
| Peppol external validation | PARTIAL | Profile requires external validation, but the production server does not pass a validator and still emits XML |
| Production backup/recovery | BLOCKED | studio-state-backup.service failed with no_state_files; no state/manifest backup was found in searched production paths |
| Billing accessibility | PARTIAL / UNVERIFIED | Static contract checks exist, but the green a11y smoke scans other app modes, not /billing/; manual runtime evidence is absent |

# 3. Evidence ledger

| Check | Result |
|---|---|
| Full npm test | PASS: actual TAP count 757 tests, 757 passed, 0 failed |
| Billing source suite | PASS: 15/15 |
| All Billing tests | PASS: 98/98 |
| verify:secrets | PASS: 0 live secrets or credentials detected |
| git diff --check before report | PASS |
| v6 release verification | PASS: 49/49 gates |
| npm run verify | PASS: ALL WORKSPACE V5 VERIFY CHECKS PASS |
| npm audit --omit=dev | UNVERIFIED/FAILED: ENOLOCK because no lockfile exists |
| VDS /healthz | PASS, releaseSha matches audited SHA |
| VDS /readyz | PASS, but does not include backup health |
| VDS backup timer | ACTIVE timer; latest backup service execution FAILED with no_state_files |
| Fresh Billing browser QA | BLOCKED/UNVERIFIED by network boundary; not represented as a pass |

# 4. Lag 1 — Code quality, security and architecture

| ID | File:line | Severity | Finding and concrete evidence | Concrete fix |
|---|---|---|---|---|
| L1-SEC-001 | server/app-server.mjs:178, 675-686 | **CRITICAL — must-fix** | /api/v1/auth/ paths are exempted from the bearer requirement. POST /api/v1/auth/magic-link accepts body.actor and body.userId, then issues a token when the user exists. A no-bearer probe with actor=demo-user and a nonexistent user reached the user lookup and returned user_not_found, proving the authentication gate is bypassed. This is an account-takeover path for a known user ID; no known-user token was requested. | Split challenge initiation from token issuance. Require a trusted operator capability or possession of a one-time email challenge before issuing a token; never treat body.actor as authentication; bind/rate-limit the challenge to the intended user and audit the issuance. Add unauthenticated, known-user and replay tests. |
| L1-ARCH-001 | src/server-store.mjs:41-47 | **HIGH — must-fix** | WorkspaceStateStore.mutate clones and runs the mutator before assigning this.state, while persistence is chained separately. Two concurrent increments reproduced counter=1 instead of 2. A simultaneous invoice/settings/actual mutation can silently lose the other mutation. | Put the entire read-modify-write transition behind one per-store mutex/queue, including mutator execution, state assignment and persist. Add Promise.all concurrency tests for invoice sequence, actuals and settings. |
| L1-SEC-002 | src/billing/mutations.mjs:35-47; server/billing-server.mjs:205-218 | **HIGH — must-fix** | recordBillingActual replaces visit.actual without checking existing evidence, invoice binding or invoice status. An isolated probe changed a completed visit from 780 to 1 work minute after the invoice was issued. The operation has no conflict/correction record. | Make actual evidence append-only or reject a second value unless it is identical. After draft/issue, require an explicit correction workflow with reason, actor, audit event and invoice re-calculation/lock policy. Test issued, invoiced and concurrent correction cases. |
| L1-SEC-003 | server/billing-delivery.mjs:103-156; src/billing/mutations.mjs:161-176 | **HIGH — must-fix** | beginBillingDelivery only returns early for emailed. Two concurrent requests with different idempotency keys both entered pending and both called a delayed provider adapter; result was provider_calls=2 and both responses 200. This can duplicate customer email or external delivery. | Persist a per-invoice delivery claim/outbox with attempt ID and provider idempotency key. Reject or join an existing pending attempt, serialize/lease delivery and reconcile provider receipts after timeout. Add a concurrent delivery test. |
| L1-OPS-001 | scripts/state_backup.mjs:33-100; deploy/studio-state-backup.timer; server/app-server.mjs:205-218 | **HIGH — must-fix** | On VDS, studio-state-backup.service failed at 2026-09-13 03:15:05 CEST with state operation failed: no_state_files. No state or manifest backup was found in the searched production directories. /readyz reports ready from stateFile existence, configured auth and releaseSha only; it does not inspect last backup success. | Repair the state-file/backup path configuration, run and verify a real backup, perform a restore drill, retain checksummed manifests, and expose backup freshness/last-success in readiness or a separate operational health gate. Do not call the release ready while recovery evidence is absent. |
| L1-SEC-004 | src/billing/billing-app.mjs:7, 76-103; src/app/bootstrap.mjs:682 | **MEDIUM — should-fix** | The Billing financial read-cache was removed, but the existing bearer token remains in localStorage under aftergraph.auth.token. Any future XSS can exfiltrate the token. This is separate from the removed financial cache and was not changed by the current hardening. | Prefer an HttpOnly, Secure, SameSite session cookie or a memory-only short-lived token with rotation and revocation. Document the residual risk until the auth transport is migrated. |
| L1-TEST-001 | scripts/a11y_smoke.py:11, 51-88; scripts/v6_release_verify.mjs:56 | **MEDIUM — should-fix** | The green a11y smoke modes are chat, work, space, system and control; there is no /billing/ browser/axe run. tests/billing-ui-contract.test.mjs is primarily static regex/contract checking. A green release gate therefore does not prove Billing keyboard, focus, contrast, touch target or offline UI behavior. | Add a dedicated Billing browser/axe gate covering /billing/, 390px width, keyboard tabs/dialog, focus return, disabled offline actions, contrast and empty/loading/error states. Make it exact-head release evidence. |
| L1-SUPPLY-001 | package.json; repository root | **MEDIUM — should-fix** | No lockfile is present and npm audit --omit=dev exits ENOLOCK. This does not prove a vulnerable package, but dependency resolution, SBOM and vulnerability audit are not reproducible from the repo. | Add and review a lockfile, pin the supported Node/runtime toolchain, run npm audit or an equivalent SBOM scanner in CI, and document any intentional zero-runtime-dependency policy. |

No confirmed SQL/NoSQL injection, command injection or unsafe Billing innerHTML sink was found in the reviewed path. The Billing server uses a file-backed store, central JSON serialization and escaped dynamic UI content. SSRF and provider infrastructure were not exhaustively fuzz-tested; those areas remain UNVERIFIED beyond the observed HTTPS-only/env-configured adapter behavior.

# 5. Lag 2 — Function and product behavior

## Claim vs. Reality

| ID | Claim/status | Evidence and reality | Fix or decision |
|---|---|---|---|
| L2-CLAIM-001 | **HIGH — must-fix**<br>Peppol profile requires external validation | src/billing/document-profile.mjs:6-10 sets externalValidationRequired=true. server/billing-server.mjs:139-164 invokes a validator only when one is supplied. server/server.mjs builds billing options without a production validator. A valid internal document returned HTTP 200 without an external validator. | Fail closed with document_external_validator_unconfigured, or change the profile/product claim to explicitly say validation is optional. For a compliance export, fail-closed is the safer contract. |
| L2-FUNC-001 | **HIGH — must-fix**<br>Actuals capture is authoritative | src/billing/billing-app.mjs:689-696 sends only workMinutes. It does not preserve prior workers, startedAt or endedAt evidence, and the server can overwrite existing actuals (also L1-SEC-002). | Send a complete evidence object, preserve immutable prior evidence, reject conflicts and expose a correction flow. |
| L2-EDGE-001 | **MEDIUM — should-fix**<br>Dates are validated as YYYY-MM-DD | src/billing/mutations.mjs:15-20 checks only the shape. The probe accepted issueDate=2026-02-31 and normalized dueDate to 2026-03-11. | Validate calendar round-trip (year/month/day) and reject impossible dates before draft/issue. Add leap-day, month-end and timezone-boundary tests. |
| L2-EDGE-002 | **MEDIUM — should-fix**<br>Source payload is a governed contract | src/billing/source-sync.mjs:26-50 validates basic presence but not unique IDs, strict timestamps, end-after-start, ISO currency or nonnegative payment terms. A payload with duplicate customer IDs was accepted and the second record silently won. | Validate schema at the boundary: unique IDs, strict ISO dates/timestamps, schedule ordering, three-letter currency, terms >= 0 and duplicate visit/customer rejection. Return a typed 422/409 rather than silently overwriting. |
| L2-EDGE-003 | **MEDIUM — should-fix**<br>Source currency is renderable | source-sync accepts any truthy currency; Billing formatting uses Intl.NumberFormat. A currency value of $ caused a RangeError during render. | Enforce ISO 4217 at ingestion and provide a defensive UI fallback/error state so malformed upstream data cannot crash the projection. |
| L2-CLAIM-002 | **MEDIUM — should-fix / UNVERIFIED policy**<br>Monthly billing window closes on time | src/billing/readiness.mjs accepts now but discards it and derives billing_window_closed from statuses and same-month planned visits. No wall-clock cutoff is enforced in the inspected code. | Confirm the business rule. If closure is calendar/time based, pass a clock and enforce the cutoff; if status-derived by design, rename/document the claim and test the boundary explicitly. |
| L2-CLAIM-003 | **LOW — nice-to-have**<br>Invoice numbering is automatic | Browser flow omits number and gets the next sequence, but src/billing/mutations.mjs:50-67 accepts a caller-supplied manual number. | Decide whether manual numbering is a privileged correction/import capability. If not, remove it; otherwise validate format, authorization and audit reason. |

## Missing or weakly evidenced edge cases

- **Concurrent financial actions:** loss of update and duplicate delivery are confirmed above; no safe concurrent invoice-sequence proof exists beyond the isolated mutation tests.
- **Invalid numeric combinations:** negative work minutes are rejected, but paymentTermsDays can be negative in draft creation and is not fully validated in source sync.
- **Large datasets and N+1 behavior:** no production-scale or query-profile evidence was available; mark UNVERIFIED rather than assuming the file-backed store scales.
- **Loading, empty and error states:** static code contains loading/error/empty rendering paths, but fresh Billing browser evidence was blocked. Verify that every state is reachable and readable at 390px.
- **Delivery/provider outage recovery:** fail-closed behavior is present when no provider exists, but the persistent retry/reconciliation contract is incomplete because the delivery claim is not exclusive.

# 6. Lag 3 — UI system, design consistency and experience

## 6.1 UI consistency against the design system

The Billing UI uses a small, coherent primitive set: billing-quiet-button, billing-secondary-button, billing-primary-button, billing-tab, billing-field, status/queue rows and a native dialog. It consumes shared tokens such as canvas, surface, border, text, accent, success, warning and danger rather than embedding most colors directly.

| ID | Component/file | Lens and severity | Finding | Concrete fix |
|---|---|---|---|---|
| L3-CONS-001 | billing/index.html:1; styles/tokens.css:62-91 | **LOW — nice-to-have / UNVERIFIED product requirement** | Billing is permanently data-theme=light while a dark token set exists globally. No Billing dark-mode control or route contract was found. This is not a defect unless dark mode is an intended Billing capability. | Decide and document the theme contract. If Billing supports dark mode, bind the route to the theme token set and test both themes; otherwise remove/orphan-label unused Billing expectations. |
| L3-CONS-002 | styles/billing.css:74-86, 201-225, 345-373 | **POSITIVE / no finding** | Buttons, tabs, fields and states mostly use shared tokens and shared variants; no confirmed Billing-only color/spacing fork was found in the static review. | Preserve the token usage and add visual regression snapshots only after the runtime browser boundary is available. |

## 6.2 Usability heuristics

| ID | Component/file | Lens and severity | Finding | Concrete fix |
|---|---|---|---|---|
| L3-USE-001 | billing/index.html:77-85; src/billing/billing-app.mjs:421-429, 497-535 | **MEDIUM — should-fix** | The native dialog focuses its first field after opening, but closeDialog does not retain the triggering element or restore focus. Escape and fallback open behavior are not covered by a Billing browser test. | Store the trigger before opening, restore focus after close, test Escape/backdrop/submit paths and ensure focus is not lost when a save fails. |
| L3-USE-002 | src/billing/billing-app.mjs:681-706 | **MEDIUM — should-fix** | Save failures become a generic toast. The form uses native required/min validation, but no field-level server error or aria-describedby path was evidenced for business-rule errors such as conflicts or stale data. | Map coded server errors to inline, focusable messages tied to the relevant field/form; keep the toast as a summary and preserve entered values. |
| L3-USE-003 | src/billing/billing-app.mjs:752-756 | **POSITIVE / verified statically** | Connectivity loss updates state.online and calls render synchronously before async refresh, preventing a stale online affordance from remaining enabled. | Keep the regression test and cover reconnect/error timing in the browser gate. |

## 6.3 Accessibility — WCAG 2.2 AA

| ID | Component/file | Lens and severity | Finding and measured evidence | Concrete fix |
|---|---|---|---|---|
| L3-A11Y-001 | billing/index.html:47-61; src/billing/billing-app.mjs:281-285 | **MEDIUM — should-fix** | The tablist buttons expose aria-selected but no aria-controls/tabpanels, roving tabindex or Arrow/Home/End behavior. These controls behave like view navigation/filtering, so the simplest compliant fix may be ordinary navigation buttons rather than ARIA tabs. | Either implement the full tabs pattern or remove role=tablist/tab and use accessible buttons with an active state and deterministic keyboard behavior. |
| L3-A11Y-002 | styles/billing.css:81, 214, 442-448, 662-665, 752-756 | **MEDIUM — should-fix** | Several controls are below the requested 44x44px touch target: base buttons/tabs are 40px, icon button is 40px, mobile quiet buttons are 36px and mobile primary/secondary buttons are 38px. | Set interactive min-height/min-width to 44px at the Billing breakpoint, including close/icon buttons, while preserving visual density through padding and spacing. |
| L3-A11Y-003 | styles/tokens.css:33-34; styles/billing.css:131-190, 429-432, 467-493, 565-567 | **MEDIUM — should-fix** | Light-theme --text-3 #8993a4 is approximately 3.10:1 against white, below 4.5:1 for normal text. Success #15985d is approximately 3.70:1 and warning #b57300 approximately 3.88:1 when used as text. | Replace normal-text muted token with a darker value such as #5f6b7a (approximately 5.43:1 against white), use darker status-text variants, and retain icon/label text so meaning is not color-only. Recheck dark theme separately. |
| L3-A11Y-004 | tests/billing-ui-contract.test.mjs; scripts/a11y_smoke.py:11, 51-88 | **MEDIUM — should-fix** | Static UI assertions cover lang, labels, tokens and reduced motion, but there is no Billing axe/runtime test for focus order, keyboard operation, dialog return focus, disabled offline actions or 390px touch targets. | Make a Billing-specific runtime accessibility matrix part of release verification; record failures by exact SHA. Cross-reference L1-TEST-001. |

# 7. Prioritized action list

Ranking uses expected impact × probability divided by implementation effort. “Very high” means a small change can prevent a high-probability material failure; effort is an engineering estimate, not a delivery promise.

| Rank | ID | Priority | Immediate action | Effort |
|---:|---|---|---|---:|
| 1 | L1-SEC-001 | Very high | Close the unauthenticated magic-link issuance path and add challenge/authorization tests | 8-16 h |
| 2 | L1-SEC-002 | Very high | Make actual evidence immutable/conflict-safe and define post-issue correction workflow | 12-24 h |
| 3 | L1-SEC-003 | Very high | Add exclusive delivery claims/outbox and provider idempotency | 12-24 h plus provider verification |
| 4 | L1-ARCH-001 | Very high | Serialize state mutation transitions and test concurrent invoice/actual/settings writes | 8-16 h |
| 5 | L1-OPS-001 | Very high | Repair backup path, create a verified backup, run restore drill and gate readiness on freshness | 8-16 h plus operations window |
| 6 | L2-CLAIM-001 | High | Fail closed when Peppol external validator is absent, or explicitly downgrade the product claim | 4-12 h plus validator integration |
| 7 | L1-TEST-001 / L3-A11Y-004 | High | Add exact-head Billing browser and axe coverage; repeat fresh production QA from a reachable network | 8-16 h |
| 8 | L2-EDGE-002 / L2-EDGE-003 | High | Harden source schema validation and prevent malformed currency from crashing the UI | 8-16 h |
| 9 | L2-EDGE-001 | Medium-high | Add strict calendar-date validation and boundary tests | 2-6 h |
| 10 | L3-A11Y-002 / L3-A11Y-003 | Medium-high | Fix 44px targets and light-theme contrast, then verify with runtime axe/manual checks | 4-10 h |

# 8. Positive findings

- The exact SHA is reproducible enough to run a substantial local gate set: 757/757 total tests, 15/15 source tests, 98/98 Billing tests, 49/49 release gates, verify:secrets PASS and npm run verify PASS.
- Billing financial read-cache helpers were removed. The PWA path does not cache user-specific Billing API responses and has no mutation replay path; the intended open-session memory-only model is represented in code and tests.
- server/http-utils.mjs centralizes JSON serialization, escapes <, >, &, U+2028 and U+2029, and applies no-store/nosniff/referrer-policy style protections.
- server/static-handler.mjs applies path containment checks and a restrictive CSP; Billing dynamic HTML uses an esc() boundary before insertion.
- Capability separation is explicit: billing.sync and billing.manage are distinct from the source ingestion and invoice mutation paths; wildcard capabilities are not accepted.
- Source ingestion tests cover revision/payload idempotency, conflicting replay, ownership, no implicit delete and invoice/sequence separation.
- Delivery is fail-closed when no provider is configured, and emailed state is only set after a provider receipt in the reviewed path.
- The Billing connectivity race fix renders synchronously before refresh, and its targeted regression test passed.
- The UI declares Danish language/viewport metadata, has visible focus styling in reset.css, uses native dialog semantics, and exposes live connection/status regions.
- No credentials or token values were included in this report. No changes were made to product code, the forbidden worktree or RenOS.

# 9. Release decision and next execution boundary

The release should remain blocked until at least L1-SEC-001, L1-SEC-002, L1-SEC-003 and L1-OPS-001 are resolved and independently verified. L2-CLAIM-001 and the Billing browser/a11y evidence gate should be resolved before calling Peppol and the Billing UI production-ready. After remediation, rerun the complete local gates, run fresh production Billing browser QA from a network that can reach the VDS, verify GitHub CI and aggregate CodeQL on the exact final SHA, and update PR #55 evidence.

PR #55 remains OPEN and was not merged.

## Estimated closure effort by severity

| Severity | Estimated engineering effort |
|---|---:|
| Critical | 8-16 hours |
| High | 48-96 hours, excluding external Peppol/provider setup and operations scheduling |
| Medium | 32-60 hours |
| Low | 8-16 hours |

These estimates cover implementation, focused tests and review; they do not claim that external provider certification, security review or production change approval can be completed inside those hours.
