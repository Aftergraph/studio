import { AGIcon } from '../../icons/index.mjs';
import { esc, attr } from '../shared.mjs';

const freshnessLabel=state=>({
  current:'Live',resyncing:'Reconnecting',stale:'Stale',degraded:'Degraded',offline:'Offline',unavailable:'Unavailable',
}[state] || 'Local');

export function AGActiveContextBar({context={},mode='chat'}={}) {
  const mission=context.mission;
  const id=mission?.id || context.conversation?.id || context.contextId || 'workspace';
  const title=mission?.label || context.conversation?.label || 'Workspace';
  const freshness=context.freshness?.state || mission?.freshness || 'offline';
  const evidenceCount=context.evidence?.length || 0;
  const agent=context.agents?.[0]?.label || '';
  return `<section class="ag-active-context-bar" data-ag-component="active-context" data-context-id="${attr(id)}" data-mode="${attr(mode)}" data-freshness="${attr(freshness)}" aria-label="Active context">
    <button type="button" class="ag-active-context-main" data-action="context-preview">
      <span class="ag-active-context-icon">${AGIcon('trajectory',{size:14})}</span>
      <span><small>Active context</small><strong>${esc(title)}</strong></span>
    </button>
    <span class="ag-active-context-meta">${evidenceCount} evidence${agent?` · ${esc(agent)}`:''}</span>
    <span class="ag-freshness-state" role="status" aria-live="polite"><i></i>${esc(freshnessLabel(freshness))}</span>
  </section>`;
}
