/**
 * @aftergraph/brand
 * Official brand identity, design tokens, visual assets, and UI contracts
 * for Aftergraph.
 */

export const BRAND_METADATA = Object.freeze({
  name: 'Aftergraph',
  tagline: 'Infrastructure for verifiable intelligent systems',
  grammar: 'graphs → boundaries → authority → execution → evidence → verified outcomes',
  version: '1.1.0',
  status: 'provisional-not-trademark-cleared',
  license: 'Apache-2.0',
});

export const BRAND_COLORS = Object.freeze({
  institutionBlack: '#080C14',
  graphMidnight: '#0E1630',
  evidenceWhite: '#F5F7FA',
  slate: '#8993A4',
  controlCyan: '#42C7E8',
  evidenceTeal: '#24C4AD',
  authorityViolet: '#7759E8',
  decisionAmber: '#F0A64A',
  systemBlue: '#4C8BD8',
  danger: '#FF6B7A',
});

export const BRAND_TYPOGRAPHY = Object.freeze({
  fontFamily: Object.freeze({
    interface: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    code: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    editorial: '"Source Serif 4", Georgia, "Times New Roman", serif',
  }),
  scale: Object.freeze({
    caption: 11,
    ui: 12,
    bodySm: 13,
    body: 14,
    bodyLg: 16,
    subhead: 18,
    title: 22,
    headline: 28,
    display: 34,
  }),
  weight: Object.freeze({
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    heavy: 780,
  }),
  lineHeight: Object.freeze({
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.65,
  }),
});

export const BRAND_SPACING = Object.freeze({
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
});

export const BRAND_RADIUS = Object.freeze({
  control: 8,
  button: 10,
  card: 12,
  surface: 16,
  sheet: 22,
  pill: 999,
});

export const BRAND_ELEVATION = Object.freeze({
  flat: 0,
  raised: 1,
  focus: 2,
  overlay: 3,
});

export const BRAND_MOTION = Object.freeze({
  micro: Object.freeze({ min: 90, max: 150, easing: [0.2, 0.8, 0.2, 1] }),
  state: Object.freeze({ min: 160, max: 260, easing: [0.2, 0.7, 0.2, 1] }),
  surface: Object.freeze({ min: 260, max: 420, easing: [0.16, 1, 0.3, 1] }),
  ambient: Object.freeze({ min: 1800, max: 5200, easing: 'linear' }),
});

export const BRAND_GRAMMAR = Object.freeze([
  'nodes',
  'edges',
  'boundaries',
  'gates',
  'receipts',
  'evidence',
  'verified-outcome',
]);

export const BRAND_THEMES = Object.freeze({
  dark: Object.freeze({
    canvas: BRAND_COLORS.institutionBlack,
    canvasRaised: BRAND_COLORS.graphMidnight,
    surface: 'rgba(14, 22, 48, 0.78)',
    surfaceStrong: 'rgba(20, 31, 64, 0.92)',
    text: BRAND_COLORS.evidenceWhite,
    textMuted: BRAND_COLORS.slate,
    border: 'rgba(137, 147, 164, 0.20)',
    borderStrong: 'rgba(66, 199, 232, 0.40)',
    control: BRAND_COLORS.controlCyan,
    evidence: BRAND_COLORS.evidenceTeal,
    authority: BRAND_COLORS.authorityViolet,
    decision: BRAND_COLORS.decisionAmber,
    system: BRAND_COLORS.systemBlue,
    danger: BRAND_COLORS.danger,
    attention: BRAND_COLORS.decisionAmber,
  }),
  light: Object.freeze({
    canvas: BRAND_COLORS.evidenceWhite,
    canvasRaised: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceStrong: '#ECEFF3',
    text: BRAND_COLORS.institutionBlack,
    textMuted: '#4F5868',
    border: '#E5E8ED',
    borderStrong: '#D7DCE3',
    control: '#0C52EF',
    evidence: '#15985D',
    authority: BRAND_COLORS.authorityViolet,
    decision: '#B57300',
    system: '#2367FF',
    danger: '#D24242',
    attention: '#B57300',
  }),
});

export const BRAND_STATES = Object.freeze({
  dark: Object.freeze({ canonical:'#42C7E8', observed:'#4C8BD8', proposed:'#7759E8', verified:'#24C4AD', unverified:'#8993A4', indeterminate:'#8993A4', stale:'#F0A64A', revoked:'#FF6B7A', conflict:'#F0A64A', unknown:'#8993A4', withheld:'#7759E8', unavailable:'#8993A4', superseded:'#4C8BD8' }),
  light: Object.freeze({ canonical:'#0C52EF', observed:'#2367FF', proposed:'#6346D8', verified:'#087B49', unverified:'#4F5868', indeterminate:'#4F5868', stale:'#8A5700', revoked:'#B52D3C', conflict:'#8A5700', unknown:'#4F5868', withheld:'#6346D8', unavailable:'#4F5868', superseded:'#205CA8' }),
});

export const BRAND_ASSETS = Object.freeze({
  svg: Object.freeze({
    monogram: './svg/aftergraph-monogram.svg',
    monogramMono: './svg/aftergraph-monogram-mono.svg',
    monogramInverse: './svg/aftergraph-monogram-inverse.svg',
    wordmark: './svg/aftergraph-wordmark.svg',
    wordmarkLight: './svg/aftergraph-wordmark-light.svg',
    lockupHorizontal: './svg/aftergraph-lockup-horizontal.svg',
    lockupHorizontalLight: './svg/aftergraph-lockup-horizontal-light.svg',
    lockupStacked: './svg/aftergraph-lockup-stacked.svg',
    appIcon: './svg/aftergraph-app-icon.svg',
    socialBanner: './svg/aftergraph-social-banner.svg',
    microMark: './identity/aftergraph-micro-mark.svg',
    teams: Object.freeze({
      platform: './svg/team-platform.svg',
      research: './svg/team-research.svg',
      security: './svg/team-security.svg',
      intelligence: './svg/team-intelligence.svg',
      product: './svg/team-product.svg',
      infrastructure: './svg/team-infrastructure.svg',
    }),
  }),
});

export const BRAND_TOKENS = Object.freeze({
  metadata: BRAND_METADATA,
  colors: BRAND_COLORS,
  typography: BRAND_TYPOGRAPHY,
  spacing: BRAND_SPACING,
  radius: BRAND_RADIUS,
  depth: BRAND_ELEVATION,
  motion: BRAND_MOTION,
  grammar: BRAND_GRAMMAR,
  theme: BRAND_THEMES,
  states: BRAND_STATES,
  assets: BRAND_ASSETS,
});

/**
 * Resolve semantic brand color based on token name and theme mode ('dark'|'light')
 */
export function resolveBrandColor(role, theme = 'dark') {
  const mode = theme === 'light' ? 'light' : 'dark';
  return BRAND_THEMES[mode][role] || BRAND_COLORS[role] || null;
}

/**
 * Compute relative luminance of a sRGB hex color
 */
function getRelativeLuminance(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate WCAG 2.2 contrast ratio between two hex colors
 */
export function getContrastRatio(hex1, hex2) {
  try {
    const l1 = getRelativeLuminance(hex1);
    const l2 = getRelativeLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return 1.0;
  }
}

/**
 * Validate WCAG 2.2 accessibility compliance for a foreground/background pair
 */
export function isAccessiblePair(fgHex, bgHex, level = 'AA', isLargeText = false) {
  const ratio = getContrastRatio(fgHex, bgHex);
  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7.0;
  }
  // Default AA
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}

export default BRAND_TOKENS;
