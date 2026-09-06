import { AGIcon, esc, attr } from '../shared.mjs';

export function AGUpstreamServiceRow({id,label,service={}}) {
  const state=!service.configured?'unconfigured':service.online?'online':'offline';
  const short=String(service.headSha||service.sha||'').slice(0,8);
  return `<div class="ag-upstream-service-row" data-ag-component="upstream-service-row" data-upstream="${attr(id)}" data-state="${attr(state)}"><span class="ag-upstream-state"><i></i></span><span><strong>${esc(label)}</strong><small>${esc(service.role||'upstream')} · ${esc(state)}</small></span><span class="ag-upstream-provenance">${short?`<code>${esc(short)}</code>`:''}<small>${esc(service.repo||'')}</small></span></div>`;
}

export function AGExternalWorkRow({work={}}) {
  const title=work.title||work.objective||work.id||'WORKS work';
  return `<button type="button" class="ag-external-work-row" data-ag-component="external-work-row" data-upstream-work="${attr(work.id||'')}" data-state="${attr(work.state||'unknown')}"><span>${AGIcon('trajectory',{size:15})}</span><span><strong>${esc(title)}</strong><small>Execution authority · WORKS · ${esc(work.state||'unknown')}</small></span>${AGIcon('arrow',{size:12})}</button>`;
}

export function AGDetectionProposalRow({item={}}) {
  const title=item.title||item.summary||item.id||'Detected work';
  return `<div class="ag-detection-proposal-row" data-ag-component="detection-proposal-row" data-work-intelligence="${attr(item.id||'')}" data-state="${attr(item.status||'unknown')}"><span>${AGIcon('search',{size:15})}</span><span><strong>${esc(title)}</strong><small>Proposal only · ${esc(item.source||'unknown source')} · Explicit promotion required</small></span><em>${esc(item.status||'observed')}</em></div>`;
}
