# @aftergraph/brand

> **Official Brand OS & Design System for Aftergraph / ABDE Intelligence.**  
> *"Infrastructure for governed autonomous intelligence"*

---

## Overview

`@aftergraph/brand` is the central source of truth for Aftergraph visual identity, design tokens, cryptographic iconography, and institutional UI contracts.

- **Status**: `provisional-not-trademark-cleared`
- **Identity**: Institutional Graph Brand
- **Grammar**: `graphs → boundaries → authority → execution → evidence → verified outcomes`
- **Accessibility**: Strict WCAG 2.2 AA / AAA compliance across all theme layers.

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

SVG assets are organized in `packages/brand/svg/`:
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
