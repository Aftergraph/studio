import { AGIcon, esc, attr } from '../shared.mjs';

export function AGEvidence({records=[]}) {
  return `<div class="ag-evidence" data-ag-component="evidence" aria-label="Evidence">${records.map(record=>`<div><span>${AGIcon('check',{size:13})}</span><span><strong>${esc(record.id||record)}</strong>${record.detail?`<small>${esc(record.detail)}</small>`:''}</span></div>`).join('')}</div>`;
}
