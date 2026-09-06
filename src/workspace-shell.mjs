import { DOMAINS } from './domain.mjs';

// Human-facing navigation deliberately exposes less than the canonical domain model.
// The interaction contract mirrors the strongest current AI workspace pattern:
// two first-class modes, unified recents/projects, and contextual output/control.
export const PRIMARY_MODES = Object.freeze([
  { id:'chat', label:'Chat', domain:'chat' },
  { id:'work', label:'Work', domain:'work' },
  { id:'space', label:'Space', domain:'work' },
]);

export const SIDEBAR_UTILITIES = Object.freeze([
  { id:'artifacts', label:'Artifacts', domain:'output' },
]);

// Backwards-compatible names for internal callers while the v3 shell is rolled out.
export const PRIMARY_NAV = PRIMARY_MODES;
export const WORKSPACE_NAV = SIDEBAR_UTILITIES;

const NAV_TO_DOMAIN = new Map([...PRIMARY_MODES, ...SIDEBAR_UTILITIES].map(item => [item.id, item.domain]));

export function canonicalDomainForNav(id) {
  return NAV_TO_DOMAIN.get(String(id || '').toLowerCase()) || null;
}

export function commandDomainEntries() {
  return DOMAINS.map(domain => ({
    id:`domain:${domain.id}`,
    title:domain.label,
    domain:domain.id,
    description:domain.description,
  }));
}

export function deriveWorkspaceLayout({
  device='desktop',
  domain='chat',
  artifactOpen=false,
  inspectorOpen=false,
  destructiveApproval=false,
} = {}) {
  const mobile = device === 'mobile';
  if (destructiveApproval) {
    return {
      domain,
      mobileModes:PRIMARY_MODES,
      primaryDensity:mobile ? 'compact-conversation' : 'conversation',
      artifactPresentation:artifactOpen ? 'background' : 'hidden',
      inspectorPresentation:'hidden',
      controlPresentation:'focus',
    };
  }
  return {
    domain,
    mobileModes:PRIMARY_MODES,
    primaryDensity:mobile ? 'compact-conversation' : 'conversation',
    artifactPresentation:artifactOpen ? (mobile ? 'fullscreen' : 'split') : 'hidden',
    inspectorPresentation:inspectorOpen ? (mobile ? 'sheet' : 'drawer') : 'hidden',
    controlPresentation:'inline',
  };
}
