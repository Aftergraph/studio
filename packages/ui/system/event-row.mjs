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

export function AGMemoryItem({id,label,scope='session',source='runtime',promoted=false,revocable=true}) {
  const tag=promoted?'promoted':'mounted';
  if(!revocable) return `<div class="ag-memory-item" data-ag-component="memory-item" data-id="${attr(id)}"><span>${AGIcon('brain',{size:14})}</span><span><strong>${esc(label)}</strong><small>${esc(scope)} · ${esc(source)} · ${tag}</small></span></div>`;
  return `<button type="button" class="ag-memory-item" data-ag-component="memory-item" data-action="revoke-memory" data-id="${attr(id)}" aria-label="Revoke ${attr(label)}"><span>${AGIcon('brain',{size:14})}</span><span><strong>${esc(label)}</strong><small>${esc(scope)} · ${esc(source)} · ${tag}</small></span><span aria-hidden="true">×</span></button>`;
}
