---
version: alpha
name: Ledger
description: Precise tabular money, strong hierarchy, subtle glass chrome. Restrained institutional identity for billing and audit workflows.
colors:
  primary: "#0c52ef"
  secondary: "#4f5868"
  tertiary: "#087b49"
  neutral: "#f5f7fa"
  surface: "#ffffff"
  surface-dark: "#0e1630"
  canvas-dark: "#080c14"
  border: "#e2e6ec"
  danger: "#b52d3c"
  warning: "#8a5700"
typography:
  display:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-0.045em"
  headline:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: 740
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: 730
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: 4px
  md: 10px
  lg: 12px
  pill: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  button-primary-hover:
    backgroundColor: "#0a46cc"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 44px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 48px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 24px
  tab-active:
    textColor: "{colors.primary}"
    backgroundColor: "{colors.surface}"
---

## Overview

Ledger is a restrained institutional design system built for precision financial interfaces. It prioritizes tabular numerals, clear information hierarchy, and minimal visual noise. Glass effects are reserved for chrome elements only; content areas remain opaque for readability. The system supports light and dark themes with WCAG AA contrast compliance.

This is not a marketing landing page system. Every token serves audit-grade data presentation: aligned columns of money, unambiguous status indicators, and touch targets that meet WCAG 2.5.5 (44px minimum).

## Colors

- **Primary (#0c52ef):** Canonical state blue. Used exclusively for primary actions, active tabs, and links. Never for decorative elements.
- **Secondary (#4f5868):** Muted text for labels and metadata. Passes AA contrast on white and dark surfaces.
- **Tertiary (#087b49):** Success/verified state. Reserved for positive confirmations.
- **Neutral (#f5f7fa):** Canvas background in light mode. Reduces eye strain vs pure white.
- **Surface (#ffffff / #0e1630):** Card and panel backgrounds. Opaque, never translucent in content areas.
- **Danger (#b52d3c):** Error and destructive actions. Paired with icon + text, never color alone.
- **Warning (#8a5700):** Caution states. Dark amber chosen for AA contrast on both light and dark backgrounds.

Glass effect (`rgba(255,255,255,0.85)` backdrop-filter) is permitted ONLY on sticky headers and command palette overlays. Content cards, modals, and form fields must remain fully opaque.

## Typography

Inter for all interface text. JetBrains Mono for code, hashes, and technical identifiers. Tabular numerals (`font-variant-numeric: tabular-nums`) are mandatory on all monetary values, counts, and aligned data columns.

Type scale uses tight tracking (-0.045em to -0.01em) at display/headline sizes for density without heaviness. Body text at 14px/1.5 balances scanability with information density appropriate for audit work.

Font weights are deliberate: 760 for display (not 800+), 400 for body (not 300). This avoids the washed-out or overly-bold extremes that harm readability in data-heavy interfaces.

## Layout

Spacing scale is multiplicative (4px base): xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48. All component padding and margins derive from this scale. No magic numbers.

Touch targets: minimum 44px for interactive elements (WCAG 2.5.5). Inputs use 48px height to prevent iOS zoom on focus while maintaining alignment with adjacent buttons.

Safe area insets (`env(safe-area-inset-*)`) are applied on mobile viewports to respect device notches and home indicators.

## Components

`button-primary` is the sole high-emphasis action per view. Height 44px, padding 12px horizontal, border-radius 10px. Hover darkens to #0a46cc. Focus ring is 2px offset accent.

`input` fields are 48px tall (mobile-safe), with 12px vertical padding. Border is 1px `--border` color, transitioning to accent on focus. No box-shadow on rest state; focus adds `0 0 0 2px var(--accent-soft)`.

`card` containers use 12px radius, 24px padding, opaque surface. Shadow is `soft` token only on elevated cards (modals, dropdowns); list items and table rows have no shadow.

Tabs use bottom border indicator (2px solid accent) rather than filled backgrounds. This reduces visual weight and aligns with the restrained aesthetic.

## Do's and Don'ts

**Do:**
- Use tabular-nums on every monetary value and count
- Group related warnings/errors with their associated form fields
- Maintain 44px minimum touch targets on all interactive elements
- Test both light and dark themes at 390px and 1440px widths
- Use semantic color tokens, never raw hex in component CSS

**Don't:**
- Apply glass/translucency to content cards or form fields
- Use color alone to convey status (always pair with icon or text)
- Mix font weights within a single type level
- Override spacing scale with arbitrary pixel values
- Add decorative gradients or shadows to non-elevated elements
