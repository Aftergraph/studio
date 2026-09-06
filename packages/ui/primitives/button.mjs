import { AGIcon, esc, attr } from '../shared.mjs';

export function AGSurface({id='surface',kind='generic',state='idle',className='',content=''}) {
  return `<section id="${attr(id)}" class="ag-surface ${attr(className)}" data-ag-component="surface" data-kind="${attr(kind)}" data-state="${attr(state)}">${content}</section>`;
}

export function AGButton({label,action='',tone='default',disabled=false,icon=''}) {
  return `<button type="button" class="ag-button ${attr(tone)}" data-ag-component="button"${action?` data-action="${attr(action)}"`:''}${disabled?' disabled aria-disabled="true"':''}>${icon?AGIcon(icon,{size:14}):''}<span>${esc(label)}</span></button>`;
}

export function AGProgress({value=0,label='Progress',tone='accent'}) {
  const clamped=Math.max(0,Math.min(100,Number(value)||0));
  return `<div class="ag-progress" data-ag-component="progress" data-tone="${attr(tone)}" role="progressbar" aria-label="${attr(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${clamped}"><i style="width:${clamped}%"></i></div>`;
}
