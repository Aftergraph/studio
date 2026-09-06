import { AGIcon, esc, attr } from '../shared.mjs';

export function AGAgentPresence({name,state='idle',task=''}) {
  return `<div class="ag-agent-presence ${attr(state)}" data-ag-component="agent-presence" data-state="${attr(state)}" aria-live="polite"><span class="ag-agent-orbit"><i></i></span><span><strong>${esc(name)}</strong>${task?`<small>${esc(task)}</small>`:''}</span></div>`;
}
