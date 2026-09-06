import { AGIcon, esc, attr } from '../shared.mjs';

export function AGEventRow({event}) {
  if(!event) return '';
  return `<div class="ag-event-row" data-ag-component="event-row" data-event-type="${attr(event.type||'event')}"><span class="ag-event-dot"><i></i></span><span><strong>${esc(event.text||event.type||'Event')}</strong><small>${esc(event.type||'event')}</small></span><time>${esc(event.time||'')}</time></div>`;
}

export function AGConnectionRow({connection}) {
  if(!connection) return '';
  const state=String(connection.state||'unknown');
  return `<button type="button" class="ag-connection-row" data-ag-component="connection-row" data-state="${attr(state)}" data-connection="${attr(connection.id)}"><span class="ag-connection-signal"><i></i>${AGIcon(connection.kind==='Runtime'?'trajectory':'sparkle',{size:15})}</span><span><strong>${esc(connection.name)}</strong><small>${esc(connection.kind||'Connection')} · ${esc(state.replaceAll('_',' '))}</small></span><span class="ag-connection-meta"><small>${(connection.permissions||[]).length} permissions</small><em>${Number(connection.latency)||0}ms</em></span>${AGIcon('arrow',{size:12})}</button>`;
}

export function AGMemoryItem({id,label,scope='session',source='runtime',promoted=false,status=null,confidence=null,revocable=true,pendingAction=null}) {
  const trusted=status==='authoritative'||promoted;
  const tag=status||(promoted?'promoted':'mounted');
  const conf=(typeof confidence==='number')?` · confidence ${confidence}`:'';
  const descId=`${id}-memory-desc`;
  const desc=trusted?'Authoritative memory. Revoking removes it from authoritative reads.':'Ephemeral memory. Human promotion with evidence makes it authoritative; revoking discards it.';
  if(!revocable) return `<div class="ag-memory-item" data-ag-component="memory-item" data-id="${attr(id)}"><span>${AGIcon('brain',{size:14})}</span><span><strong>${esc(label)}</strong><small>${esc(scope)} · ${esc(source)} · ${tag}${conf}</small></span></div>`;
  const dis=pendingAction?' disabled':'';
  const promote=(!trusted)?(pendingAction?`<button type="button" class="ag-memory-promote" disabled data-state="loading">Promoting…</button>`:`<button type="button" class="ag-memory-promote" data-action="promote-memory" data-id="${attr(id)}" aria-describedby="${attr(descId)}">Promote</button>`):'';
  return `<div class="ag-memory-item" data-ag-component="memory-item" data-id="${attr(id)}"><span>${AGIcon('brain',{size:14})}</span><span><strong>${esc(label)}</strong><small>${esc(scope)} · ${esc(source)} · ${tag}${conf}</small><small id="${attr(descId)}">${desc}</small></span>${promote}<button type="button" class="ag-memory-revoke" data-action="revoke-memory" data-id="${attr(id)}" aria-label="Revoke ${attr(label)}"${dis}><span aria-hidden="true">×</span></button></div>`;
}
