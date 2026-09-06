import { AGIcon, esc, attr } from '../shared.mjs';

export function AGNeedYou({id,type,title,severity='medium',detail='',action='show-control',targetId=''}) {
  return `<button type="button" id="${attr(id)}" class="ag-need-you" data-ag-component="need-you" data-type="${attr(type)}" data-severity="${attr(severity)}" data-action="${attr(action)}"${targetId?` data-target-id="${attr(targetId)}"`:''}><span class="ag-attention-dot"></span><span><strong>${esc(title)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</span>${AGIcon('arrow',{size:14})}</button>`;
}
