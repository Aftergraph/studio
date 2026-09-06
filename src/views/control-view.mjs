import { AGNeedYou, AGEventRow, AGSourceTruthBadge } from '../../packages/ui/index.mjs';
import { escapeHtml } from '../ui-helpers.mjs';

function localRow(approval={}){
  return AGNeedYou({id:`need_${approval.id}`,type:'approval',title:approval.title||approval.id,severity:approval.risk==='destructive'?'high':'medium',detail:`${approval.risk||'bounded'} risk · ${approval.authority||'operator'}`,action:'show-control',targetId:approval.id});
}
function AGInstitutionSummary({ projection = null } = {}) {
  const organization = projection?.organization;
  if (!organization) return '<section class="ag-institution-summary" data-ag-component="institution-summary"><small>INSTITUTIONAL GRAPH</small><strong>No institution mounted</strong><p>Organization scope and policy state will appear here when an institutional owner is connected.</p><span>Authority: none</span></section>';
  return `<section class="ag-institution-summary" data-ag-component="institution-summary"><small>INSTITUTIONAL GRAPH</small><strong>${escapeHtml(organization.name)}</strong><p>${projection.memberships?.length||0} members · ${projection.policies?.length||0} policies</p><span>Authority: ${escapeHtml(projection.authority||'none')}</span></section>`;
}
function remoteRow(approval={}){
  const state=approval.status||approval.state||'pending';
  return `<article class="ag-upstream-approval ag-decision-card" data-state="${escapeHtml(state)}"><div><small>Trust Gateway</small><strong>${escapeHtml(approval.title||approval.tool||approval.id||'Decision')}</strong><span>${escapeHtml(state)}</span></div><div class="ag-decision-actions"><button type="button" class="ag-button quiet" data-upstream-approval="${escapeHtml(approval.id||'')}" data-upstream-decision="deny">Deny</button><button type="button" class="ag-button primary" data-upstream-approval="${escapeHtml(approval.id||'')}" data-upstream-decision="approve">Approve</button></div></article>`;
}

export function renderControlSurface({localApprovals=[],remoteApprovals=[],exceptions=[],events=[],service={},decisionError='',institutionalProjection=null}={}){
  const pendingLocal=localApprovals.filter(a=>(a.state||'pending')==='pending');
  return `<main id="main-content" class="ag-domain-page ag-calm-control" data-domain-surface="control">
    <header class="ag-domain-header ag-product-header"><div><small>CONTROL</small><h1>Control</h1><p>Intervene only where authority, risk or missing input requires a human decision.</p></div><span>${pendingLocal.length+remoteApprovals.length} pending</span></header>
    ${decisionError?`<div class="ag-control-error" role="alert">${escapeHtml(decisionError)}</div>`:''}
    <div class="ag-control-product-grid">
      <div class="ag-domain-main ag-control-attention">
        <section class="ag-domain-section"><div class="ag-section-heading"><span>Needs your decision</span><small>Human authority</small></div><div class="ag-attention-list">${pendingLocal.map(localRow).join('')||'<p class="ag-domain-empty">No local decisions are waiting.</p>'}</div></section>
        ${remoteApprovals.length?`<section class="ag-domain-section"><div class="ag-section-heading"><span>Enforcement decisions</span><small>Trust Gateway</small></div><div class="ag-upstream-approval-list">${remoteApprovals.map(remoteRow).join('')}</div></section>`:''}
        <section class="ag-domain-section"><div class="ag-section-heading"><span>Exceptions</span><small>${exceptions.length}</small></div><div class="ag-attention-list">${exceptions.map(n=>AGNeedYou({...n,action:'context-preview'})).join('')||'<p class="ag-domain-empty">No unresolved exceptions.</p>'}</div></section>
      </div>
      <aside class="ag-control-provenance"><section class="ag-domain-section"><div class="ag-section-heading"><span>Authority source</span>${AGSourceTruthBadge({owner:'Trust Gateway',contract:'approval.decide',sha:service.headSha||''})}</div><p class="ag-control-note">Consequential decisions are committed only after their authority owner confirms them.</p></section>${AGInstitutionSummary({projection:institutionalProjection})}<section class="ag-domain-section"><div class="ag-section-heading"><span>Recent audit</span><small>${events.length}</small></div>${events.slice(0,8).map(event=>AGEventRow({event})).join('')||'<p class="ag-domain-empty">No recent control events.</p>'}</section></aside>
    </div>
  </main>`;
}

export function renderControlView(context){return context.renderControl()}
