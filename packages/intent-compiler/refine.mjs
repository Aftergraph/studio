import { renderIntent } from './renderers.mjs';

export const REFINEMENT_MODES = new Set([
  'clearer','more-autonomous','safer','more-detailed','shorter','execution-ready',
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
  const next={...ir,constraints:[...(ir.constraints || [])],output:{...(ir.output || {}),contract:[...(ir.output?.contract || [])]}};
  const addConstraint=value=>{ if(!next.constraints.includes(value)) next.constraints.push(value); };
  const addOutput=value=>{ if(!next.output.contract.includes(value)) next.output.contract.push(value); };
  if (mode === 'clearer') addOutput('Use direct, unambiguous wording and explicit completion criteria.');
  if (mode === 'more-autonomous') addOutput('Proceed independently within the granted authority and stop at approval boundaries.');
  if (mode === 'safer') addConstraint('Do not exceed explicitly granted authority.');
  if (mode === 'more-detailed') addOutput('Include implementation detail, edge cases, and verification steps where relevant.');
  if (mode === 'shorter') addOutput('Keep the instruction concise and remove non-essential prose.');
  if (mode === 'execution-ready') addOutput('Make the instruction immediately actionable with ordered steps and a concrete done condition.');
  return next;
}

export function refineIntent(ir, mode, target='generic') {
  if (!REFINEMENT_MODES.has(mode)) return {error:'REFINEMENT_UNSUPPORTED',refinement:{mode}};
  const authorityBefore=copyAuthority(ir?.authority);
  const candidate=refinedIR(ir, mode);
  const authorityAfter=copyAuthority(candidate?.authority);
  if (expands(authorityBefore, authorityAfter)) return {error:'AUTHORITY_EXPANSION',refinement:{mode}};
  const rendered=renderIntent(candidate, target);
  return {
    refinement:{mode},
    artifact:{...rendered,authorityBefore,authorityAfter},
  };
}
