import { AGIcon, esc, attr } from '../shared.mjs';

export function AGMetric({value,label,delta='',tone='default'}) {
  return `<div class="ag-metric" data-ag-component="metric" data-tone="${attr(tone)}"><strong>${esc(value)}</strong><span>${esc(label)}</span>${delta?`<small>${esc(delta)}</small>`:''}</div>`;
}

export function AGNotice({title,detail='',tone='info',action='',actionLabel=''}) {
  return `<section class="ag-notice" data-ag-component="notice" data-tone="${attr(tone)}" role="status"><span class="ag-notice-mark">${AGIcon(tone==='success'?'check':tone==='warning'?'shield':'sparkle',{size:15})}</span><span><strong>${esc(title)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</span>${action?`<button type="button" data-action="${attr(action)}">${esc(actionLabel||'Open')}</button>`:''}</section>`;
}

export function AGContextSummary({conversation='None',mission='None',agent='Friday',authority='Scoped',evidence=0,backend='local'}) {
  return `<dl class="ag-context-summary" data-ag-component="context-summary" data-backend="${attr(backend)}"><div><dt>Conversation</dt><dd>${esc(conversation)}</dd></div><div><dt>Mission</dt><dd>${esc(mission)}</dd></div><div><dt>Agent</dt><dd>${esc(agent)}</dd></div><div><dt>Authority</dt><dd>${esc(authority)}</dd></div><div><dt>Evidence</dt><dd>${Number(evidence)||0} records</dd></div><div><dt>Runtime</dt><dd>${backend==='connected'?'Server-backed':'Local reference'}</dd></div></dl>`;
}
