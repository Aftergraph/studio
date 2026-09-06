export const DOMAINS = Object.freeze([
  { id:'now', label:'NOW', icon:'◉', description:'Attention, priorities, active work and outcomes' },
  { id:'chat', label:'CHAT', icon:'◌', description:'Conversation, commands and agent interaction' },
  { id:'work', label:'WORK', icon:'▣', description:'Missions, tasks, workflows and runs' },
  { id:'agents', label:'AGENTS', icon:'◇', description:'Agents, delegation and runtime state' },
  { id:'brain', label:'BRAIN', icon:'◈', description:'Context, memory, knowledge and models' },
  { id:'research', label:'RESEARCH', icon:'⌬', description:'Programs, studies, experiments, claims, evidence and replication' },
  { id:'capabilities', label:'CAPABILITIES', icon:'✦', description:'Discoverable skills, tools and governed capability grants' },
  { id:'output', label:'OUTPUT', icon:'⬡', description:'Artifacts, evidence, history and replay' },
  { id:'control', label:'CONTROL', icon:'◍', description:'Approvals, permissions, risk and audit' },
  { id:'connect', label:'CONNECT', icon:'⌘', description:'Tools, integrations, MCP and environments' },
  { id:'system', label:'SYSTEM', icon:'⚙', description:'Workspace, security, usage and settings' },
]);

const DOMAIN_SET = new Set(DOMAINS.map(d => d.id));

export const LEGACY_DOMAIN_ALIASES = Object.freeze({
  console:'now', rooms:'now',
  history:'output', playground:'output', artifacts:'output',
  goals:'work', builder:'work', missions:'work', executions:'work',
  hub:'connect', voice:'connect', integrations:'connect',
  providers:'brain', 'providers-live':'brain',
  computer:'control', authority:'control',
});

export const OBJECT_DOMAIN = Object.freeze({
  run:'work', mission:'work', task:'work', workitem:'work', workflow:'work',
  message:'chat', conversation:'chat', thread:'chat',
  agent:'agents', bot:'agents', delegation:'agents',
  memory:'brain', context:'brain', source:'brain', model:'brain',
  research_program:'research', study:'research', experiment:'research', claim:'research', paper:'research',
  capability:'capabilities', skill:'capabilities',
  artifact:'output', evidence:'output', auditentry:'output', history:'output',
  approval:'control', policy:'control', authority:'control', permission:'control', decision:'control',
  adapter:'connect', connector:'connect', tool:'connect', integration:'connect', computersession:'connect',
  session:'system', workspace:'system', user:'system', setting:'system',
  need:'now', notification:'now',
});

export function resolveDomain(value) {
  const id = String(value || '').trim().toLowerCase();
  if (DOMAIN_SET.has(id)) return id;
  return LEGACY_DOMAIN_ALIASES[id] || 'now';
}

export function domainForObject(type) {
  return OBJECT_DOMAIN[String(type || '').toLowerCase()] || 'now';
}

export function getDomain(id) {
  const resolved = resolveDomain(id);
  return DOMAINS.find(d => d.id === resolved) || DOMAINS[0];
}
