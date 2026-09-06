# Aftergraph Design System (ADS) — Architectural Specification v1.0

> **Status**: Institutional Canonical Specification  
> **Brand**: Aftergraph (ABDE Intelligence)  
> **Tagline**: *"Infrastructure for governed autonomous intelligence"*  
> **Package**: `@aftergraph/brand`  
> **Repository**: `Aftergraph/brand`

---

## 1. Philosophical Foundations: Calm Intelligence

The Aftergraph Design System is constructed for mission-critical autonomous intelligence environments where cognitive fatigue, false certainty, and visual noise are unacceptable hazards.

1. **Zero Decorative Fluff**: Every pixel, edge, and gradient communicates state, provenance, or an institutional trust boundary. There are no ambient particle effects or generic "AI sparkles".
2. **Cryptographic Precision**: Visual weight, geometric alignment, and typography reflect the precision of formal methods, merkle DAGs, and state machine verification.
3. **Calm Confidence**: Dark-mode primary architecture reduces visual glare during continuous operations, using high-contrast crisp signals for actionable alerts.
4. **Boundary-Enforced Semantics**: Visual components strictly distinguish between detection proposals, runtime grants, durable executions, and verified evidence.

---

## 2. The Core Visual Grammar

The visual language follows the strict causal flow of governed autonomous work:

```
graphs  ──►  boundaries  ──►  authority  ──►  execution  ──►  evidence  ──►  verified outcomes
 (nodes)       (stroke)       (delegation)     (runtime)      (merkle)         (attestation)
```

- **Graphs (Nodes & Edges)**: Structural knowledge, causal relationships, agent interactions.
- **Boundaries**: Explicit cryptographic perimeters, tenant isolation, capability enclosures.
- **Authority**: Explicit delegation contracts, policy tokens, human approval gates.
- **Execution**: Sandboxed workers, deterministic transitions, durable state steps.
- **Evidence**: Cryptographically sealed execution receipts, audit trails, replay traces.
- **Verified Outcomes**: Attested state completions that meet all policy constraints.

---

## 3. Canonical Color Architecture

The system is anchored by 9 official institutional tokens:

| Token Name | Hex Code | Visual Role & Institutional Semantics |
|---|---|---|
| `institution_black` | `#080C14` | The foundational canvas of truth. The deepest dark ground upon which graphs are projected. |
| `graph_midnight` | `#0E1630` | Elevated graph workspace, ambient spatial background, container panels. |
| `evidence_white` | `#F5F7FA` | Primary data readouts, crisp institutional typography, certified receipts. |
| `slate` | `#8993A4` | Structural edges, inactive boundaries, secondary metadata, provenance timestamps. |
| `control_cyan` | `#42C7E8` | Active governance gates, primary interactive controls, real-time telemetry streams. |
| `evidence_teal` | `#24C4AD` | Verified outcomes, sealed cryptographic proofs, completed mission attestations. |
| `authority_violet` | `#7759E8` | Institutional authority, delegation contracts, normative policies, executive mandates. |
| `decision_amber` | `#F0A64A` | Human-in-the-loop checkpoints, pending approvals, escalation boundaries, warnings. |
| `system_blue` | `#4C8BD8` | Infrastructure transport, message buses, underlying kernel primitives. |

### Contrast & Accessibility Matrices

All foreground/background combinations meet or exceed WCAG 2.2 AA (4.5:1 for body, 3:1 for large display text and UI components):

- `#F5F7FA` on `#080C14`: **18.2:1** (WCAG AAA)
- `#42C7E8` on `#080C14`: **10.5:1** (WCAG AAA)
- `#24C4AD` on `#080C14`: **10.2:1** (WCAG AAA)
- `#F0A64A` on `#080C14`: **8.8:1** (WCAG AAA)
- `#8993A4` on `#080C14`: **6.1:1** (WCAG AA)
- `#4C8BD8` on `#080C14`: **5.4:1** (WCAG AA)

---

## 4. Typographic Hierarchy

Typography enforces strict separation between human narrative, computational truth, and editorial governance:

1. **Interface Typography**: `Inter` (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
   - High legibility at small sizes, tall x-height, clear numeric distinctions.
   - Used for all UI controls, navigation labels, status readouts, and data grids.
2. **Code & Cryptographic Typography**: `JetBrains Mono` (`ui-monospace, Menlo, Monaco, Consolas, monospace`)
   - Exact monospaced alignment for addresses, SHA-256 hashes, policy tokens, JSON envelopes, and terminal replay streams.
3. **Editorial & Formal Governance**: `Source Serif 4` (`Georgia, serif`)
   - Used selectively in legal charters, formal normative specs, and white paper publications.

### Scale

| Level | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `display` | 34px | Heavy (780) | 1.15 | Hero headings, mode banners |
| `title` | 22px | Bold (700) | 1.25 | Section headers, modal titles |
| `subhead` | 18px | Semibold (600) | 1.30 | Card titles, surface headers |
| `body` | 14px | Regular (400) | 1.50 | Primary narrative, descriptions |
| `bodySm` | 13px | Regular (400) | 1.45 | Dense list items, sidebar items |
| `ui` | 12px | Medium (500) | 1.40 | Button text, tabs, badges |
| `caption` | 11px | Regular (400) | 1.35 | Timestamps, hash previews |

---

## 5. Geometric Architecture & Iconography

### Graph Monogram Construction

The Aftergraph monogram represents an enclosed graph boundary containing an autonomous execution kernel:

- **Bounding Geometry**: Hexagonal boundary enclosing a 256×256 canvas.
  - Coordinate path: `M128 24 L218 76 L218 180 L128 232 L38 180 L38 76 Z`
  - Stroke: `10px` solid `#42C7E8` (Control Cyan).
- **Graph Edges**: Hexagonal internal ring with central vertical spine:
  - Coordinate path: `M78 92 L128 62 L178 92 L178 164 L128 194 L78 164 Z` and `M128 62 L128 194`
  - Stroke: `6px` solid `#F5F7FA` (Evidence White).
- **Node Anchors**: 6 circular vertices at each internal junction:
  - Center coordinates: `(128, 62)`, `(78, 92)`, `(178, 92)`, `(78, 164)`, `(178, 164)`, `(128, 194)`.
  - Radius: `10px` solid fill `#F5F7FA`.
- **Central Execution Kernel**: Diamond rhomboid positioned at the center:
  - Center: `(128, 128)`, coordinates: `M128 101 L155 128 L128 155 L101 128 Z`
  - Fill: `#42C7E8` (Control Cyan).

---

## 6. Elevation, Depth & Surface Layers

Surfaces are strictly layered to maintain operational hierarchy:

1. **Layer 0 (Canvas)**: `#080C14` — Base application shell, background ground.
2. **Layer 1 (Raised)**: `#0E1630` / `rgba(14,22,48,.78)` — Primary split panels, sidebars, conversation streams.
3. **Layer 2 (Focus / Card)**: `rgba(20,31,64,.92)` with `1px` border `rgba(137,147,164,.20)` — Active working artifacts, inspectors.
4. **Layer 3 (Overlay / Attention)**: Solid `#0E1630` with `1px` border `#42C7E8` and shadow `0 24px 80px rgba(0,0,0,.55)` — Consequential human-in-the-loop approvals, command palettes.

---

## 7. Motion & Calm Transitions

Motion is never decorative; it informs spatial continuity and state transitions:

- **Micro (90ms–150ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`)**: Hover highlights, button presses, focus indicators.
- **State (160ms–260ms, `cubic-bezier(0.2, 0.7, 0.2, 1)`)**: Tab switches, badge updates, status changes.
- **Surface (260ms–420ms, `cubic-bezier(0.16, 1, 0.3, 1)`)**: Artifact split entrance, modal presentations, drawer expansion.
- **Ambient (1800ms–5200ms, `linear`)**: Background system heartbeat, live telemetry pulse.
- **Reduced Motion Parity**: All animations collapse to immediate state transitions (`0ms`) when `prefers-reduced-motion: reduce` is detected.

---

## 8. Multi-Repo Consumption & Connectivity

The brand design system is distributed via `@aftergraph/brand`:

### CSS Usage
```css
@import "@aftergraph/brand/tokens.css";

.my-governance-surface {
  background: var(--ag-brand-graph-midnight);
  color: var(--ag-brand-evidence-white);
  border: 1px solid var(--ag-brand-border);
}
```

### JavaScript / ESM Usage
```javascript
import { BRAND_COLORS, BRAND_TOKENS, resolveBrandColor } from "@aftergraph/brand";

console.log(BRAND_COLORS.controlCyan); // "#42C7E8"
```

### React Usage
```jsx
import { AftergraphWordmark, AftergraphMonogram, BrandProvider } from "@aftergraph/brand/react";

export function Header() {
  return (
    <BrandProvider theme="dark">
      <AftergraphWordmark height={32} />
    </BrandProvider>
  );
}
```
