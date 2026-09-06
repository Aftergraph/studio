import { AGIcon, esc, attr } from '../shared.mjs';

export function AGTrajectory({steps=[],compact=false}) {
  const rows=steps.map((s,i)=>`<div class="ag-trajectory-step ${attr(s.state)}" data-step-index="${i}" data-state="${attr(s.state)}"><span class="ag-step-mark">${s.state==='completed'?AGIcon('check',{size:13}):'<i></i>'}</span><span class="ag-step-label">${esc(s.label)}</span><small>${esc(s.state)}</small></div>`).join('');
  return `<div class="ag-trajectory ${compact?'is-compact':''}" data-ag-component="trajectory" aria-label="Mission trajectory">${rows}</div>`;
}
