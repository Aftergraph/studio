const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const attr = esc;

export function derivePresence({ user=null, agents=[], followedAgentId=null }={}) {
  const human = user ? [{ id:user.id, kind:'human', name:user.name, state:'active', detail:user.role || 'user', followed:false }] : [];
  const agentPresence = agents.map(agent => ({
    id:agent.id,
    kind:'agent',
    name:agent.name,
    state:agent.state || 'idle',
    detail:agent.task || agent.role || 'Agent',
    authority:agent.authority || 'scoped',
    followed:agent.id === followedAgentId,
  }));
  return [...human, ...agentPresence];
}

export function AGAgentPresence({ item }={}) {
  if (!item) return '';
  const action = item.kind === 'agent' ? `<button type="button" data-presence-action="follow" data-presence-id="${attr(item.id)}" aria-pressed="${item.followed?'true':'false'}">${item.followed?'Following':'Follow'}</button>` : '<span class="ag-presence-self">You</span>';
  return `<article class="ag-presence-item ${item.followed?'is-followed':''}" data-ag-component="agent-presence" data-presence-id="${attr(item.id)}" data-kind="${attr(item.kind)}" data-state="${attr(item.state)}"><span class="ag-presence-signal"><i></i></span><span><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></span><em>${esc(item.state)}</em>${action}</article>`;
}

export function AGPresenceRail({ presence=[], collapsed=false }={}) {
  return `<aside class="ag-presence-rail ${collapsed?'is-collapsed':''}" data-ag-component="presence-rail" aria-label="Live presence"><header><span><small>Presence</small><strong>${presence.filter(x=>x.state==='running').length} agents working</strong></span><button type="button" data-space-action="toggle-presence" aria-expanded="${collapsed?'false':'true'}" aria-label="${collapsed?'Expand':'Collapse'} presence">${collapsed?'⌄':'⌃'}</button></header><div>${presence.map(item=>AGAgentPresence({item})).join('')}</div></aside>`;
}
