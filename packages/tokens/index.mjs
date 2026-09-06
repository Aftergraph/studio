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

export const TOKENS = Object.freeze({
  color: Object.freeze({
    // Official Institutional Brand Primitives
    institutionBlack: BRAND_COLORS.institutionBlack,
    graphMidnight: BRAND_COLORS.graphMidnight,
    evidenceWhite: BRAND_COLORS.evidenceWhite,
    slate: BRAND_COLORS.slate,
    controlCyan: BRAND_COLORS.controlCyan,
    evidenceTeal: BRAND_COLORS.evidenceTeal,
    authorityViolet: BRAND_COLORS.authorityViolet,
    decisionAmber: BRAND_COLORS.decisionAmber,
    systemBlue: BRAND_COLORS.systemBlue,

    // Living Shell Semantic Dogfooding
    canvas: BRAND_COLORS.institutionBlack,
    canvasRaised: BRAND_COLORS.graphMidnight,
    surface: 'rgba(14,22,48,.78)',
    surfaceStrong: 'rgba(20,31,64,.92)',
    text: BRAND_COLORS.evidenceWhite,
    textMuted: BRAND_COLORS.slate,
    border: 'rgba(137,147,164,.18)',
    accent: BRAND_COLORS.controlCyan,
    accent2: BRAND_COLORS.authorityViolet,
    success: BRAND_COLORS.evidenceTeal,
    warning: BRAND_COLORS.decisionAmber,
    danger: BRAND_COLORS.danger,
    attention: BRAND_COLORS.decisionAmber,
    evidence: BRAND_COLORS.evidenceTeal,
    system: BRAND_COLORS.systemBlue,
  }),
  spacing: Object.freeze({ xs: 4, sm: 8, md: 12, lg: 18, xl: 24, xxl: 32 }),
  radius: Object.freeze({ control: 10, surface: 16, sheet: 22, pill: 999 }),
  density: Object.freeze({ compact: 0.82, comfortable: 1, spacious: 1.16 }),
  depth: Object.freeze({ flat: 0, raised: 1, focus: 2, overlay: 3 }),
  type: Object.freeze({ ui: 12, body: 14, title: 22, display: 34 }),
});

export const MOTION_TOKENS = Object.freeze({
  micro: Object.freeze({ min: 90, max: 150, easing: [0.2, 0.8, 0.2, 1] }),
  state: Object.freeze({ min: 160, max: 260, easing: [0.2, 0.7, 0.2, 1] }),
  surface: Object.freeze({ min: 260, max: 420, easing: [0.16, 1, 0.3, 1] }),
  ambient: Object.freeze({ min: 1800, max: 5200, easing: 'linear' }),
});
