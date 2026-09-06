import { escapeHtml } from '../ui-helpers.mjs';

function researchList(value){return Array.isArray(value)?value:[]}
function researchTitle(object){return object?.payload?.title||object?.payload?.name||object?.canonicalId||object?.graphId||'Research object'}

export function renderResearchSurface(snapshot={}){
  const objects=researchList(snapshot.objects).filter(object=>['research_program','study','experiment','claim','paper'].includes(object.type));
  const coverage=snapshot.now?.coverage||{complete:snapshot.phase==='current',unavailable:[]};
  const coverageLabel=coverage.complete?'Complete coverage':`Partial coverage${researchList(coverage.unavailable).length?` · ${researchList(coverage.unavailable).map(escapeHtml).join(', ')}`:''}`;
  const cards=objects.map(object=>{
    const freshness=String(object.freshness||'stale');
    const method=object.payload?.evidenceMethod||object.payload?.method||'inspect source evidence';
    const limitations=researchList(object.payload?.limitations);
    return `<article class="ag-federated-card" data-graph-id="${escapeHtml(object.graphId)}" data-freshness="${escapeHtml(freshness)}"><header><small>${escapeHtml(object.type.replaceAll('_',' '))}</small><span class="status-pill ${escapeHtml(freshness)}">${escapeHtml(freshness)}</span></header><h2>${escapeHtml(researchTitle(object))}</h2><small class="ag-runtime-authority">Runtime authority: none</small><dl><div><dt>Scientific owner</dt><dd>${escapeHtml(object.canonicalOwner||object.sourceIntegration||'unknown')}</dd></div><div><dt>Evidence method</dt><dd>${escapeHtml(method)}</dd></div><div><dt>Runtime authority</dt><dd><strong>none</strong></dd></div></dl>${limitations.length?`<p class="ag-federated-note">Limitations: ${limitations.map(escapeHtml).join(' · ')}</p>`:''}</article>`;
  }).join('');
  return `<main id="main-content" class="ag-domain-page ag-federated-domain" data-domain-surface="research"><header class="ag-domain-header"><div><small>RESEARCH</small><h1>Research</h1><p>Programs, studies, experiments and claims stay linked to their scientific evidence without becoming runtime authority.</p></div><span>${escapeHtml(coverageLabel)}</span></header><section class="ag-domain-section"><div class="ag-section-heading"><span>Research graph</span><small>${objects.length} objects</small></div><div class="ag-federated-grid">${cards||'<p class="ag-domain-empty">No research objects are currently available.</p>'}</div></section></main>`;
}
