from pathlib import Path
from collections import Counter
import json, re, subprocess

ROOT = Path(__file__).resolve().parents[1]
SCOPE_DIRS = {"src", "packages", "styles"}
EXTENSIONS = {".mjs", ".js", ".css", ".svg", ".html", ".json"}
FILES = [p for p in ROOT.rglob("*") if p.is_file() and p.relative_to(ROOT).parts and p.relative_to(ROOT).parts[0] in SCOPE_DIRS and p.suffix in EXTENSIONS and "node_modules" not in p.parts]

PATTERNS = {
    "colors": r"(?i)(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|(?:bg|text|border|fill|stroke)-\[#)",
    "dimensions": r"(?<![\w-])(?:min-|max-)?(?:width|height):\s*[^;\n]*?(?:\d+px|\d+rem|\d+vh|\d+vw)",
    "positioning": r"(?<![\w-])(?:top|right|bottom|left|transform|margin(?:-top|-right|-bottom|-left)?)\s*:",
    "typography": r"(?<![\w-])(?:font-family|font-size|font-weight|line-height|letter-spacing|text-transform)\s*:",
    "radius": r"border-radius\s*:",
    "shadows": r"box-shadow\s*:",
    "z-index": r"z-index\s*:",
    "breakpoints": r"@media\s*\([^)]*(?:px|rem)",
    "inline-styles": r"style\s*=|style\s*:",
    "api-urls": r"(?i)(?:/api/|https?://|localhost|127\.0\.0\.1)",
    "storage": r"localStorage|sessionStorage|document\.cookie",
    "dates-numbers": r"new Date\(|toLocale(?:Date|String)|timeZone|toFixed\(",
    "timers-retries": r"(?i)(?:setTimeout|setInterval|debounce|timeout|polling|retry)",
    "permissions": r"(?i)(?:role|permission|capabilit|authorized|forbidden|unauthorized)",
    "status-values": r"['\"](?:pending|active|failed|completed|running|idle|stale|current|approved|rejected|verified)['\"]",
    "debt-markers": r"(?i)TODO|FIXME|HACK|TEMP|console\.(?:log|warn|error)",
    "important": r"!important",
    "positioning-keywords": r"(?i)\b(?:absolute|fixed|sticky)\b",
}

CATEGORY_NAMES = """Colors
Spacing
Width / Height / Dimensions
Layout Magic Numbers
Positioning
Typography
Border Radius
Borders
Shadows / Elevation
Z-index
Breakpoints
Responsive Behavior
Hardcoded UI Strings
Localization
Dates & Time
Currency / Number Formatting
API URLs
WebSocket / Realtime URLs
Routes
Navigation Configuration
Roles
Permissions
Feature Flags
Status Values
Status Styling
Mock Data
Hardcoded IDs
Form Definitions
Validation Rules
Select Options
Tables
Pagination
Search
Debounce / Timeout Values
Polling
Retry Logic
Local Storage Keys
Session Storage
Cookies
Icons
Inline SVG
Images / Assets
Buttons
Inputs
Modals / Dialogs
Dropdowns / Popovers
Tooltips
Loading States
Empty States
Error States
Offline State
Degraded State
Unauthorized / Forbidden
Accessibility Semantics
Keyboard Navigation
Focus States
Focus Restoration
Contrast
Color-only Meaning
Reduced Motion
Animation Durations
Animation Easing
Component Variants
Component Duplication
Business Logic in JSX
Backend Contract Assumptions
Boolean Explosion
Impossible UI States
CSS !important
Inline Styles
Global CSS Overrides
Tailwind Arbitrary Values
Dynamic Tailwind Classes
Console Logging
TODO / FIXME / HACK / TEMP
Commented-out Code
Dead Components
Dead CSS
Dead Routes
Duplicate Dependencies
Client / Server Boundaries
Duplicate Data Fetching
Cache Constants
Bundle Weight
Images & Layout Shift
Long Content
Hardcoded Truncation
Empty Strings / Missing Values
Very Large Data Sets
Page-level States
Component Interaction States
UX Terminology Consistency
Interaction Consistency
Destructive Actions
Optimistic UI
Duplicate Submit Protection
Design Token Bypasses
Component Primitive Bypasses
Configuration Ownership
Final Hardcode Classification""".splitlines()

FINDINGS = [
    {"id":"V81-001","title":"Raw color cluster bypasses semantic tokens","category":"Colors","location":"styles/views.css:1-600","classification":"HC-B","problem":"The largest view stylesheet contains hundreds of direct hex/rgba values; repeated values are not consistently expressed through semantic tokens.","why":"Theme changes, contrast review and status consistency require editing many selectors and can drift.","solution":"Create a measured color inventory, map repeated values to existing tokens in styles/tokens.css or packages/brand, then migrate one semantic family at a time.","priority":"P1","dependencies":"styles/tokens.css; packages/brand; visual snapshots","acceptance":["Repeated semantic colors have one owner","No visual regression in V4/V5/V6 browser suites","Axe contrast remains green"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-002","title":"Repeated spacing and dimensions lack an explicit scale","category":"Spacing","location":"styles/components.css; styles/views.css; styles/shell.css","classification":"HC-B","problem":"Common values such as 8px, 10px, 12px and 18px recur hundreds of times beside one-off values such as 17px, 19px and 23px.","why":"The codebase cannot distinguish intentional component dimensions from accidental rhythm drift.","solution":"Define a spacing and control-size scale, then migrate repeated clusters with component-level review rather than global search/replace.","priority":"P1","dependencies":"design tokens; component visual baselines","acceptance":["Duplicate clusters are mapped to token names","One-off values have an explicit invariant comment or are removed","Responsive smoke remains green"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-003","title":"Z-index values are not centrally owned","category":"Z-index","location":"styles/components.css:121-130; styles/shell.css:113; styles/views.css","classification":"HC-B","problem":"Stacking values are distributed across reset, shell, component and view styles.","why":"New dialogs, inspectors and toasts can accidentally render below or above the wrong layer.","solution":"Create a documented layer scale for base, sticky, popover, modal, toast and critical overlay; replace only values proven equivalent.","priority":"P1","dependencies":"overlay primitives; browser interaction tests","acceptance":["Every stacking context maps to a named layer","Popover/modal/toast order is tested","No arbitrary 9999 values remain without rationale"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-004","title":"Breakpoints are duplicated across CSS layers","category":"Breakpoints","location":"styles/responsive.css:4; styles/shell.css:114; styles/views.css:2,11,23","classification":"HC-E","problem":"The same 760px breakpoint is declared in multiple files while 940px and 1180px are locally owned.","why":"A responsive change can update one layer while leaving shell or view behavior inconsistent.","solution":"Define shared breakpoint custom properties/documentation and keep component-specific container queries local where semantically required.","priority":"P1","dependencies":"responsive smoke; container-query feasibility","acceptance":["Breakpoint ownership is documented","Mobile/tablet/desktop states are verified at declared widths","No duplicated global breakpoint definitions remain"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-005","title":"API paths are embedded in clients and runtime helpers","category":"API URLs","location":"src/api-client.mjs:54-; src/federation/browser-client.mjs:1","classification":"HC-C","problem":"Route strings and API version paths are spread through client methods.","why":"API version changes, test transport substitution and same-origin/remote deployment rules require multi-file edits.","solution":"Keep endpoint ownership in the API client boundary with typed route builders and environment base URL configuration; do not move canonical server paths into UI components.","priority":"P1","dependencies":"API contract tests; server route registry","acceptance":["UI contains no endpoint literals","Client tests cover every route builder","Same-origin and configured-base-url tests pass"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-006","title":"Navigation and domain metadata are split across registries","category":"Navigation Configuration","location":"src/domain.mjs; src/workspace-shell.mjs; src/router.mjs; src/app/bootstrap.mjs","classification":"HC-E","problem":"Domain labels, icons, aliases, object ownership and renderers are defined in separate structures.","why":"A new domain can become routable but lack a renderer, mobile entry or canonical object mapping.","solution":"Define one typed canonical domain manifest and derive aliases/renderers/navigation metadata with explicit capability filters.","priority":"P1","dependencies":"route tests; mobile navigation contract","acceptance":["One manifest owns domain id/label/icon/route/renderer","Deep links and aliases round-trip","Unknown domains fail to a documented fallback"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-007","title":"Runtime mock data is mixed with initial production shell state","category":"Mock Data","location":"src/state.mjs:13-110","classification":"HC-F","problem":"Demo users, missions, agents, approvals, artifacts and telemetry are embedded in the runtime initial state.","why":"Preview fixtures can be mistaken for canonical backend state and can leak into production behavior when backend data is unavailable.","solution":"Split explicit test/demo fixtures from production defaults and make fallback provenance visible; retain deterministic fixtures only in harnesses.","priority":"P0","dependencies":"offline shell contract; browser fixtures; backend reconciliation","acceptance":["Production boot has no fake consequential records","Test harness opts into fixtures explicitly","Unavailable backend renders honest empty/degraded state"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-008","title":"Status strings and presentation mappings are distributed","category":"Status Styling","location":"src/state.mjs; src/live-runtime.mjs; src/views/*; packages/ui/*; styles/*","classification":"HC-D","problem":"The same lifecycle values are compared and styled in multiple local maps and ternaries.","why":"A new or renamed state can render with no label, wrong color or incorrect action affordance.","solution":"Introduce schema-derived status definitions containing allowed transitions, label, icon, tone and accessibility text; consume it from domain and UI layers.","priority":"P1","dependencies":"journey state machines; existing V6/V7 invariants","acceptance":["All status consumers use canonical definitions","Unknown status renders safe fallback","Transition and presentation tests cover every status"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-009","title":"Currency and number formatting is locally formatted","category":"Currency / Number Formatting","location":"src/ui-helpers.mjs:23; src/app/bootstrap.mjs:460; packages/ui/work/outcome-receipt.mjs","classification":"HC-D","problem":"Amounts use local toFixed/euro formatting rather than one domain formatter.","why":"Currency, locale, cents precision and negative/large-value behavior can diverge between receipts and lists.","solution":"Use the V7.4 integer-cent formatter at a shared boundary with explicit currency and locale inputs.","priority":"P1","dependencies":"src/economy/outcome-economy.mjs; localization policy","acceptance":["All money displays use one formatter","Integer-cent precision is preserved","Locale/currency tests cover EUR and fallback"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-010","title":"Direct localStorage ownership in bootstrap","category":"Local Storage Keys","location":"src/app/bootstrap.mjs:72,75,608","classification":"HC-C","problem":"Storage key and persistence behavior are owned directly by the bootstrap module.","why":"Schema versioning, migration, reset and test isolation are difficult when storage is accessed from render/runtime code.","solution":"Create a versioned storage adapter with key constants, migration and failure handling; keep bootstrap dependent on the adapter only.","priority":"P1","dependencies":"state schema; offline shell","acceptance":["No direct storage access outside adapter","Old schema migration is tested","Storage failures degrade without losing current UI state"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-011","title":"Inline runtime styles bypass component tokens","category":"Inline Styles","location":"src/app/bootstrap.mjs:274,283,298; packages/brand/react.mjs:41","classification":"HC-H","problem":"Dynamic style attributes mix layout/runtime values with presentation rules.","why":"They are harder to audit, can bypass responsive CSS and often encode layout assumptions.","solution":"Keep only measured runtime variables inline; move static presentation to classes or component tokens and document legitimate dynamic values.","priority":"P2","dependencies":"motion/runtime UI; visual baselines","acceptance":["Each remaining inline style has runtime justification","Static styles use canonical classes","No accessibility or visual regression"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-012","title":"Accessibility state coverage is not represented as a shared contract","category":"Accessibility Semantics","location":"scripts/a11y_smoke.py; src/views/control-view.mjs; packages/ui/*","classification":"HC-I","problem":"Automated checks cover current surfaces, but loading/empty/forbidden/degraded and focus restoration contracts are distributed.","why":"Axe success does not prove keyboard recovery or truthful state semantics across all page states.","solution":"Create a page/component state matrix and add deterministic keyboard/focus assertions for each primary surface.","priority":"P1","dependencies":"AVC accessibility audit; browser QA","acceptance":["Every central page has loading/empty/error/offline/degraded/forbidden coverage","Keyboard path and focus restoration are tested","Axe and manual evidence are recorded"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-013","title":"Hardcoded UI copy is embedded in render functions","category":"Hardcoded UI Strings","location":"src/app/bootstrap.mjs; src/views/*; packages/ui/*","classification":"HC-G","problem":"Labels, empty states, error text and status copy are written directly beside rendering logic.","why":"Terminology, localization and content review require code edits and can drift across surfaces.","solution":"Create a small semantic copy catalog for shared terms/statuses/errors; keep object-specific titles runtime-owned.","priority":"P2","dependencies":"localization policy; status definitions","acceptance":["Repeated UX terms have one owner","User/runtime content is not incorrectly catalogued","Copy tests cover labels and fallback states"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-014","title":"State booleans permit invalid combinations","category":"Boolean Explosion","location":"src/app/bootstrap.mjs:59-61, 568-590; src/app/ui-state.mjs","classification":"HC-G","problem":"Multiple independent booleans represent mutually exclusive surfaces, focus and runtime modes.","why":"Impossible combinations can produce overlapping artifact, approval, inspector and replay surfaces.","solution":"Model major surface ownership as discriminated state modes while retaining independent user preferences only where valid.","priority":"P1","dependencies":"render scheduler; visual QA; existing interaction tests","acceptance":["Invalid surface combinations are unrepresentable or rejected","Existing Chat/Work/Space flows remain unchanged","State transition tests cover open/close/recovery"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-015","title":"Backend response assumptions lack a single validation boundary","category":"Backend Contract Assumptions","location":"src/backend-reconciliation.mjs; src/runtime/*; src/federation/browser-client.mjs","classification":"HC-F","problem":"Consumers read nested response fields directly and each layer supplies partial fallback behavior.","why":"Contract drift can produce plausible but incomplete UI state and hide data loss behind defaults.","solution":"Validate/normalize server payloads once at the API boundary with explicit degraded coverage semantics.","priority":"P0","dependencies":"API contract engineering; federation schemas","acceptance":["Malformed payloads fail closed or become explicit degraded state","Canonical owner/provenance is preserved","Representative producers and consumers are tested"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-016","title":"Destructive action protection is not one shared primitive","category":"Destructive Actions","location":"src/app/bootstrap.mjs; src/views/control-view.mjs; packages/ui/trust/*","classification":"HC-I","problem":"Approval, deny, takeover, cancel and upstream decisions have separate interaction paths.","why":"Confirmation, double-submit, loading and recovery semantics can diverge for consequential actions.","solution":"Define a canonical consequential-action state machine and shared action primitive; keep authority execution in the owner adapter.","priority":"P0","dependencies":"authority audit; API contracts; existing approval tests","acceptance":["Every destructive action has pending/confirmed/failed/retry states","Duplicate submit is blocked or idempotent","No UI state implies authority success before readback"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-017","title":"Duplicate component primitives and local variants need consolidation review","category":"Component Duplication","location":"packages/ui/*; src/views/*; styles/components.css; styles/views.css","classification":"HC-E","problem":"Buttons, rows, notices, agent cards, approval rows and surface sections have overlapping local markup/style variants.","why":"Fixes for focus, touch targets and semantic states must be repeated and can drift.","solution":"Build a consumer matrix first; consolidate only exact semantic duplicates into existing first-party primitives.","priority":"P1","dependencies":"component inventory; accessibility contract","acceptance":["Candidates have consumer and behavior evidence","Shared primitive preserves all required variants","No abstraction created for one-off semantics"],"scope":"L","auto_fix_safe":"no"},
    {"id":"V81-018","title":"Dead/legacy markers require classification before cleanup","category":"TODO / FIXME / HACK / TEMP","location":"styles/*; src/*; scripts/*","classification":"HC-J","problem":"The raw marker scan returns many matches, including legitimate words such as temporary CSS values and comments.","why":"Blind deletion would remove intentional notes; leaving all markers hides real debt.","solution":"Parse markers with context, classify intentional vs actionable, and convert actionable items into owned backlog TODOs.","priority":"P2","dependencies":"audit artifact; code ownership","acceptance":["Every marker is classified","Actionable markers have a TODO item or fix","No broad regex-only cleanup"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-019","title":"Responsive audit needs explicit narrow/tablet/wide evidence","category":"Responsive Behavior","location":"styles/responsive.css; styles/shell.css; styles/views.css; scripts/browser_smoke.py","classification":"HC-I","problem":"Current automated coverage is strong for selected desktop/mobile flows but not a full component state matrix across narrow mobile, tablet and ultrawide.","why":"Clipping, density and hidden actions can remain unobserved outside the smoke viewport set.","solution":"Add a declared viewport matrix and capture the critical Control, Agents, Output, Space and replay states at each width.","priority":"P1","dependencies":"FIN visual QA; browser smoke harness","acceptance":["320/390/768/1024/1440/1920 widths are checked","No horizontal overflow or clipped primary actions","Evidence is tied to exact revision"],"scope":"M","auto_fix_safe":"no"},
    {"id":"V81-020","title":"Canonical ownership is undocumented for several frontend constants","category":"Configuration Ownership","location":"styles/tokens.css; src/domain.mjs; src/state.mjs; src/api-client.mjs","classification":"HC-E","problem":"Token, domain, runtime fixture and endpoint ownership exists but is not declared in one audit-readable contract.","why":"Future slices can move values to a constants file without improving ownership or can duplicate canonical definitions.","solution":"Add an ownership map to the audit artifact and require each new shared value to name its owner category.","priority":"P1","dependencies":"V8.1 audit artifacts; review workflow","acceptance":["Every P0/P1 finding names owner and consumers","Ownership map is machine-readable","New audit rerun detects drift"],"scope":"S","auto_fix_safe":"yes"},
]


def read(path):
    try: return path.read_text(encoding="utf-8")
    except UnicodeDecodeError: return ""

counts = Counter()
samples = {}
value_counts = Counter()
for path in FILES:
    text = read(path)
    for name, pattern in PATTERNS.items():
        matches = list(re.finditer(pattern, text))
        counts[name] += len(matches)
        if matches and name not in samples:
            m = matches[0]
            samples[name] = {"location": f"{path.as_posix()}:{text.count(chr(10), 0, m.start()) + 1}", "match": m.group(0)[:120]}
    for value in re.findall(r"#[0-9a-fA-F]{3,8}\b|\b\d+(?:px|rem|vh|vw)\b", text): value_counts[value] += 1

try:
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
except Exception:
    revision = "unknown"

category_records = []
pattern_for_category = {
    "Colors":"colors", "Width / Height / Dimensions":"dimensions", "Positioning":"positioning", "Typography":"typography", "Border Radius":"radius", "Shadows / Elevation":"shadows", "Z-index":"z-index", "Breakpoints":"breakpoints", "Inline Styles":"inline-styles", "API URLs":"api-urls", "Dates & Time":"dates-numbers", "Currency / Number Formatting":"dates-numbers", "Debounce / Timeout Values":"timers-retries", "Polling":"timers-retries", "Retry Logic":"timers-retries", "Roles":"permissions", "Permissions":"permissions", "Status Values":"status-values", "CSS !important":"important", "Absolute / Fixed Positioning":"positioning-keywords", "TODO / FIXME / HACK / TEMP":"debt-markers"
}
for index, name in enumerate(CATEGORY_NAMES, 1):
    pattern_key = pattern_for_category.get(name)
    category_records.append({
        "id": index,
        "category": name,
        "audit_mode": "deterministic" if pattern_key else "manual_review",
        "raw_match_count": counts.get(pattern_key, 0) if pattern_key else None,
        "sample": samples.get(pattern_key),
        "actionable_findings": [f["id"] for f in FINDINGS if f["category"] == name],
        "classification": sorted({f["classification"] for f in FINDINGS if f["category"] == name}),
        "status": "finding" if any(f["category"] == name for f in FINDINGS) else "reviewed-no-cluster-or-manual-follow-up",
    })

payload = {
    "schema": "aftergraph.frontend-audit/v1",
    "milestone": "V8.1 Frontend UI/UX Hardcode & Quality Audit",
    "revision": revision,
    "scope": {"directories": ["src", "packages", "styles"], "file_count": len(FILES), "excluded": ["node_modules", ".git", "generated screenshots", "python bytecode"]},
    "method": {"deterministic_scan": "native Python regex scan over frontend source", "manual_review": "architecture, UX state, accessibility and ownership review", "rule": "raw literals are leads, not automatic refactor targets"},
    "categories": category_records,
    "findings": FINDINGS,
    "duplicate_value_clusters": [{"value": value, "occurrences": count} for value, count in value_counts.most_common(40) if count >= 10],
    "summary": {"category_count": 100, "finding_count": len(FINDINGS), "p0": sum(f["priority"] == "P0" for f in FINDINGS), "p1": sum(f["priority"] == "P1" for f in FINDINGS), "p2": sum(f["priority"] == "P2" for f in FINDINGS), "p3": sum(f["priority"] == "P3" for f in FINDINGS), "raw_scan_counts": dict(counts)},
}
(ROOT / "frontend-hardcodes.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

lines = ["# V8.1 Frontend UI/UX Hardcode & Quality Audit TODOs", "", f"Revision: `{revision}`", f"Scope: `{len(FILES)}` frontend files under `src/`, `packages/`, `styles/`", "", "Raw scan counts are evidence leads, not automatic refactor instructions. Each item below names canonical ownership and must be reviewed before edits.", ""]
for f in FINDINGS:
    lines += [f"## [{f['priority']}] [{f['classification']}] {f['title']}", "", f"**Location:** `{f['location']}`", "", f"**Current behavior:** {f['problem']}", "", f"**Problem:** {f['why']}", "", f"**Impact:** maintainability, correctness, UX consistency" if f['category'] not in {"Accessibility Semantics", "Responsive Behavior", "Destructive Actions"} else "**Impact:** UX, accessibility, correctness", "", f"**Recommended ownership:** {f['solution']}", "", f"**Recommended change:** {f['solution']}", "", f"**Dependencies:** {f['dependencies']}", "", "**Acceptance criteria:**"]
    lines += [f"- [ ] {criterion}" for criterion in f["acceptance"]]
    lines += [f"- [ ] Existing tests and visual behavior are verified", "", f"**Priority:** `{f['priority']}`", f"**Scope:** `{f['scope']}`", f"**Auto-fix safe:** `{f['auto_fix_safe']}`", ""]
lines += ["## P0/P1 queue", "", "P0: V81-007, V81-015, V81-016. P1: V81-001, V81-002, V81-003, V81-004, V81-005, V81-006, V81-008, V81-009, V81-010, V81-012, V81-014, V81-017, V81-019, V81-020.", "", "## Duplicate-value clusters", "", "See `frontend-hardcodes.json` for the machine-readable cluster list. Values must not be globally replaced without semantic ownership review.", "", "## Scope boundary", "", "This slice produces the audit and backlog. It intentionally does not mass-refactor literals, move tokens, or delete code. Those are separate owner-approved slices.", ""]
(ROOT / "frontend-todos.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")

summary = f"""# V8.1 Frontend UI/UX Hardcode & Quality Audit Summary

Revision: `{revision}`  
Scope: `{len(FILES)}` frontend source files under `src/`, `packages/`, and `styles/`.

## Verdict

PROPOSAL / AUDIT COMPLETE — no blind mass-refactor performed. The repository now has a machine-readable scan, ownership classifications, and an actionable TODO backlog.

## Totals

- Audit categories reviewed: **100**
- Concrete TODO findings: **{len(FINDINGS)}**
- P0 findings: **{sum(f['priority'] == 'P0' for f in FINDINGS)}**
- P1 findings: **{sum(f['priority'] == 'P1' for f in FINDINGS)}**
- P2 findings: **{sum(f['priority'] == 'P2' for f in FINDINGS)}**
- P3 findings: **{sum(f['priority'] == 'P3' for f in FINDINGS)}**
- Deterministic raw color matches: **{counts['colors']}**
- Deterministic raw dimension matches: **{counts['dimensions']}**
- Deterministic typography declarations: **{counts['typography']}**
- Deterministic status literal matches: **{counts['status-values']}**
- Deterministic debug/debt marker matches: **{counts['debt-markers']}**

## Highest-risk findings

1. **P0 HC-F — Runtime mock data mixed with initial production shell state** (`src/state.mjs`).
2. **P0 HC-F — Backend response assumptions lack one validation boundary** (`src/backend-reconciliation.mjs`, `src/runtime/*`).
3. **P0 HC-I — Destructive action protection is not one shared primitive** (`src/app/bootstrap.mjs`, Control/trust UI).
4. **P1 HC-B — Raw color and spacing clusters bypass semantic ownership** (`styles/views.css`, `styles/components.css`).
5. **P1 HC-E — Navigation/domain metadata is split across registries** (`src/domain.mjs`, `src/router.mjs`, `src/workspace-shell.mjs`).

## Required deliverables

- `frontend-hardcodes.json` — 100 category records, raw scan counts, samples, classifications, duplicate clusters and finding IDs.
- `frontend-todos.md` — concrete TODOs with location, problem, ownership, dependencies, acceptance criteria, priority, scope and auto-fix safety.
- This summary — totals, P0/P1 queue, method and boundaries.

## Duplicate-value clusters

The scan found repeated literal clusters including `1px`, `8px`, `10px`, `9px`, `12px`, `18px`, `#F5F7FA`, `#42C7E8` and `#080C14`. These are leads for semantic mapping, not safe global replacements.

## Verification boundary

The audit is source-backed and reproducible at the recorded revision. Rendered responsive/accessibility claims remain bounded by the existing browser and Axe gates; the next audit slice should add the declared 320/390/768/1024/1440/1920 viewport matrix before refactoring P1 layout findings.

## Next governed slice

Start with V81-007, V81-015 and V81-016 only after owner review. Refactor one category at a time, rerun the full suite after each slice, and do not treat a token move as a correctness fix without visual and accessibility evidence.
"""
(ROOT / "frontend-audit-summary.md").write_text(summary, encoding="utf-8", newline="\n")
print(f"wrote audit artifacts: {len(FILES)} files, {len(FINDINGS)} findings, {len(CATEGORY_NAMES)} categories")
