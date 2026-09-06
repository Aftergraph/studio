import { AGIcon, esc, attr } from '../shared.mjs';

export function AGSourceTruthBadge({owner='Aftergraph',contract='',sha=''}) {
  const short=String(sha||'').slice(0,8);
  return `<span class="ag-source-truth" data-ag-component="source-truth" title="Canonical source: ${attr(owner)}${contract?` · ${attr(contract)}`:''}${short?` · ${attr(short)}`:''}"><strong>${esc(owner)}</strong>${contract?`<small>${esc(contract)}</small>`:''}${short?`<code>${esc(short)}</code>`:''}</span>`;
}
