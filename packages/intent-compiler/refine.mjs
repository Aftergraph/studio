import { renderIntent } from './renderers.mjs';

export const REFINEMENT_MODES = new Set([
  'clearer',
  'more-autonomous',
  'safer',
  'more-detailed',
  'shorter',
  'execution-ready',
]);

function copyAuthority(authority={}) {
  return {
    read:[...(authority.read || [])],
    write:[...(authority.write || [])],
    execute:[...(authority.execute || [])],
    network:[...(authority.network || [])],
    requiresApproval:[...(authority.requiresApproval || [])],
  };
}

function expands(before, after) {
  return ['read','write','execute','network'].some(key =>
    (after[key] || []).some(value => !(before[key] || []).includes(value))
  );
}
function refinedIR(ir, mode) {
  const next={...ir};
  if (mode === 'safer') {
    next.constraints=[...(ir.constraints || []),'Do not exceed explicitly granted authority.'];
  }
  if (mode === 'more-autonomous') {
    next.output={
      ...(ir.output || {}),
      contract:[...(ir.output?.contract || []),'Proceed independently within the granted authority and stop at approval boundaries.'],
    };
  }
  return next;
}

export function refineIntent(ir, mode, target='generic') {
  if (!REFINEMENT_MODES.has(mode)) {
    return {error:'REFINEMENT_UNSUPPORTED',refinement:{mode}};
  }

  const authorityBefore=copyAuthority(ir?.authority);
  const candidate=refinedIR(ir, mode);
  const authorityAfter=copyAuthority(candidate?.authority);

  if (expands(authorityBefore, authorityAfter)) {
    return {error:'AUTHORITY_EXPANSION',refinement:{mode}};
  }
  const rendered=renderIntent(candidate, target);
  return {
    refinement:{mode},
    artifact:{...rendered,authorityBefore,authorityAfter},
  };
}
