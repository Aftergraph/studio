/**
 * TypeScript definitions for @aftergraph/brand
 */

export interface BrandMetadata {
  name: string;
  altName: string;
  tagline: string;
  grammar: string;
  version: string;
  status: string;
  license: string;
}

export interface BrandColors {
  institutionBlack: string;
  graphMidnight: string;
  evidenceWhite: string;
  slate: string;
  controlCyan: string;
  evidenceTeal: string;
  authorityViolet: string;
  decisionAmber: string;
  systemBlue: string;
  danger: string;
}

export interface SemanticThemeTokens {
  canvas: string;
  canvasRaised: string;
  surface: string;
  surfaceStrong: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  control: string;
  evidence: string;
  authority: string;
  decision: string;
  system: string;
  danger: string;
  attention: string;
}

export interface BrandThemes {
  dark: SemanticThemeTokens;
  light: SemanticThemeTokens;
}

export interface BrandTokens {
  metadata: BrandMetadata;
  colors: BrandColors;
  typography: Record<string, unknown>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  depth: Record<string, number>;
  motion: Record<string, unknown>;
  grammar: readonly string[];
  theme: BrandThemes;
  assets: Record<string, unknown>;
}

export declare const BRAND_METADATA: BrandMetadata;
export declare const BRAND_COLORS: BrandColors;
export declare const BRAND_TYPOGRAPHY: Record<string, unknown>;
export declare const BRAND_SPACING: Record<string, number>;
export declare const BRAND_RADIUS: Record<string, number>;
export declare const BRAND_ELEVATION: Record<string, number>;
export declare const BRAND_MOTION: Record<string, unknown>;
export declare const BRAND_GRAMMAR: readonly string[];
export declare const BRAND_THEMES: BrandThemes;
export declare const BRAND_ASSETS: Record<string, unknown>;
export declare const BRAND_TOKENS: BrandTokens;

export declare function resolveBrandColor(role: string, theme?: 'dark' | 'light'): string | null;
export declare function getContrastRatio(hex1: string, hex2: string): number;
export declare function isAccessiblePair(fgHex: string, bgHex: string, level?: 'AA' | 'AAA', isLargeText?: boolean): boolean;

export default BRAND_TOKENS;
