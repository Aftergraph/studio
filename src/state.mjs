import { createSpatialState, reduceSpatialState } from '../packages/spatial/index.mjs';

function createDefaultSpace() {
  let space=createSpatialState({id:'space_primary',device:'desktop'});
  space=reduceSpatialState(space,{type:'surface.dock',surface:{id:'mission:mission_q4',kind:'mission',title:'Q4 Business Analysis'},regionId:'primary'});
  space=reduceSpatialState(space,{type:'surface.dock',surface:{id:'artifact:art_q4',kind:'artifact',title:'Q4 Business Analysis'},regionId:'detail',focus:false});
  space.focusedSurfaceId='mission:mission_q4';
  return space;
}

export function createInitialState({ fixtures = true } = {}) {
  const state = {
    user: { id:'demo-user', name:'Demo User', role:'operator', capabilities:['*'] },
    activeDomain:'chat',
    primaryMode:'chat',
    activeConversationId:'conv_q4',
    composerMode:'Ask',
    theme:'system',
    activeSpaceId:'space_primary',
    spaces:[createDefaultSpace()],
    goals:[],
    lessons:[],
    replay:{ cursor:0, playing:false, speed:1 },
    upstreams:{ syncedAt:null, services:{}, trustGateway:{identity:null,approvals:[],needsYou:[],audit:null}, works:{works:[],brain:[]}, aie:{tasks:[]}, workIntelligence:{workItems:[]}, governance:{missionStates:[]} },
    needsYou:[
      { id:'need_approval_1', type:'approval', severity:'high', title:'Production deployment needs approval', detail:'Release 4.8.0 changes 4 services.', objectType:'approval', objectId:'apr_prod_1', createdAt:'2 min ago' },
      { id:'need_budget_1', type:'budget', severity:'medium', title:'Research mission is near budget ceiling', detail:'€8.40 of €10.00 consumed.', objectType:'mission', objectId:'mission_research', createdAt:'12 min ago' },
      { id:'need_credential_1', type:'credential', severity:'medium', title:'GitHub connector requires renewed access', detail:'A repository scope expired.', objectType:'connector', objectId:'conn_github', createdAt:'24 min ago' },
    ],
    approvals:[
      { id:'apr_prod_1', title:'Deploy release 4.8.0 to production', state:'pending', risk:'destructive', impact:'4 services will restart. Expected interruption < 20 seconds.', why:'Mission mission_release passed build and staging verification.', rollback:'Automatic rollback to release 4.7.3 if health gates fail.', authority:'production.deploy', actor:'Friday', evidence:['ev_tests_1','ev_stage_1'], requestedAt:'2 min ago' },
      { id:'apr_secret_1', title:'Rotate expired provider credential', state:'pending', risk:'medium', impact:'Model routing may briefly fail over.', why:'Provider reports credential expiry in 6 hours.', rollback:'Previous credential remains encrypted until verification.', authority:'secret.rotate', actor:'Ops Agent', evidence:['ev_provider_1'], requestedAt:'18 min ago' },
    ],
    missions:[
      { id:'mission_q4', title:'Build Q4 business report', state:'running', progress:65, risk:'low', controlMode:'observe', agent:'Data Analysis Agent', budget:{used:3.2,max:8,currency:'€'}, verified:false, evidenceCount:4, eta:'2–3 min', objective:'Create a Q4 business report with key metrics, trends and recommendations.', steps:[
        { id:'s1', label:'Analyze data sources', state:'completed' },
        { id:'s2', label:'Process and analyze Q4 metrics', state:'running' },
        { id:'s3', label:'Generate visualizations', state:'pending' },
        { id:'s4', label:'Create recommendations', state:'pending' },
        { id:'s5', label:'Compile final report', state:'pending' },
      ] },
      { id:'mission_release', title:'Deploy production release', state:'awaiting_approval', progress:92, risk:'destructive', controlMode:'observe', agent:'Release Agent', budget:{used:1.1,max:2.5,currency:'€'}, verified:false, evidenceCount:11, eta:'Needs approval', objective:'Ship release 4.8.0 safely to production.', steps:[
        { id:'s1', label:'Build', state:'completed' }, { id:'s2', label:'Test', state:'completed' }, { id:'s3', label:'Stage', state:'completed' }, { id:'s4', label:'Human approval', state:'blocked' }, { id:'s5', label:'Deploy + verify', state:'pending' },
      ] },
      { id:'mission_research', title:'Research competitor landscape', state:'running', progress:78, risk:'medium', controlMode:'observe', agent:'Research Agent', budget:{used:8.4,max:10,currency:'€'}, verified:false, evidenceCount:16, eta:'7 min', objective:'Map competitor features with verifiable sources.', steps:[] },
    ],
    agents:[
      { id:'agent_data', name:'Data Analysis Agent', role:'Analyst', state:'running', task:'Q4 report metrics', authority:'read:data/*', spend:1.28, parent:'Friday', evidence:8 },
      { id:'agent_research', name:'Research Agent', role:'Researcher', state:'running', task:'Competitor research', authority:'web.read', spend:2.64, parent:'Friday', evidence:16 },
      { id:'agent_release', name:'Release Agent', role:'Operator', state:'waiting', task:'Production deployment', authority:'deploy:staging', spend:0.76, parent:'Friday', evidence:11 },
      { id:'agent_judge', name:'Judge', role:'Verifier', state:'idle', task:'Independent verification', authority:'verify:*', spend:0.31, parent:'System', evidence:24 },
    ],
    conversations:[
      { id:'conv_q4', missionId:'mission_q4', title:'Build Q4 report', updated:'2 min ago', status:'running', messages:[
        { id:'msg1', type:'text', author:'user', text:'Create a Q4 business report with key metrics, trends and recommendations.', time:'10:24' },
        { id:'msg2', type:'plan', author:'Friday', text:'I turned that into a mission and started the analysis.', time:'10:24', missionId:'mission_q4' },
        { id:'msg3', type:'agent_run', author:'system', text:'Data Analysis Agent is processing the Q4 metrics.', time:'10:25', agentId:'agent_data', state:'running' },
      ] },
      { id:'conv_code', missionId:null, title:'Analyze codebase', updated:'1 hour ago', status:'completed', messages:[] },
      { id:'conv_marketing', missionId:null, title:'Plan marketing campaign', updated:'3 hours ago', status:'completed', messages:[] },
      { id:'conv_deploy', missionId:'mission_release', title:'Deploy to production', updated:'5 hours ago', status:'blocked', messages:[] },
      { id:'conv_competitors', missionId:'mission_research', title:'Research competitors', updated:'1 day ago', status:'running', messages:[] },
    ],
    artifacts:[
      { id:'art_q4', title:'q4_report_draft.md', kind:'Document', state:'draft', verified:false, missionId:'mission_q4', updated:'2 min ago', size:'24 KB' },
      { id:'art_chart', title:'revenue_chart.svg', kind:'Chart', state:'generated', verified:true, missionId:'mission_q4', updated:'5 min ago', size:'18 KB' },
      { id:'art_market', title:'market_analysis.json', kind:'Data', state:'verified', verified:true, missionId:'mission_research', updated:'10 min ago', size:'92 KB' },
      { id:'art_release', title:'release-evidence.json', kind:'Evidence', state:'verified', verified:true, missionId:'mission_release', updated:'14 min ago', size:'41 KB' },
    ],
    memory:[
      { id:'mem1', scope:'workspace', label:'Canonical UX principle', value:'Objects persist. Surfaces adapt. Capabilities extend. Agents act. Humans retain control.', source:'governance', promoted:true },
      { id:'mem2', scope:'project', label:'Q4 report style', value:'Concise executive narrative with evidence links.', source:'user preference', promoted:false },
      { id:'mem3', scope:'session', label:'Active mission', value:'mission_q4', source:'runtime', promoted:false },
    ],
    connections:[
      { id:'conn_github', name:'GitHub', kind:'Connector', state:'needs_attention', permissions:['repo.read','issues.read'], latency:84 },
      { id:'conn_drive', name:'Google Drive', kind:'Connector', state:'healthy', permissions:['files.read'], latency:61 },
      { id:'conn_mcp', name:'MCP Tools', kind:'Protocol', state:'healthy', permissions:['tools.invoke'], latency:32 },
      { id:'conn_runtime', name:'WORKS Runtime', kind:'Runtime', state:'healthy', permissions:['mission.read','work.execute'], latency:19 },
    ],
    events:[
      { id:'ev1', type:'mission.started', text:'Q4 report mission started', time:'10:24' },
      { id:'ev2', type:'agent.delegated', text:'Delegated metrics analysis to Data Analysis Agent', time:'10:24' },
      { id:'ev3', type:'approval.requested', text:'Production deployment requested approval', time:'10:26' },
      { id:'ev4', type:'evidence.sealed', text:'Staging verification evidence sealed', time:'10:27' },
    ],
    telemetry:{ online:true, runtime:'healthy', chain:'verified', cost:8.49, activeRuns:3, queued:1, evidence:64, latency:148 },
    interactionSource:{ mode:'reference-local', authoritative:false, threadOwner:'runtime', turnOwner:'runtime' },
    fixtureMode: Boolean(fixtures),
    source: fixtures ? 'demo-fixture' : 'runtime-empty',
  };
  if (fixtures) return state;
  return {
    ...state,
    activeConversationId: null,
    needsYou: [], approvals: [], missions: [], agents: [], conversations: [],
    artifacts: [], memory: [], events: [],
    telemetry: { online: false, runtime: 'unavailable', chain: 'unknown', cost: 0, activeRuns: 0, queued: 0, evidence: 0, latency: null },
    fixtureMode: false,
    source: 'runtime-empty',
  };
}

function clone(state) { return structuredClone(state); }

export function resolveNeed(state, id) {
  const next = clone(state);
  next.needsYou = next.needsYou.filter(x => x.id !== id);
  next.events.unshift({ id:`ev_${Date.now()}`, type:'need.resolved', text:`Resolved ${id}`, time:'now' });
  return next;
}

export function decideApproval(state, id, decision, actor) {
  const next = clone(state);
  const approval = next.approvals.find(x => x.id === id);
  if (!approval) throw new Error(`approval not found: ${id}`);
  if (!['approved','rejected'].includes(decision)) throw new Error('invalid approval decision');
  approval.state = decision;
  approval.decidedBy = actor;
  approval.decidedAt = new Date().toISOString();
  next.needsYou = next.needsYou.filter(x => x.objectId !== id);
  const mission = next.missions.find(m => m.id === 'mission_release' && id === 'apr_prod_1');
  if (mission && decision === 'approved') {
    mission.state = 'running';
    mission.steps = mission.steps.map(s => s.label === 'Human approval' ? { ...s, state:'completed' } : s);
  }
  next.events.unshift({ id:`ev_${Date.now()}`, type:`approval.${decision}`, text:`${approval.title}: ${decision}`, time:'now' });
  return next;
}

export function setTakeover(state, missionId, enabled) {
  const next = clone(state);
  const mission = next.missions.find(x => x.id === missionId);
  if (!mission) throw new Error(`mission not found: ${missionId}`);
  mission.controlMode = enabled ? 'takeover' : 'observe';
  next.events.unshift({ id:`ev_${Date.now()}`, type:enabled?'mission.takeover':'mission.handback', text:`${mission.title}: ${enabled?'human takeover':'handed back to agent'}`, time:'now' });
  return next;
}

export function settleMission(state, missionId, { verified, evidence = [] } = {}) {
  if (verified && evidence.length === 0) throw new Error('verified mission requires evidence');
  const next = clone(state);
  const mission = next.missions.find(x => x.id === missionId);
  if (!mission) throw new Error(`mission not found: ${missionId}`);
  mission.state = verified ? 'verified' : 'completed_unverified';
  mission.verified = Boolean(verified);
  mission.progress = 100;
  mission.evidenceCount = evidence.length || mission.evidenceCount;
  return next;
}


export function conversationMissionId(state, conversationId) {
  const conv = state.conversations.find(c => c.id === conversationId);
  if (!conv) return null;
  if (conv.missionId) return conv.missionId;
  const linked = [...(conv.messages || [])].reverse().find(message => message.missionId);
  return linked?.missionId || null;
}

export function appendChatMessage(state, conversationId, message) {
  const next = clone(state);
  const conv = next.conversations.find(x => x.id === conversationId);
  if (!conv) throw new Error(`conversation not found: ${conversationId}`);
  conv.messages.push({ id:`msg_${Date.now()}`, time:'now', ...message });
  conv.updated = 'now';
  return next;
}
