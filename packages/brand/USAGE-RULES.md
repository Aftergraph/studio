# Aftergraph Brand Usage Rules v1.0

> Status: **provisional-not-trademark-cleared**. Visual identity rules for the
> Aftergraph / ABDE Intelligence institutional graph brand. Part of the Brand OS
> master kit; canonical sources live in `@aftergraph/brand` and remote `Aftergraph/brand`.

---

## 1. Core Brand Statement & Philosophy

- **Name**: Aftergraph (Alternative / Institutional Descriptor: ABDE Intelligence)
- **Tagline**: *"Infrastructure for governed autonomous intelligence"*
- **Grammar**: `graphs → boundaries → authority → execution → evidence → verified outcomes`
- **Aesthetic**: Calm Intelligence, institutional confidence, cryptographic precision, zero decorative fluff, WCAG 2.2 AA accessibility.

---

## 2. Safe Area (Clear Space)

- **Graph Monogram**: The mark requires clear space on all sides equal to **the height of one node ring** (≈ 12.5% of the mark's width).
- No text, UI controls, or visual artifacts may intrude into this boundary perimeter.
- **Wordmark & Lockups**: Safe space equals **half the x-height of the wordmark** on all sides.
- For application icons, preserve a **20% padding buffer** to ensure compliance with iOS squircle, macOS icon grids, and GitHub App circular masking.

---

## 3. Minimum Display Sizes

- **Graph Monogram (Digital)**: `24px` width minimum. Below 24px, use the simplified 16px/32px favicon export.
- **Wordmark Lockup**: `120px` width minimum.
- **Stacked Lockup**: `64px` width minimum.
- **GitHub Avatar / App Icon**: Master at `512×512` or `1024×1024`; minimum display at `200×200`. Never allow browser downscaling of raw SVG to blur node anchors.
- **Print Formats**: Monogram ≥ `8mm`; Wordmark / Lockup ≥ `25mm`.

---

## 4. Contrast & Accessibility Rules

- **Institutional Dark Canvas (Primary)**:
  - Background: **Institution Black** (`#080C14`) or **Graph Midnight** (`#0E1630`).
  - Primary Content / Typography: **Evidence White** (`#F5F7FA`) — Contrast ratio **18.2:1** (WCAG AAA).
  - Primary Action / Focus: **Control Cyan** (`#42C7E8`) — Contrast ratio **10.5:1** (WCAG AAA).
  - Verified Outcomes / Seals: **Evidence Teal** (`#24C4AD`) — Contrast ratio **10.2:1** (WCAG AAA).
  - Muted Metadata / Boundaries: **Slate** (`#8993A4`) — Contrast ratio **6.1:1** (WCAG AA).
- **Light Canvas (Alternative)**:
  - Background: **Evidence White** (`#F5F7FA`) or pure White (`#FFFFFF`).
  - Primary Typography: **Institution Black** (`#080C14`) — Contrast ratio **19.1:1** (WCAG AAA).
  - High-contrast controls: `#0C52EF` (Control Blue) / `#15985D` (Evidence Green).
- **Prohibited Pairings**:
  - Never place `Control Cyan` (`#42C7E8`) directly on mid-tone grays or white without a dark container.
  - Never place `Slate` (`#8993A4`) on light gray backgrounds for critical legible text.

---

## 5. Logo Misuse Rules & Prohibitions

The mark **may**:
- Be scaled proportionally only (aspect ratio strictly preserved: 1:1 for monogram).
- Be recolored strictly using the canonical brand token palette.
- Be rotated only in canonical 90-degree increments (0°, 90°, 180°, 270°).

The mark **may NOT**:
- Be skewed, stretched, squashed, or visually distorted.
- Be styled with drop shadows, outer glows, skeuomorphic bevels, or photographic gradients.
- Be placed over busy, uncurated photographic backgrounds without a solid institutional scrim.
- Be used as a generic "AI / Sparkle" icon.
- Be merged with third-party marks without explicit Institutional Governance approval.
- Be claimed as a registered trademark (it remains provisional).

---

## 6. Export Rules & Source of Truth

- **Single Source of Truth**: All visual assets derive from the SVG masters in `packages/brand/svg/`.
- **Zero Manual Bitmaps**: Never manually paint or alter PNG/WebP exports in image editors. All raster assets must be programmatic rasterizations of the canonical SVGs.
- **Accessibility in SVG**: All SVG masters must include `role="img"` and descriptive `aria-label` attributes.
- **Real Typography in Diagrams**: Architectural diagrams must use real `<text>` nodes, never converted paths, preserving screen reader accessibility and searchability.

---

## 7. Multi-Repo Governance & Dogfooding

- Repositories in the Aftergraph organization (`trust-gateway`, `works-execution`, `aie`, `work-intelligence-v2`, `after-graph-governance`, `intelligence-systems-research`) consume brand tokens through `@aftergraph/brand` or the centralized token feed.
- **Separation of Concerns**: A shared visual identity does **not** convey shared execution claims. Runtime authority, durable execution, conformance guarantees, and scientific research claims remain strictly bounded within their respective repositories.
