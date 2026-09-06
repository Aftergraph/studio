import { AGIcon, esc, attr } from '../shared.mjs';

export function AGTabs({items=[],active=''}) {
  return `<div class="ag-tabs" data-ag-component="tabs" role="tablist">${items.map(item=>`<button type="button" role="tab" aria-selected="${item.id===active}" data-tab="${attr(item.id)}" class="${item.id===active?'active':''}">${esc(item.label)}</button>`).join('')}</div>`;
}

export function AGRow({title,detail='',icon='artifact',action='',meta=''}) {
  return `<button type="button" class="ag-row" data-ag-component="row"${action?` data-action="${attr(action)}"`:''}><span>${AGIcon(icon,{size:15})}</span><span><strong>${esc(title)}</strong>${detail?`<small>${esc(detail)}</small>`:''}</span>${meta?`<em>${esc(meta)}</em>`:''}${AGIcon('arrow',{size:13})}</button>`;
}

export function AGActionDock({actions=[]}) {
  return `<nav class="ag-action-dock" data-ag-component="action-dock" aria-label="Contextual actions">${actions.map(a=>`<button type="button" data-action="${attr(a.action||'')}"${a.id?` data-id="${attr(a.id)}"`:''}><span>${AGIcon(a.icon||'sparkle',{size:13})}</span><strong>${esc(a.label)}</strong>${a.meta?`<small>${esc(a.meta)}</small>`:''}</button>`).join('')}</nav>`;
}

export function AGCommandPalette({query='',results=[],activeIndex=0,footer='9 canonical domains'}) {
  return `<section class="ag-command-palette" data-ag-component="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><div class="ag-command-input">${AGIcon('search',{size:17})}<input id="palette-input" value="${attr(query)}" placeholder="Search, ask, or run a command…" autocomplete="off"/><kbd>Esc</kbd></div><div class="ag-command-results">${results.map((r,i)=>`<button class="ag-command-result ${i===activeIndex?'active':''}" data-result-kind="${attr(r.kind||'object')}" data-result-id="${attr(r.id)}" data-result-type="${attr(r.type||'')}" data-result-domain="${attr(r.domain||'')}"><span>${AGIcon(r.icon||'search',{size:16})}</span><span><strong>${esc(r.title||r.name)}</strong><small>${esc(r.subtitle||'')}</small></span>${r.shortcut?`<kbd>${esc(r.shortcut)}</kbd>`:AGIcon('arrow',{size:14})}</button>`).join('')}</div><footer><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span>${esc(footer)}</span></footer></section>`;
}

export function AGSheet({id='sheet',title='',content='',open=true}) {
  return `<aside id="${attr(id)}" class="ag-sheet ${open?'is-open':''}" data-ag-component="sheet" role="dialog" aria-modal="true" aria-label="${attr(title)}"><header><strong>${esc(title)}</strong></header><div>${content}</div></aside>`;
}

export function AGInspector({title='Inspector',content=''}) {
  return `<aside class="ag-inspector-kernel" data-ag-component="inspector" aria-label="${attr(title)}"><header><strong>${esc(title)}</strong></header><div>${content}</div></aside>`;
}

export function AGSplitSurface({primary='',secondary='',ratio=42}) {
  const safe=Math.max(30,Math.min(60,Number(ratio)||42));
  return `<div class="ag-split-surface" data-ag-component="split-surface" style="--split-ratio:${safe}%"><div>${primary}</div><div role="separator" tabindex="0"></div><aside>${secondary}</aside></div>`;
}

export function AGSkeleton({lines=3}) {
  const count=Math.max(1,Math.min(8,Number(lines)||3));
  return `<div class="ag-skeleton" data-ag-component="skeleton" aria-hidden="true">${Array.from({length:count},(_,i)=>`<i style="--w:${Math.max(42,96-i*11)}%"></i>`).join('')}</div>`;
}
