import { AGIcon, esc, attr } from '../shared.mjs';

export function AGWorkSummary({mission,compact=false}) {
  if(!mission) return '';
  const progress=Math.max(0,Math.min(100,Number(mission.progress)||0));
  const budget=mission.budget||{};
  const currency=String(budget.currency||'€');
  return `<section class="ag-work-summary ${compact?'is-compact':''}" data-ag-component="work-summary" data-state="${attr(mission.state||'idle')}" data-verified="${mission.verified?'true':'false'}">${compact?'':`<header><span><small>Mission</small><strong>${esc(mission.title)}</strong></span><em>${esc(mission.state||'idle')}</em></header>`}<div class="ag-work-summary-progress" role="progressbar" aria-label="${attr(mission.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div><dl><div><dt>Progress</dt><dd>${progress}%</dd></div><div><dt>Agent</dt><dd>${esc(mission.agent||'Unassigned')}</dd></div><div><dt>Budget</dt><dd>${currency}${Number(budget.used||0).toFixed(1)} / ${currency}${Number(budget.max||0).toFixed(1)}</dd></div><div><dt>Evidence</dt><dd>${Number(mission.evidenceCount)||0}</dd></div></dl></section>`;
}
