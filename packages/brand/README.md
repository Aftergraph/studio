[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Aftergraph/brand/badge)](https://scorecard.dev/viewer/?uri=github.com/Aftergraph/brand)

# @aftergraph/brand

> **Canonical Brand OS and Design System for Aftergraph.**
> *"Infrastructure for verifiable intelligent systems"*

---

## Overview

The full production inventory is defined in [`BRAND-ASSET-MATRIX.md`](./BRAND-ASSET-MATRIX.md). Voice and positioning live in [`BRAND-VOICE.md`](./BRAND-VOICE.md); motion direction and generation-safe prompts live in [`motion/MOTION-SYSTEM.md`](./motion/MOTION-SYSTEM.md) and [`ASSET-GENERATION-PROMPTS.md`](./ASSET-GENERATION-PROMPTS.md).

`@aftergraph/brand` is the central source of truth for Aftergraph visual identity, design tokens, cryptographic iconography, and institutional UI contracts.

- **Status**: `provisional-not-trademark-cleared`
- **Identity**: Institutional Graph Brand
- **Grammar**: `graphs → boundaries → authority → execution → evidence → verified outcomes`
- **Accessibility**: Strict WCAG 2.2 AA / AAA compliance across all theme layers.

## Public communications

Use [`PUBLIC-LAUNCH-KIT.md`](./PUBLIC-LAUNCH-KIT.md) for canonical public positioning, channel-specific launch copy, research-claim boundaries, discovery vocabulary, calls to action and approved social assets.

Use [`PUBLIC-DISTRIBUTION-PLAN.md`](./PUBLIC-DISTRIBUTION-PLAN.md) for launch order, channel sequencing, audience routing, weekly cadence, conversion metrics and publication gates.

Public communications should lead with **verifiable intelligent systems** and must not silently upgrade research maturity, conformance evidence or provisional brand status.

---

## Palette

| Token | Hex | Role | Contrast on Black |
|---|---|---|---|
| `institutionBlack` | `#080C14` | Foundational canvas of truth | — |
| `graphMidnight` | `#0E1630` | Elevated graph workspace / panels | — |
| `evidenceWhite` | `#F5F7FA` | Primary data & typography | **18.2:1** (AAA) |
| `slate` | `#8993A4` | Boundaries & structural metadata | **6.1:1** (AA) |
| `controlCyan` | `#42C7E8` | Active governance & control gates | **10.5:1** (AAA) |
| `evidenceTeal` | `#24C4AD` | Verified outcomes & sealed proofs | **10.2:1** (AAA) |
| `authorityViolet` | `#7759E8` | Delegation & institutional authority | **3.5:1** (Display) |
| `decisionAmber` | `#F0A64A` | Approvals, alerts & checkpoints | **8.8:1** (AAA) |
| `systemBlue` | `#4C8BD8` | Infrastructure & message buses | **5.4:1** (AA) |

---

## Usage

### 1. CSS Custom Properties

```css
@import "@aftergraph/brand/tokens.css";

.governance-surface {
  background: var(--ag-brand-graph-midnight);
  color: var(--ag-brand-evidence-white);
  border: 1px solid var(--ag-brand-border);
}
```

### 2. JavaScript / ESM

```javascript
import { BRAND_COLORS, BRAND_TOKENS, resolveBrandColor } from "@aftergraph/brand";

const activeColor = resolveBrandColor('control', 'dark'); // "#42C7E8"
```

### 3. React Components

```jsx
import { BrandProvider, AftergraphWordmark, AftergraphMonogram, AftergraphAppIcon } from "@aftergraph/brand/react";

export function InstitutionalNav() {
  return (
    <BrandProvider theme="dark">
      <AftergraphMonogram size={32} />
      <AftergraphWordmark height={28} />
    </BrandProvider>
  );
}
```

### 4. Direct SVG Masters

SVG assets are organized in `svg/`, `identity/`, `semantics/`, and the surface-specific directories:
- `aftergraph-monogram.svg`: Canonical graph monogram
- `aftergraph-wordmark.svg`: Canonical wordmark
- `aftergraph-app-icon.svg`: High-fidelity squircle app icon
- `aftergraph-social-banner.svg`: 1280×640 social card
- `aftergraph-lockup-horizontal.svg`: Horizontal brand lockup
- `aftergraph-lockup-stacked.svg`: Stacked lockup
- `team-*.svg`: Six team identity marks

---

## Governing Principles

1. **One Source of Truth**: All visual assets derive from the SVG masters. No hand-edited raster files.
2. **Zero Decorative Fluff**: Every visual component communicates state, boundary, or verified evidence.
3. **Evidence Over Claims**: Visual consistency does not grant or inherit execution claims.

See [USAGE-RULES.md](./USAGE-RULES.md) and [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) for full contracts.
