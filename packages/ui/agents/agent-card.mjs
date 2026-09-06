import { AGIcon, esc, attr } from '../shared.mjs';

export function AGAgentCard({agent}) {
  if(!agent) return '';
  const spend=Number(agent.spend||0).toFixed(2);
  return `<article class="ag-agent-card" data-ag-component="agent-card" data-state="${attr(agent.state||'idle')}"><header><span class="ag-agent-card-orbit"><i></i>${AGIcon('agent',{size:16})}</span><span><strong>${esc(agent.name)}</strong><small>${esc(agent.role||'Agent')} · ${esc(agent.state||'idle')}</small></span><button type="button" data-agent="${attr(agent.id)}" aria-label="Inspect ${attr(agent.name)}">${AGIcon('inspect',{size:14})}</button></header><p>${esc(agent.task||'Available')}</p><dl><div><dt>Authority</dt><dd>${esc(agent.authority||'scoped')}</dd></div><div><dt>Spend</dt><dd>€${spend}</dd></div><div><dt>Evidence</dt><dd>${Number(agent.evidence)||0} evidence</dd></div></dl></article>`;
}

export function AGAgentCluster({agents=[],action='context-preview'}) {
  const visible=agents.slice(0,4);
  const initials=name=>String(name||'A').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const running=agents.filter(a=>a.state==='running').length;
  return `<button type="button" class="ag-agent-cluster" data-ag-component="agent-cluster" data-action="${attr(action)}" aria-label="${agents.length} agents, ${running} running"><span class="ag-agent-stack">${visible.map((a,i)=>`<i data-state="${attr(a.state||'idle')}" style="--agent-index:${i}">${esc(initials(a.name))}</i>`).join('')}</span><span><strong>${running?`${running} active`:`${agents.length} agents`}</strong><small>${running?'Working in this context':'Available'}</small></span>${AGIcon('arrow',{size:12})}</button>`;
}
