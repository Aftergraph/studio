import { DOMAINS, getDomain, domainForObject } from '../domain.mjs';
import { routeFromLocation, buildDeepLink } from '../router.mjs';
import { createInitialState, resolveNeed, decideApproval, setTakeover, appendChatMessage, conversationMissionId } from '../state.mjs';
import { searchIndex } from '../search.mjs';
import { escapeHtml, attentionCount, compactMoney, progressLabel } from '../ui-helpers.mjs';
import { PRIMARY_NAV, canonicalDomainForNav, commandDomainEntries } from '../workspace-shell.mjs';
import { icon } from '../icons.mjs';
import { AGIcon } from '../../packages/icons/index.mjs';
import { AGTrajectory, AGArtifact, AGApproval, AGNeedYou, AGComposer, AGAgentPresence, AGAgentCluster, AGActionDock, AGOutcomeReceipt, AGCommandPalette, AGPulseRail, AGContextSummary, AGMemoryItem, AGWorkSummary, AGTelemetryStrip, AGAgentCard, AGDelegationStrip, AGConnectionRow, AGArtifactRow, AGEventRow, AGUpstreamServiceRow, AGExternalWorkRow, AGDetectionProposalRow, AGSourceTruthBadge } from '../../packages/ui/index.mjs';
import { composeLivingLayout } from '../../packages/runtime-ui/index.mjs';
import { animateElement, morphSurface, prefersReducedMotion } from '../../packages/motion/index.mjs';
import { createLiveRuntime, stepMission, pauseMission, resumeMission } from '../live-runtime.mjs';
import { createApiClient } from '../api-client.mjs';
import { createSurfaceLifecycle } from '../surface-lifecycle.mjs';
import { isUpstreamProjectionOnly, reconcileUpstreamSync, validateWorkspacePayload } from '../backend-reconciliation.mjs';
import { AGSpace, AGSemanticZoom, AGDock, AGContextLens, reduceSpatialState, nextSemanticZoom } from '../../packages/spatial/index.mjs';
import { derivePresence, AGPresenceRail } from '../../packages/presence/index.mjs';
import { resolveInteraction } from '../../packages/interaction/index.mjs';
import { AGTrajectoryGraph, AGEvidenceGraph, AGReplayTimeline } from '../../packages/visualization/index.mjs';
import { AGIntentComposer, normalizeIntent } from '../../packages/composer/index.mjs';
import { buildReplayFrames } from '../replay.mjs';
import { diffSurfaceEntries } from '../spatial-lifecycle.mjs';
import { createUIState } from './ui-state.mjs';
import { createRenderScheduler } from './render-scheduler.mjs';
import { createBackendSession } from '../runtime/backend-session.mjs';
import { reconcileAuthoritativeState } from '../runtime/background-reconciliation.mjs';
import { renderChatView } from '../views/chat-view.mjs';
import { renderWorkView } from '../views/work-view.mjs';
import { renderSpaceView } from '../views/space-view.mjs';
import { renderSystemSurface } from '../views/system-view.mjs';
import { renderControlSurface } from '../views/control-view.mjs';
import { createFederationBrowserClient } from '../federation/browser-client.mjs';
import { createFederationSession } from '../runtime/federation-session.mjs';
import { renderResearchSurface } from '../views/research-view.mjs';
import { renderCapabilitiesSurface } from '../views/capabilities-view.mjs';


export function bootstrapAftergraph(){

  const STORAGE_KEY='aftergraph-workspace-v5';
  const app=document.querySelector('#app');
  const toastRegion=document.querySelector('#toast-region');
  let state=loadState();
  let liveRuntime=null;
  let liveTimer=null;
  let replayTimer=null;
  const apiClient=createApiClient();
  const federationClient=createFederationBrowserClient();
  let federationSession=null;
  let federationSnapshot=Object.freeze({phase:'idle',complete:false,integrations:[],objects:[],capabilities:[],now:{coverage:{complete:false,unavailable:[]}},errors:[]});
  let backendConnected=false;
  let backendRuntimes={};
  let backendSession=null;
  const pendingActions=new Set();
  let renderScheduler=null;
  const surfaceLifecycle=createSurfaceLifecycle(['artifact','approval']);
  let lastProgress=new Map(state.missions.map(m=>[m.id,m.progress]));
  let renderedSpaceSurfaceIds=new Set();

  let ui=createUIState(state,detectDevice());
  const qaEnabled=new URLSearchParams(location.search).has('qa')||globalThis.__AFTERGRAPH_QA===true;
  const qaMetrics=qaEnabled?{shellRenders:0,viewRenders:0,'patch:mission.progress':0}:null;

  const initialRoute=routeFromLocation(window.location);
  if(initialRoute.kind==='domain'){state.activeDomain=initialRoute.domain;if(['chat','work'].includes(initialRoute.domain))state.primaryMode=initialRoute.domain}
  if(initialRoute.kind==='mode'){state.primaryMode=initialRoute.mode;state.activeDomain=initialRoute.domain}
  if(initialRoute.kind==='object'){
    state.activeDomain=initialRoute.domain;
    selectObject(initialRoute.type,initialRoute.id);
  }

  function loadState(){
    const initial=createInitialState({fixtures:location.protocol!=='http:'});
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(raw){const parsed=JSON.parse(raw);if(!(initial.fixtureMode===false&&parsed.fixtureMode===true))return {...initial,...parsed}}
    }catch{}
    return initial;
  }
  function saveState(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{}}
  function beginUiAction(key){if(pendingActions.has(key))return false;pendingActions.add(key);render();return true}
  function endUiAction(key){pendingActions.delete(key);render()}
  function detectDevice(){return window.matchMedia('(max-width: 760px)').matches?'mobile':'desktop'}
  function initials(name=''){return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'A'}
  function statusPill(status,label=null){const raw=String(status||'unknown');return `<span class="status-pill ${raw.replace(/[^a-z0-9_-]/gi,'-').toLowerCase()}">${escapeHtml(label||raw.replaceAll('_',' '))}</span>`}
  function currentMission(){return state.missions.find(m=>m.id===ui.selectedMissionId)||state.missions[0]}
  function chatMission(){const id=conversationMissionId(state,state.activeConversationId);return state.missions.find(m=>m.id===id)||currentMission()}
  function currentArtifact(){return state.artifacts.find(a=>a.id===ui.selectedArtifactId)||state.artifacts[0]}
  function currentApproval(){return state.approvals.find(a=>a.id===ui.selectedApprovalId)||state.approvals[0]}
  function currentConversation(){return state.conversations.find(c=>c.id===state.activeConversationId)||state.conversations[0]}
  function currentAgent(){return state.agents.find(a=>a.id===ui.selectedAgentId)||state.agents[0]}
  function currentSpace(){return (state.spaces||[]).find(space=>space.id===state.activeSpaceId)||(state.spaces||[])[0]}
  function activeMode(){if(state.primaryMode==='space'&&state.activeDomain==='work')return 'space';return state.activeDomain==='work'?'work':'chat'}
  function runtimeFor(missionId){
    if(backendConnected&&backendRuntimes?.[missionId])return backendRuntimes[missionId];
    if(liveRuntime?.missionId===missionId)return liveRuntime;
    return null;
  }
  function applyBackendPayload(payload,{renderNow=true}={}){
    if(payload?.state)state=payload.state;
    if(payload?.runtimes)backendRuntimes=payload.runtimes;
    saveState();
    if(renderNow)render();
  }
  function applyUpstreamPayload(payload,{renderNow=true}={}){
    state=reconcileUpstreamSync(state,payload);
    if(payload?.runtimes)backendRuntimes=payload.runtimes;
    saveState();
    if(renderNow)render();
  }
  function patchRuntimeUI(){
    const mission=state.activeDomain==='chat'?chatMission():state.activeDomain==='work'?currentMission():null;
    if(!mission)return;
    const progress=Math.max(0,Math.min(100,Number(mission.progress)||0));
    document.querySelectorAll('.ag-live-progress i,.ag-work-summary-progress i,.ag-pulse-progress i').forEach(el=>{el.style.width=`${progress}%`});
    document.querySelectorAll('.ag-live-strip>b').forEach(el=>{el.textContent=`${progress}%`});
    document.querySelectorAll('.ag-inline-agent>small').forEach(el=>{el.textContent=`${progress}%`});
    document.querySelectorAll('.ag-work-summary-progress').forEach(el=>el.setAttribute('aria-valuenow',String(progress)));
    const summaryProgress=document.querySelector('.ag-work-summary dl>div:first-child dd');if(summaryProgress)summaryProgress.textContent=`${progress}%`;
    const pulse=document.querySelector('.ag-pulse-progress');if(pulse)pulse.setAttribute('aria-valuenow',String(progress));
    const pulseHeader=document.querySelector('.ag-pulse-body>header>span');if(pulseHeader)pulseHeader.textContent=`${progress}%`;
    const flow=document.querySelector('.ambient-flow');if(flow)flow.style.setProperty('--progress',`${progress}%`);
    document.querySelectorAll('[data-ag-component="trajectory"]').forEach(existing=>{
      const template=document.createElement('template');template.innerHTML=AGTrajectory({steps:mission.steps,compact:existing.classList.contains('is-compact')}).trim();
      const replacement=template.content.firstElementChild;if(replacement)existing.replaceWith(replacement);
    });
    const rail=Array.from(document.querySelectorAll('.ag-mission-rail button[data-mission]')).find(el=>el.dataset.mission===mission.id);
    const railMeta=rail?.querySelector('small');if(railMeta)railMeta.textContent=`${mission.agent} · ${progress}%`;
    lastProgress.set(mission.id,progress);
  }
  function applyBackendEvent(payload){
    const previousState=state;
    const serverState=payload?.state||state;
    const nextState=reconcileAuthoritativeState(previousState,serverState);
    const nextRuntimes=payload?.runtimes||backendRuntimes;
    if(isUpstreamProjectionOnly(previousState,nextState)){
      state=reconcileUpstreamSync(previousState,{state:nextState,upstreams:nextState.upstreams});
      backendRuntimes=nextRuntimes;saveState();renderScheduler?.update(state,backendRuntimes);return;
    }
    state=nextState;backendRuntimes=nextRuntimes;saveState();
    if(renderScheduler)renderScheduler.update(nextState,nextRuntimes);else render();
  }
  function updateConnectivityNotice(phase){
    let notice=document.querySelector('#ag-connectivity-status');
    if(!notice){notice=document.createElement('div');notice.id='ag-connectivity-status';notice.className='ag-connectivity-status';notice.setAttribute('aria-live','polite');document.body.append(notice)}
    const copy={
      resyncing:'Reconnecting · refreshing current workspace state…',
      stale:'Connection interrupted · showing last-known state.',
      degraded:'Could not refresh current state · showing stale data; execution controls are unavailable.',
    };
    notice.dataset.state=phase;notice.textContent=copy[phase]||'';notice.hidden=!copy[phase];notice.setAttribute('role',phase==='degraded'?'alert':'status');
  }
  function setBackendPhase(phase){
    ui.backendStatus=phase;
    backendConnected=phase==='current';
    document.documentElement.dataset.backend=phase==='current'?'connected':phase;
    document.querySelector('.ag-app')?.setAttribute('data-backend-state',phase==='current'?'connected':'local');
    document.querySelector('.ag-backend-state')?.setAttribute('data-state',phase);
    updateConnectivityNotice(phase);
  }
  function backendFailed(error){
    backendConnected=false;backendRuntimes={};backendSession?.stop?.();backendSession=null;
    ui.backendStatus='offline';document.documentElement.dataset.backend='local';
    if(error?.code!=='backend_unavailable')console.warn('Aftergraph backend degraded to local mode',error?.code||error);
    render();
  }
  function backendSessionError(error){
    if(error?.code!=='backend_unavailable')console.warn('Aftergraph backend connection is stale',error?.code||error);
  }
  async function connectBackend(){
    if(!location.protocol.startsWith('http'))return false;
    if(!await apiClient.detect())return false;
    try{
      backendSession?.stop?.();
      backendSession=createBackendSession({
        api:apiClient,
        onState:payload=>{if(payload?.state)applyBackendEvent(payload)},
        onRuntime:runtimes=>{if(runtimes)backendRuntimes=runtimes},
        onStatus:phase=>setBackendPhase(phase),
        onError:backendSessionError,
        onMetric:metric=>{ui.resyncMetric=metric},
        validatePayload:validateWorkspacePayload,
      });
      backendSession.start();
      void refreshFederation();
      void apiClient.syncUpstreams().then(upstreamPayload=>applyUpstreamPayload(upstreamPayload)).catch(error=>console.warn('Aftergraph upstream sync unavailable',error?.code||error));
      return true;
    }catch(error){backendFailed(error);return false}
  }
  function applyFederationSnapshot(snapshot,{renderNow=true}={}){federationSnapshot=snapshot||federationSnapshot;if(renderNow)render();return federationSnapshot}
  async function refreshFederation(){
    if(!location.protocol.startsWith('http'))return federationSnapshot;
    if(!federationSession)federationSession=createFederationSession({client:federationClient,onChange:snapshot=>{federationSnapshot=snapshot}});
    const snapshot=await federationSession.refresh();
    federationSnapshot=snapshot;
    render();
    return snapshot;
  }
  async function syncBackend(promise,{successToast=null}={}){
    if(!backendConnected)return null;
    try{const payload=await promise;applyBackendPayload(payload);if(successToast)toast(successToast);return payload}
    catch(error){backendFailed(error);return null}
  }

  function selectObject(type,id){
    if(['mission','run','task'].includes(type))ui.selectedMissionId=id;
    if(['agent','bot'].includes(type))ui.selectedAgentId=id;
    if(['artifact','evidence'].includes(type)){ui.selectedArtifactId=id;ui.artifactOpen=true}
    if(['approval','decision'].includes(type)){ui.selectedApprovalId=id;ui.approvalOpen=true}
    if(['conversation','message'].includes(type))state.activeConversationId=id;
  }

  function navigateDomain(domain){
    state.activeDomain=getDomain(domain).id;if(['chat','work'].includes(state.activeDomain))state.primaryMode=state.activeDomain;saveState();
    try{history.pushState({},'',`/${state.activeDomain}`)}catch{}
    render();
  }
  function navigateHuman(id){
    if(id==='space'){state.primaryMode='space';state.activeDomain='work';saveState();try{history.pushState({},'', '/space')}catch{};render();return}
    state.primaryMode=id;navigateDomain(canonicalDomainForNav(id)||id)
  }
  function navigateObject(type,id){state.activeDomain=domainForObject(type);selectObject(type,id);try{history.pushState({},'',buildDeepLink(state.activeDomain,type,id))}catch{};saveState();render()}

  function toast(text){const el=document.createElement('div');el.className='toast';el.textContent=text;toastRegion.append(el);setTimeout(()=>el.remove(),2200)}

  function renderBrand(){return `<div class="ag-brand"><div class="ag-mark" aria-hidden="true"><i></i><i></i></div><div><strong>Aftergraph</strong><small>Human Intelligence. Amplified.</small></div></div>`}

  function renderSidebar(){
    const projects=[
      {title:'Q4 Business Analysis',conversationId:'conv_q4',accent:'blue'},
      {title:'Product launch',conversationId:'conv_marketing',accent:'violet'},
      {title:'RenOS v2',conversationId:'conv_code',accent:'cyan'},
    ];
    const recents=state.conversations.slice(0,6);
    return `<aside class="ag-sidebar" aria-label="Workspace navigation">
      ${renderBrand()}
      <div class="ag-side-actions">
        <button class="ag-new" data-action="new-chat">${icon('plus',{size:16})}<span>New</span><kbd>⌘N</kbd></button>
        <button class="ag-side-search" data-action="open-palette">${icon('search',{size:15})}<span>Search or command</span><kbd>⌘K</kbd></button>
      </div>
      <nav class="ag-mode-nav" aria-label="Primary modes">
        ${PRIMARY_NAV.map(item=>`<button class="${activeMode()===item.id?'active':''}" data-human-nav="${item.id}" aria-current="${activeMode()===item.id?'page':'false'}">${icon(item.id,{size:17})}<span>${escapeHtml(item.label)}</span></button>`).join('')}
      </nav>
      <div class="ag-side-scroll">
        <div class="ag-side-section"><span>Projects</span><button data-action="new-goal" aria-label="Create project">+</button></div>
        <div class="ag-projects">${projects.map((p,i)=>`<button data-conversation="${p.conversationId}" class="${state.activeConversationId===p.conversationId?'active':''}"><i class="project-dot ${p.accent}"></i><span>${escapeHtml(p.title)}</span></button>`).join('')}</div>
        <div class="ag-side-section"><span>Recents</span></div>
        <div class="ag-recents">${recents.map(c=>`<button data-conversation="${c.id}"><span>${c.missionId?AGIcon('trajectory',{size:13}):icon('chat',{size:13})}</span><span><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.updated)}</small></span></button>`).join('')}</div>
      </div>
      <div class="ag-sidebar-footer">
        <button class="ag-side-utility" data-action="show-control">${AGIcon('approval',{size:16})}<span>Needs you</span><b>${attentionCount(state)}</b></button>
        <div class="ag-workspace-switch"><span class="ag-avatar">AC</span><span><strong>Acme Workspace</strong><small>Enterprise</small></span>${icon('chevronDown',{size:13})}</div>
        ${AGTelemetryStrip({telemetry:state.telemetry,backend:backendConnected?'connected':'local'})}
      </div>
    </aside>`;
  }

  function renderTopbar(){
    const mission=state.activeDomain==='chat'?chatMission():currentMission();
    return `<header class="ag-topbar">
      <button class="ag-mobile-brand" data-action="open-palette" aria-label="Open command palette"><span class="ag-mark mini"><i></i><i></i></span></button>
      <div class="ag-mode-switch" role="tablist" aria-label="Primary workspace modes" data-mobile-primary-nav="true">${PRIMARY_NAV.map(item=>`<button role="tab" aria-selected="${activeMode()===item.id}" class="${activeMode()===item.id?'active':''}" data-human-nav="${item.id}">${escapeHtml(item.label)}</button>`).join('')}</div>
      <button class="ag-global-command" data-action="open-palette">${icon('search',{size:15})}<span>Search, ask, or run a command…</span><kbd>⌘K</kbd></button>
      <div class="ag-top-actions">
        ${AGAgentCluster({agents:state.agents})}
        <button class="ag-icon-button" data-action="toggle-immersive" aria-pressed="${ui.immersive}" aria-label="Toggle immersive mode">${AGIcon('sparkle',{size:17})}</button>
        <button class="ag-icon-button" data-action="context-preview" aria-label="Inspect context">${AGIcon('inspect',{size:17})}</button>
        <button class="ag-icon-button has-attention" data-action="show-control" aria-label="Review attention items">${AGIcon('shield',{size:17})}${state.approvals.some(a=>a.state==='pending')?'<i></i>':''}</button>
        <span class="ag-profile">${initials(state.user.name)}</span>
      </div>
    </header>`;
  }


  function renderPulseRail(mission){
    if(ui.device==='mobile'||ui.approvalOpen||ui.artifactOpen)return '';
    return AGPulseRail({agents:state.agents,attentionCount:attentionCount(state),mission,expanded:ui.pulseOpen});
  }

  function renderAmbient(layout,mission){
    const stateName=layout.ambient.mode;
    return `<div class="ag-ambient-field" data-ambient="${stateName}" aria-hidden="true"><i class="ambient-a"></i><i class="ambient-b"></i><i class="ambient-c"></i><div class="ambient-grid"></div><div class="ambient-flow" style="--progress:${mission?.progress||0}%"></div></div>`;
  }

  function renderUserMessage(message){return `<article class="ag-turn user"><div class="ag-turn-content"><div class="ag-user-bubble">${escapeHtml(message.text)}</div></div></article>`}
  function renderAgentMessage(message){
    const mission=message.missionId?state.missions.find(m=>m.id===message.missionId):chatMission();
    const agent=message.agentId?state.agents.find(a=>a.id===message.agentId):null;
    let extra='';
    if(message.type==='plan'&&mission)extra=AGTrajectory({steps:mission.steps,compact:false});
    if(message.type==='agent_run'&&agent)extra=`<div class="ag-inline-agent">${AGAgentPresence({name:agent.name,state:agent.state,task:agent.task})}<div class="ag-live-progress"><i style="width:${mission?.progress||68}%"></i></div><small>${mission?.progress||68}%</small></div>`;
    return `<article class="ag-turn assistant"><div class="ag-agent-glyph"><span class="ag-mark micro"><i></i><i></i></span></div><div class="ag-turn-content"><p>${escapeHtml(message.text)}</p>${extra}</div></article>`;
  }
  function renderMessage(message){return message.author==='user'?renderUserMessage(message):renderAgentMessage(message)}

  function renderLiveStrip(mission){
    if(!mission)return '';
    const runtime=runtimeFor(mission.id);
    const status=runtime?.status||mission.state;
    const running=status==='running';
    const paused=status==='paused';
    const verified=mission.verified||status==='verified';
    return `<section class="ag-live-strip" data-state="${escapeHtml(status)}">
      <div class="ag-live-symbol">${verified?AGIcon('check',{size:16}):AGIcon('trajectory',{size:17})}<i></i></div>
      <div class="ag-live-copy"><strong>${verified?'Verified outcome':paused?'Mission paused':running?'Live mission':'Mission state'}</strong><span>${escapeHtml(mission.agent)} · ${escapeHtml(mission.eta)}</span></div>
      <div class="ag-live-progress"><i style="width:${mission.progress}%"></i></div><b>${mission.progress}%</b>
      <div class="ag-live-controls">${verified?`<button data-action="open-artifact">Open outcome</button>`:paused?`<button data-action="resume-live">${AGIcon('play',{size:13})} Resume</button>`:`<button data-action="${running&&runtime?'pause-live':'run-live'}">${AGIcon(running&&runtime?'pause':'play',{size:13})} ${running&&runtime?'Pause':'Run live'}</button>`}</div>
    </section>`;
  }

  function renderOutcome(mission){
    if(!mission?.verified)return '';
    return AGOutcomeReceipt({title:'Q4 analysis verified',detail:'The transient execution state has settled into a durable result. Artifact, evidence and decision trail remain inspectable.',evidenceCount:mission.evidenceCount,action:'open-artifact'});
  }

  function renderInsightBlock(mission){
    if(!mission||mission.id!=='mission_q4')return '';
    const artifact=state.artifacts.find(a=>a.id==='art_q4');
    return `<article class="ag-turn assistant ag-result-turn"><div class="ag-agent-glyph"><span class="ag-mark micro"><i></i><i></i></span></div><div class="ag-turn-content"><p>I’ve completed the current analysis pass. The strongest signal is enterprise expansion while retention remains stable.</p><div class="ag-findings"><span><strong>€4.2M</strong><small>Revenue · +18%</small></span><span><strong>12.8K</strong><small>Customers · +24%</small></span><span><strong>€326</strong><small>ARPU · +12%</small></span><span><strong>94%</strong><small>Retention · +3%</small></span></div><button class="ag-artifact-entry surface-morph" data-artifact="${artifact.id}" data-action="open-artifact"><span>${AGIcon('artifact',{size:17})}</span><span><strong>Q4 Business Analysis</strong><small>Document · working artifact</small></span>${AGIcon('arrow',{size:15})}</button></div></article>`;
  }

  function renderChat(){
    const conv=currentConversation();const mission=chatMission();
    const runtime=runtimeFor(mission?.id);
    const liveState=runtime?.status||(mission?.verified?'verified':mission?.state||'idle');
    const linked=state.artifacts.find(a=>a.missionId===mission?.id)||currentArtifact();
    if(linked)ui.selectedArtifactId=linked.id;
    const layout=composeLivingLayout({device:ui.device,artifactOpen:ui.artifactOpen,inspectorOpen:ui.inspectorOpen,takeover:mission?.controlMode==='takeover'});
    const header=`<header class="ag-conversation-head"><div><div class="ag-crumbs"><span>Project</span><i></i><span>Growth & Strategy</span></div><h1>${escapeHtml(conv.title)}</h1><p>${escapeHtml(mission?.objective||'Ask anything. Start work when you want an outcome carried through.')}</p></div><div class="ag-context-actions">${mission?.controlMode==='takeover'?`<button class="ag-button active-control" data-action="handback" data-id="${mission.id}">${AGIcon('shield',{size:14})} Human control</button>`:`<button class="ag-button" data-action="takeover" data-id="${mission?.id||''}">${AGIcon('shield',{size:14})} Take over</button>`}<button class="ag-icon-button" data-action="open-artifact" aria-label="Open artifact">${AGIcon('artifact',{size:16})}</button></div></header>`;
    const takeover=mission?.controlMode==='takeover'?`<div class="ag-takeover-ribbon"><span>${AGIcon('shield',{size:15})}<strong>You are driving.</strong> Agent execution is paused until you hand control back.</span><button data-action="handback" data-id="${mission.id}">Hand back</button></div>`:'';
    const messages=conv.messages.map(renderMessage).join('')+renderInsightBlock(mission)+renderOutcome(mission);
    const actions=AGActionDock({actions:[{label:'Artifact',action:'open-artifact',icon:'artifact'},{label:'Delegate',action:'delegate',icon:'agents'},{label:'Context',action:'context-preview',icon:'inspect'},{label:'Needs you',action:'show-control',icon:'approval',meta:String(attentionCount(state))}]});
    const composer=AGComposer({mode:state.composerMode});
    const meta=`<div class="ag-composer-meta"><span>${mission?.controlMode==='takeover'?'Human-controlled':'Ready'}</span><span>${mission?.evidenceCount||0} evidence${mission?.budget?` · ${compactMoney(mission.budget.used,mission.budget.currency)} used`:''}</span></div>`;
    const artifact=layout.artifact.presentation==='split'?`<div class="ag-resize-handle" role="separator" tabindex="0" aria-label="Resize artifact" aria-orientation="vertical" aria-valuemin="34" aria-valuemax="56" aria-valuenow="${ui.artifactWidth}"><i></i></div>${renderArtifactSurface('split')}`:'';
    return renderChatView({header,takeover,messages,live:renderLiveStrip(mission),actions,composer,meta,artifact,artifactOpen:layout.artifact.presentation==='split',liveState,controlMode:mission?.controlMode||'observe'});
  }

  function renderArtifactDocument(artifact){
    if(artifact.id==='art_q4')return `<article class="ag-document"><div class="ag-doc-cover"><div><span class="ag-mark mini"><i></i><i></i></span><small>Acme Corporation · Q4 2024</small></div><h2>Q4 2024<br/>Business Analysis</h2><p>Insights. Trends. Opportunities.</p><div class="ag-doc-wave"><i></i><i></i><i></i></div></div><section><span class="ag-doc-kicker">Executive Summary</span><h3>Strong growth with durable customer quality</h3><p>Q4 delivered strong results across the core metrics. Revenue increased 18%, customer acquisition rose 24%, and retention remained at 94%.</p><div class="ag-doc-metrics"><div><strong>€4.2M</strong><span>Revenue</span><small>↑ 18%</small></div><div><strong>12.8K</strong><span>Customers</span><small>↑ 24%</small></div><div><strong>€326</strong><span>ARPU</span><small>↑ 12%</small></div><div><strong>94%</strong><span>Retention</span><small>↑ 3%</small></div></div><h3>Key findings</h3><ol><li><b>1</b><span><strong>Enterprise expansion</strong><small>Higher-value accounts contributed most of the quarter’s growth.</small></span></li><li><b>2</b><span><strong>Healthy acquisition</strong><small>Acquisition outpaced churn while retention stayed stable.</small></span></li><li><b>3</b><span><strong>Packaging headroom</strong><small>ARPU gains support a more ambitious packaging experiment.</small></span></li></ol></section></article>`;
    return `<article class="ag-document"><section><span class="ag-doc-kicker">${escapeHtml(artifact.kind)}</span><h2>${escapeHtml(artifact.title)}</h2><p>This durable output remains attached to its mission, provenance and verification state.</p></section></article>`;
  }

  function renderArtifactSurface(mode='split'){
    const artifact=currentArtifact();
    const body=ui.artifactTab==='preview'?renderArtifactDocument(artifact):ui.artifactTab==='versions'?`<div class="ag-version-list"><button class="active"><span>v3</span><div><strong>Current</strong><small>${escapeHtml(artifact.updated)} · Friday</small></div>${statusPill(artifact.verified?'verified':'draft')}</button><button><span>v2</span><div><strong>Analysis pass</strong><small>12 min ago · Data Analysis Agent</small></div></button><button><span>v1</span><div><strong>Initial draft</strong><small>28 min ago · Friday</small></div></button></div>`:`<dl class="ag-detail-list"><div><dt>Kind</dt><dd>${escapeHtml(artifact.kind)}</dd></div><div><dt>State</dt><dd>${escapeHtml(artifact.state)}</dd></div><div><dt>Verification</dt><dd>${artifact.verified?'Verified':'Pending'}</dd></div><div><dt>Size</dt><dd>${escapeHtml(artifact.size)}</dd></div></dl>`;
    return `<aside class="ag-artifact-surface artifact-surface ${mode}" data-presentation="${mode}" aria-label="Artifact workspace">${AGArtifact({id:artifact.id,title:artifact.title,state:artifact.state,verified:artifact.verified,content:`<div class="ag-artifact-toolbar"><div class="ag-artifact-tabs"><button class="${ui.artifactTab==='preview'?'active':''}" data-artifact-tab="preview">Preview</button><button class="${ui.artifactTab==='versions'?'active':''}" data-artifact-tab="versions">Versions</button><button class="${ui.artifactTab==='details'?'active':''}" data-artifact-tab="details">Details</button></div><div><button class="ag-icon-button" data-action="copy-link" data-type="artifact" data-id="${artifact.id}" aria-label="Copy artifact link">${icon('external',{size:14})}</button><button class="ag-icon-button" data-action="close-artifact" aria-label="Close artifact">${AGIcon('close',{size:15})}</button></div></div><div class="ag-artifact-scroll">${body}</div>`})}</aside>`;
  }

  function renderMissionDetail(mission){
    const layout=composeLivingLayout({device:ui.device,artifactOpen:ui.artifactOpen,inspectorOpen:ui.inspectorOpen,takeover:mission.controlMode==='takeover'});
    return `<div class="ag-work-detail"><header><div><small>Mission</small><h1>${escapeHtml(mission.title)}</h1><p>${escapeHtml(mission.objective)}</p></div><div><button class="ag-button" data-action="${mission.controlMode==='takeover'?'handback':'takeover'}" data-id="${mission.id}">${AGIcon('shield',{size:14})} ${mission.controlMode==='takeover'?'Hand back':'Take over'}</button><button class="ag-button primary" data-action="${runtimeFor(mission.id)?.status==='running'?'pause-live':'run-live'}">${AGIcon(runtimeFor(mission.id)?.status==='running'?'pause':'play',{size:14})} ${runtimeFor(mission.id)?.status==='running'?'Pause':'Run'}</button></div></header>${AGWorkSummary({mission,compact:true})}<section class="ag-work-trajectory"><div><span>Trajectory</span><small>${escapeHtml(mission.eta)}</small></div>${AGTrajectory({steps:mission.steps})}</section>${mission.state==='awaiting_approval'?AGNeedYou({id:'need_prod_inline',type:'approval',title:'Production action needs approval',severity:'high',detail:'Inspect risk, rollback and evidence before execution.'}):''}${renderOutcome(mission)}</div>${layout.artifact.presentation==='split'?`<div class="ag-resize-handle" role="separator" tabindex="0" aria-label="Resize artifact" aria-valuemin="34" aria-valuemax="56" aria-valuenow="${ui.artifactWidth}"><i></i></div>${renderArtifactSurface('split')}`:''}`;
  }

  function renderWork(){
    const mission=currentMission();
    const upstream=state.upstreams||{};
    const canonicalWorks=upstream.works?.works||[];
    const proposals=upstream.workIntelligence?.workItems||[];
    const truth=(canonicalWorks.length||proposals.length)?`<div class="ag-polyrepo-work"><div class="ag-section-heading"><span>Source truth</span><small>Read-only projections</small></div>${canonicalWorks.slice(0,3).map(work=>AGExternalWorkRow({work})).join('')}${proposals.slice(0,3).map(item=>AGDetectionProposalRow({item})).join('')}</div>`:'';
    const rail=`<div><span>Work</span><button data-action="new-goal" aria-label="New mission">+</button></div>${state.missions.map(m=>`<button class="${m.id===mission.id?'active':''}" data-mission="${m.id}"><span class="ag-mission-state ${escapeHtml(m.state)}"></span><span><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.agent)} · ${m.progress}%</small></span>${m.state==='awaiting_approval'?'<b>Needs you</b>':''}</button>`).join('')}${truth}`;
    const header=`<header><div><small>Mission</small><h1>${escapeHtml(mission.title)}</h1><p>${escapeHtml(mission.objective)}</p></div><div><button class="ag-button" data-action="${mission.controlMode==='takeover'?'handback':'takeover'}" data-id="${mission.id}">${AGIcon('shield',{size:14})} ${mission.controlMode==='takeover'?'Hand back':'Take over'}</button><button class="ag-button primary" data-action="${runtimeFor(mission.id)?.status==='running'?'pause-live':'run-live'}">${AGIcon(runtimeFor(mission.id)?.status==='running'?'pause':'play',{size:14})} ${runtimeFor(mission.id)?.status==='running'?'Pause':'Run'}</button></div></header>`;
    const attention=mission.state==='awaiting_approval'?AGNeedYou({id:'need_prod_inline',type:'approval',title:'Production action needs approval',severity:'high',detail:'Inspect risk, rollback and evidence before execution.'}):'';
    const artifact=ui.artifactOpen?`<div class="ag-resize-handle" role="separator" tabindex="0" aria-label="Resize artifact" aria-valuemin="34" aria-valuemax="56" aria-valuenow="${ui.artifactWidth}"><i></i></div>${renderArtifactSurface('split')}`:'';
    return renderWorkView({rail,header,summary:AGWorkSummary({mission,compact:true}),attention,outcome:renderOutcome(mission),trajectory:AGTrajectory({steps:mission.steps}),artifact,artifactOpen:ui.artifactOpen});
  }


  function semanticObjectId(level){
    const mission=currentMission();
    if(level==='mission'||level==='workstream'||level==='task')return mission?.id||null;
    if(level==='agent')return ui.followedAgentId||ui.selectedAgentId||state.agents[0]?.id||null;
    if(level==='action')return mission?.steps?.find(step=>step.state==='running')?.id||mission?.steps?.[0]?.id||null;
    if(level==='evidence')return state.artifacts.find(a=>a.missionId===mission?.id)?.id||state.artifacts[0]?.id||null;
    return null;
  }

  function renderSpaceSurfaceBody(surface){
    const [kind,id]=String(surface.id||'').split(':',2);
    if(kind==='mission'){
      const mission=state.missions.find(m=>m.id===id)||currentMission();
      return `<div class="ag-space-mission"><div class="ag-space-object-head"><span><small>${escapeHtml(mission.state)}</small><strong>${escapeHtml(mission.title)}</strong></span><button type="button" data-action="${mission.controlMode==='takeover'?'handback':'takeover'}" data-id="${mission.id}">${AGIcon('shield',{size:13})}${mission.controlMode==='takeover'?'Hand back':'Take over'}</button></div>${AGTrajectoryGraph({mission})}<div class="ag-space-mission-foot">${AGEvidenceGraph({missionId:mission.id,evidenceCount:mission.evidenceCount,verified:mission.verified})}<span><strong>${mission.progress}%</strong><small>${escapeHtml(mission.agent)} · ${escapeHtml(mission.eta)}</small></span></div></div>`;
    }
    if(kind==='artifact'){
      const artifact=state.artifacts.find(a=>a.id===id)||currentArtifact();
      return `<div class="ag-space-artifact-mini" tabindex="0" role="region" aria-label="Artifact preview">${renderArtifactDocument(artifact)}</div>`;
    }
    if(kind==='agent'){
      const agent=state.agents.find(a=>a.id===id)||currentAgent();
      return `<div class="ag-space-agent-focus">${AGAgentCard({agent})}<button type="button" data-presence-action="follow" data-presence-id="${agent.id}">${ui.followedAgentId===agent.id?'Following agent':'Follow this agent'}</button></div>`;
    }
    if(kind==='evidence'){
      const mission=state.missions.find(m=>m.id===id)||currentMission();
      return AGEvidenceGraph({missionId:mission.id,evidenceCount:mission.evidenceCount,verified:mission.verified});
    }
    if(kind==='replay'){
      const frames=buildReplayFrames(state.events);
      return AGReplayTimeline({frames,activeIndex:state.replay?.cursor||0,playing:Boolean(state.replay?.playing)});
    }
    return `<div class="ag-space-generic"><strong>${escapeHtml(surface.title||surface.id)}</strong><small>${escapeHtml(surface.kind||'surface')}</small></div>`;
  }

  function renderSpace(){
    const mission=currentMission();
    const space=currentSpace();
    const presence=derivePresence({user:state.user,agents:state.agents,followedAgentId:ui.followedAgentId});
    const frames=buildReplayFrames(state.events);
    const intentContext=[{type:'mission',id:mission.id,label:mission.title},{type:'artifact',id:currentArtifact()?.id,label:currentArtifact()?.title}].filter(item=>item.id&&!ui.hiddenIntentContextKeys.includes(`${item.type}:${item.id}`));
    const intent=normalizeIntent({mode:ui.intentMode,context:intentContext,attachments:ui.intentAttachments});
    const layoutControls=`<div class="ag-space-mode-controls" role="group" aria-label="Space layout"><button type="button" class="${space?.mode==='balanced'?'active':''}" data-space-command="balanced">Balanced</button><button type="button" class="${space?.mode==='focus'?'active':''}" data-space-command="focus">Focus</button><button type="button" class="${space?.mode==='overview'?'active':''}" data-space-command="overview">Overview</button></div>`;
    const toolbar=`${AGSemanticZoom({level:space?.zoom?.level||'mission',objectId:space?.zoom?.objectId||semanticObjectId(space?.zoom?.level||'mission')})}${AGDock({items:[{kind:'artifact',label:'Artifact'},{kind:'agent',label:'Agent'},{kind:'evidence',label:'Evidence'},{kind:'replay',label:'Replay'}]})}${layoutControls}`;
    const canvas=AGSpace({space,renderSurfaceBody:renderSpaceSurfaceBody});
    const context=`${AGContextLens({level:space?.zoom?.level||'mission',objectId:space?.zoom?.objectId||semanticObjectId(space?.zoom?.level||'mission'),detail:space?.focusedSurfaceId?`Focused ${space.focusedSurfaceId}`:'Workspace overview'})}${AGPresenceRail({presence,collapsed:!ui.presenceOpen})}<section class="ag-space-time"><header><span><small>Time layer</small><strong>Replay</strong></span><button type="button" data-space-add="replay">Open</button></header>${AGReplayTimeline({frames,activeIndex:state.replay?.cursor||0,playing:Boolean(state.replay?.playing)})}</section>`;
    return renderSpaceView({toolbar,canvas,context,composer:AGIntentComposer({intent,capabilities:['Ask','Research','Build','Create','Delegate','Automate']}),spaceId:space?.id||'space_primary',mode:space?.mode||'balanced'});
  }


  function updateSpace(action,{renderNow=true}={}){
    const current=currentSpace();if(!current||!action)return;
    const next=reduceSpatialState(current,action);
    state.spaces=state.spaces.map(space=>space.id===current.id?next:space);
    state.activeSpaceId=current.id;state.primaryMode='space';state.activeDomain='work';saveState();
    if(backendConnected)void apiClient.updateSpace(current.id,action).then(payload=>applyBackendPayload(payload,{renderNow:false})).catch(backendFailed);
    if(renderNow)render();
  }

  function addSpaceSurface(kind){
    const mission=currentMission();
    const artifact=state.artifacts.find(a=>a.missionId===mission.id)||currentArtifact();
    const agent=state.agents.find(a=>a.id===ui.followedAgentId)||currentAgent();
    const surface=kind==='artifact'?{id:`artifact:${artifact.id}`,kind:'artifact',title:artifact.title}:kind==='agent'?{id:`agent:${agent.id}`,kind:'agent',title:agent.name}:kind==='evidence'?{id:`evidence:${mission.id}`,kind:'evidence',title:'Mission evidence'}:{id:'replay:workspace',kind:'replay',title:'Mission replay'};
    updateSpace({type:'surface.dock',surface,regionId:'detail'});
  }

  function handleSpaceAction(el){
    const action=el.dataset.spaceAction;
    const space=currentSpace();if(!space)return;
    if(action==='focus'){updateSpace(resolveInteraction({command:'focus-surface',surfaceId:el.dataset.surfaceId}));return}
    if(action==='close'){updateSpace(resolveInteraction({command:'close-surface',surfaceId:el.dataset.surfaceId}));return}
    if(action==='move'){
      const found=space.regions.find(region=>region.surfaces.some(surface=>surface.id===el.dataset.surfaceId));
      const regionId=found?.id==='primary'?'detail':'primary';updateSpace(resolveInteraction({command:'move-surface',surfaceId:el.dataset.surfaceId,regionId}));return
    }
    if(action==='toggle-presence'){ui.presenceOpen=!ui.presenceOpen;render();return}
    if(action==='zoom')updateSpace({type:'zoom.set',level:el.dataset.zoomLevel,objectId:semanticObjectId(el.dataset.zoomLevel)});
    if(action==='zoom-in')updateSpace(resolveInteraction({command:'zoom-in',level:space.zoom.level,objectId:semanticObjectId(nextSemanticZoom(space.zoom.level,1))}));
    if(action==='zoom-out')updateSpace(resolveInteraction({command:'zoom-out',level:space.zoom.level,objectId:semanticObjectId(nextSemanticZoom(space.zoom.level,-1))}));
  }

  function handleIntentSubmit(form){
    const text=form.querySelector('textarea[name="message"]')?.value.trim();if(!text)return;
    const mode=ui.intentMode||'Ask';
    state.composerMode=mode;state.primaryMode=mode==='Build'||mode==='Automate'?'work':'chat';state.activeDomain=state.primaryMode==='work'?'work':'chat';
    const attachments=ui.intentAttachments.map(item=>({...item}));
    state=appendChatMessage(state,state.activeConversationId,{type:'text',author:'user',text:`[${mode}] ${text}`,...(attachments.length?{attachments}: {})});
    state.events.unshift({id:`ev_${Date.now()}`,type:'intent.composed',text:`${mode}: ${text.slice(0,80)}`,time:'now'});
    ui.intentAttachments=[];
    saveState();toast(`${mode} intent created`);render();
    if(backendConnected)void syncBackend(apiClient.sendMessage(state.activeConversationId,{text,mode,actor:state.user.id,attachments}));
  }

  function renderContextInspector(){
    if(!ui.inspectorOpen)return '';
    const mission=state.activeDomain==='chat'?chatMission():currentMission();
    let kicker='Context',title='What the system can use',body='';
    if(ui.inspectorKind==='agent'){
      const agent=currentAgent();kicker='Agent';title=agent.name;
      body=`<section><span>Runtime identity</span><dl class="ag-context-summary"><div><dt>Role</dt><dd>${escapeHtml(agent.role)}</dd></div><div><dt>State</dt><dd>${escapeHtml(agent.state)}</dd></div><div><dt>Current task</dt><dd>${escapeHtml(agent.task)}</dd></div><div><dt>Authority</dt><dd>${escapeHtml(agent.authority)}</dd></div><div><dt>Spend</dt><dd>€${Number(agent.spend||0).toFixed(2)}</dd></div><div><dt>Evidence</dt><dd>${agent.evidence} records</dd></div></dl></section>`;
    }else if(ui.inspectorKind==='connection'){
      const connection=state.connections.find(c=>c.id===ui.selectedConnectionId)||state.connections[0];kicker='Connection';title=connection.name;
      body=`<section><span>Capability scope</span>${AGConnectionRow({connection})}<div class="ag-permission-list">${connection.permissions.map(p=>`<code>${escapeHtml(p)}</code>`).join('')}</div></section>`;
    }else{
      const context=AGContextSummary({conversation:currentConversation()?.title||'None',mission:mission?.title||'None',agent:mission?.agent||'Friday',authority:state.user.capabilities.includes('*')?'Operator':'Scoped',evidence:mission?.evidenceCount||0,backend:backendConnected?'connected':'local'});
      const memories=state.memory.map(m=>AGMemoryItem({id:m.id,label:m.label,scope:m.scope,source:m.source,promoted:m.promoted,status:m.status,confidence:m.confidence,pendingAction:pendingActions.has(`memory:${m.id}`)?'promote-memory':null})).join('');
      body=`<section><span>Active context</span>${context}</section><section><span>Mounted memory</span><div class="ag-memory-list">${memories}</div></section>`;
    }
    return `<div class="ag-inspector-backdrop" data-action="close-inspector"></div><aside class="ag-inspector" aria-label="${escapeHtml(kicker)} inspector"><header><div><small>${escapeHtml(kicker)}</small><strong>${escapeHtml(title)}</strong></div><button class="ag-icon-button" data-action="close-inspector">${AGIcon('close',{size:15})}</button></header><div class="ag-inspector-body">${body}</div></aside>`;
  }

  function renderApprovalFocus(){
    if(!ui.approvalOpen)return '';
    const approval=currentApproval();
    const base=AGApproval({id:approval.id,title:approval.title,risk:approval.risk,state:pendingActions.has(`approval:${approval.id}`)?'loading':approval.state,why:approval.why,impact:approval.impact,rollback:approval.rollback,authority:approval.authority,evidence:approval.evidence});
    return `<div class="ag-approval-backdrop" data-action="close-approval"></div><div class="ag-approval-shell attention-gravity">${base}<button class="ag-approval-close" data-action="close-approval" aria-label="Close approval">${AGIcon('close',{size:16})}</button>${ui.approvalEvidenceOpen?`<aside class="ag-evidence-reveal"><header>${AGIcon('evidence',{size:16})}<strong>Verification evidence</strong></header>${approval.evidence.map((id,i)=>`<div><span>${AGIcon('check',{size:13})}</span><span><strong>${escapeHtml(id)}</strong><small>${i===0?'Staging verification passed':'Health and rollback evidence sealed'}</small></span></div>`).join('')}</aside>`:''}</div>`;
  }

  function renderPalette(){
    if(!ui.paletteOpen)return '';
    const q=ui.paletteQuery.trim();
    const commands=[
      {id:'new-chat',kind:'command',title:'New chat',subtitle:'Start a conversation',icon:'chat',shortcut:'⌘N'},
      {id:'open-space',kind:'command',title:'Open Space',subtitle:'Compose live work spatially',icon:'spark'},
      {id:'new-goal',kind:'command',title:'Create work',subtitle:'Turn intent into a mission',icon:'work',shortcut:'⌘M'},
      {id:'run-live',kind:'command',title:'Run live mission',subtitle:'Start deterministic local execution',icon:'play'},
      {id:'delegate',kind:'command',title:'Delegate to agent',subtitle:'Assign work to the right capability',icon:'agents'},
      {id:'show-control',kind:'command',title:'Show needs you',subtitle:'Approvals, budget and credentials',icon:'control'},
      {id:'toggle-immersive',kind:'command',title:ui.immersive?'Exit immersive mode':'Enter immersive mode',subtitle:'Let the active work take the space',icon:'spark'},
      ...commandDomainEntries().map(d=>({id:d.domain,kind:'domain',domain:d.domain,title:`Open ${d.title||d.domain}`,subtitle:d.description,icon:d.domain})),
    ];
    const federatedObjects=(federationSnapshot.objects||[]).map(x=>({id:x.graphId,kind:'object',type:x.type,domain:domainForObject(x.type),title:x.payload?.title||x.payload?.name||x.canonicalId||x.graphId,subtitle:`${String(x.type||'object').replaceAll('_',' ')} · ${x.sourceIntegration||x.canonicalOwner||'federated'} · ${x.freshness||'stale'}`,icon:domainForObject(x.type)}));
    const objects=[...state.missions.map(x=>({...x,kind:'object',type:'mission',domain:'work',title:x.title,subtitle:`Mission · ${x.state}`,icon:'work'})),...state.artifacts.map(x=>({...x,kind:'object',type:'artifact',domain:'output',title:x.title,subtitle:`Artifact · ${x.kind}`,icon:'file'})),...state.agents.map(x=>({...x,kind:'object',type:'agent',domain:'agents',title:x.name,subtitle:`Agent · ${x.state}`,icon:'agents'})),...federatedObjects];
    const results=q?searchIndex([...commands,...objects],q,12):commands.slice(0,10);
    return `<div class="ag-palette-backdrop" data-action="close-palette"></div>${AGCommandPalette({query:ui.paletteQuery,results,activeIndex:ui.paletteIndex,footer:'9 canonical domains'})}`;
  }

  function renderDomainHeader(domain,title=domain.label,description=domain.description,meta='Command-accessed canonical domain'){
    return `<header class="ag-domain-header"><div><small>${escapeHtml(domain.label)}</small><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><span>${escapeHtml(meta)}</span></header>`;
  }

  function renderNowDomain(){
    const domain=getDomain('now');
    const attention=state.needsYou.map(n=>AGNeedYou({...n,action:n.type==='approval'?'show-control':'context-preview',targetId:n.objectId})).join('');
    const active=state.missions.filter(m=>['running','awaiting_approval'].includes(m.state)).map(m=>`<button class="ag-now-work" data-mission="${escapeHtml(m.id)}"><span class="ag-mission-state ${escapeHtml(m.state)}"></span><span><strong>${escapeHtml(m.title)}</strong><small>${escapeHtml(m.agent)} · ${m.progress}% · ${escapeHtml(m.eta)}</small></span>${m.state==='awaiting_approval'?'<em>Needs you</em>':`<b>${m.progress}%</b>`}</button>`).join('');
    return `<main id="main-content" class="ag-domain-page" data-domain-surface="now">${renderDomainHeader(domain,'Today','Your work, exceptions and outcomes, prioritized by what changes your next action.',`${attentionCount(state)} need you`)}<div class="ag-domain-layout"><div class="ag-domain-main"><section class="ag-domain-section"><div class="ag-section-heading"><span>Needs your attention</span><small>${state.needsYou.length} active</small></div><div class="ag-attention-list">${attention||'<p class="ag-domain-empty">Nothing requires intervention.</p>'}</div></section><section class="ag-domain-section"><div class="ag-section-heading"><span>In progress</span><small>${state.missions.filter(m=>m.state==='running').length} running</small></div><div class="ag-now-work-list">${active}</div></section></div><aside class="ag-domain-rail"><div class="ag-section-heading"><span>Recent activity</span><small>Evidence-backed</small></div>${state.events.slice(0,8).map(event=>AGEventRow({event})).join('')}</aside></div></main>`;
  }

  function renderAgentsDomain(){
    const domain=getDomain('agents');
    const running=state.agents.filter(a=>a.state==='running').length;
    return `<main id="main-content" class="ag-domain-page" data-domain-surface="agents">${renderDomainHeader(domain,'Agents','See who is acting, on what, with which authority, cost and evidence.',`${running} active · ${state.agents.length} total`)}${AGDelegationStrip({agents:state.agents})}<div class="ag-agent-domain-list">${state.agents.map(agent=>AGAgentCard({agent})).join('')}</div></main>`;
  }

  function renderBrainDomain(){
    const domain=getDomain('brain');
    const mission=state.activeDomain==='chat'?chatMission():currentMission();
    const context=AGContextSummary({conversation:currentConversation()?.title||'None',mission:mission?.title||'None',agent:mission?.agent||'Friday',authority:state.user.capabilities.includes('*')?'Operator':'Scoped',evidence:mission?.evidenceCount||0,backend:backendConnected?'connected':'local'});
    const brain=state.upstreams?.works?.brain||[];
    const brainRows=brain.map(item=>`<div class="ag-upstream-brain-row"><span>${AGIcon('brain',{size:14})}</span><span><strong>${escapeHtml(item.path||item.id||'Brain object')}</strong><small>${escapeHtml(item.class||item.state||'WORKS brain')}</small></span></div>`).join('');
    return `<main id="main-content" class="ag-domain-page" data-domain-surface="brain">${renderDomainHeader(domain,'Brain','Inspectable context, durable memory and the sources currently shaping system behavior.',`${state.memory.length} memories · ${state.connections.length} sources`)}<div class="ag-domain-layout"><div class="ag-domain-main"><section class="ag-domain-section"><div class="ag-section-heading"><span>Active context</span><small>${backendConnected?'Server-backed':'Local reference'}</small></div>${context}</section><section class="ag-domain-section"><div class="ag-section-heading"><span>Memory</span><small>Revocable</small></div><div class="ag-memory-list">${state.memory.map(m=>AGMemoryItem({id:m.id,label:m.label,scope:m.scope,source:m.source,promoted:m.promoted,status:m.status,confidence:m.confidence,pendingAction:pendingActions.has(`memory:${m.id}`)?'promote-memory':null})).join('')}</div></section>${brain.length?`<section class="ag-domain-section"><div class="ag-section-heading"><span>Company Brain</span>${AGSourceTruthBadge({owner:'WORKS',contract:'brain.ns/1.0',sha:state.upstreams?.services?.works?.headSha||''})}</div><div class="ag-upstream-brain-list">${brainRows}</div></section>`:''}</div><aside class="ag-domain-rail"><div class="ag-section-heading"><span>Mounted sources</span><small>${state.connections.length}</small></div>${state.connections.map(connection=>AGConnectionRow({connection})).join('')}</aside></div></main>`;
  }

  function renderOutputDomain(){
    const domain=getDomain('output');
    const list=`<div class="ag-output-list">${state.artifacts.map(artifact=>AGArtifactRow({artifact})).join('')}</div>`;
    const history=`<div class="ag-output-history">${state.events.slice(0,8).map(event=>AGEventRow({event})).join('')}</div>`;
    const pane=ui.artifactOpen&&ui.device==='desktop'?`<aside class="ag-domain-artifact-pane">${renderArtifactSurface('domain')}</aside>`:'';
    return `<main id="main-content" class="ag-domain-page ag-output-domain ${ui.artifactOpen?'with-preview':''}" data-domain-surface="output">${renderDomainHeader(domain,'Output','Durable artifacts, evidence and history stay attached to the work that produced them.',`${state.artifacts.filter(a=>a.verified).length} verified · ${state.artifacts.length} artifacts`)}<div class="ag-output-layout"><div class="ag-domain-main"><section class="ag-domain-section"><div class="ag-section-heading"><span>Artifacts</span><small>Durable outputs</small></div>${list}</section><section class="ag-domain-section"><div class="ag-section-heading"><span>History</span><small>Replayable events</small></div>${history}</section></div>${pane}</div></main>`;
  }

  function renderControlDomain(){
    const pending=state.approvals.filter(a=>a.state==='pending');
    const tgApprovals=state.upstreams?.trustGateway?.approvals||[];
    return renderControlSurface({
      localApprovals:pending,
      remoteApprovals:tgApprovals,
      exceptions:state.needsYou.filter(n=>n.type!=='approval'),
      events:state.events.filter(e=>e.type.includes('approval')||e.type.includes('mission')||e.type.includes('upstream')),
      service:state.upstreams?.services?.trustGateway||{},
      decisionError:ui.controlError||'',
      institutionalProjection:state.institutional||null,
    });
  }

  function renderConnectDomain(){
    const domain=getDomain('connect');
    const healthy=state.connections.filter(c=>c.state==='healthy').length;
    return `<main id="main-content" class="ag-domain-page" data-domain-surface="connect">${renderDomainHeader(domain,'Connections','Capabilities supplied by tools, protocols and runtimes remain scoped, inspectable and health-aware.',`${healthy}/${state.connections.length} healthy`)}<section class="ag-domain-section ag-connect-list"><div class="ag-section-heading"><span>Connected capabilities</span><small>Click to inspect</small></div>${state.connections.map(connection=>AGConnectionRow({connection})).join('')}</section></main>`;
  }

  function renderSystemDomain(){
    return renderSystemSurface({
      services:state.upstreams?.services||{},
      telemetry:state.telemetry||{},
      syncedAt:state.upstreams?.syncedAt||'',
      backendPhase:ui.backendStatus||'offline',
      identity:{name:state.user.name,role:state.user.role,capabilityLabel:state.user.capabilities.includes('*')?'full capability set':'scoped capabilities'},
      events:state.events||[],
    });
  }

  const domainRenderers={now:renderNowDomain,agents:renderAgentsDomain,brain:renderBrainDomain,research:()=>renderResearchSurface(federationSnapshot),capabilities:()=>renderCapabilitiesSurface(federationSnapshot),output:renderOutputDomain,control:renderControlDomain,connect:renderConnectDomain,system:renderSystemDomain};
  function renderFallbackDomain(){
    const domain=getDomain(state.activeDomain);return `<main id="main-content" class="ag-domain-page" data-domain-surface="${escapeHtml(domain.id)}">${renderDomainHeader(domain)}<p class="ag-domain-empty">This domain is registered but has no active surface for the current capability set.</p></main>`;
  }
  function renderView(){if(state.primaryMode==='space'&&state.activeDomain==='work')return renderSpace();if(state.activeDomain==='chat')return renderChat();if(state.activeDomain==='work')return renderWork();return (domainRenderers[state.activeDomain]||renderFallbackDomain)()}

  function currentLivingLayout(){
    const mission=state.activeDomain==='chat'?chatMission():currentMission();
    const approval=ui.approvalOpen?currentApproval():null;
    return composeLivingLayout({device:ui.device,artifactOpen:ui.artifactOpen,inspectorOpen:ui.inspectorOpen,risk:approval?.risk||mission?.risk||'low',approvalPending:Boolean(approval&&approval.state==='pending'),takeover:mission?.controlMode==='takeover',attention:state.needsYou.length?'needs-you':'normal'});
  }

  function render(){
    if(qaMetrics)qaMetrics.shellRenders++;
    const existingList=document.querySelector('#message-list');
    if(existingList&&!ui.forceFollowLatest){ui.messageScrollTop=existingList.scrollTop;ui.followLatest=(existingList.scrollHeight-existingList.clientHeight-existingList.scrollTop)<32}
    ui.device=detectDevice();
    const mission=state.activeDomain==='chat'?chatMission():currentMission();
    const layout=currentLivingLayout();
    const artifactMobile=ui.artifactOpen&&ui.device==='mobile';
    const shellClass=[ui.immersive?'is-immersive':'',layout.gravity.mode==='approval-focus'?'attention-gravity':'',mission?.verified?'has-settled-outcome':''].filter(Boolean).join(' ');
    const globalPulse=activeMode()==='space'?'':renderPulseRail(mission);
    app.innerHTML=`<div class="ag-app ${shellClass}" data-backend-state="${backendConnected?'connected':'local'}" data-attention="${layout.gravity.mode}" data-theme-state="${layout.ambient.mode}" style="--artifact-width:${ui.artifactWidth}%">${renderAmbient(layout,mission)}${renderSidebar()}<section class="ag-frame">${renderTopbar()}<div class="ag-body">${renderView()}</div></section>${artifactMobile?renderArtifactSurface('fullscreen'):''}${globalPulse}${renderContextInspector()}${renderApprovalFocus()}${renderPalette()}</div>`;
    postRender(mission,layout);
  }

  function postRender(mission,layout){
    if(ui.paletteOpen)requestAnimationFrame(()=>document.querySelector('#palette-input')?.focus());
    if(ui.approvalOpen)requestAnimationFrame(()=>document.querySelector('.ag-approval button')?.focus());
    if(state.activeDomain==='chat')requestAnimationFrame(()=>{const list=document.querySelector('#message-list');if(!list)return;const max=Math.max(0,list.scrollHeight-list.clientHeight);list.scrollTop=ui.followLatest?max:Math.min(ui.messageScrollTop,max);ui.forceFollowLatest=false});
    const artifact=document.querySelector('.ag-artifact-surface');
    if(surfaceLifecycle.entered('artifact',Boolean(artifact))&&artifact){
      const artifactContent=artifact.querySelector('[data-ag-component="artifact"]')||artifact;
      morphSurface(artifactContent,{from:{opacity:.32,transform:'translateY(6px) scale(.992)'},to:{opacity:1,transform:'none'},semantic:'surface.expand'});
    }
    if(state.primaryMode==='space'&&state.activeDomain==='work'){
      const surfaces=[...document.querySelectorAll('.ag-space-surface')];
      const currentIds=surfaces.map(el=>el.dataset.surface).filter(Boolean);
      const entering=new Set(diffSurfaceEntries(renderedSpaceSurfaceIds,currentIds));
      for(const el of surfaces){if(entering.has(el.dataset.surface))animateElement(el,[{opacity:.42,transform:'translateY(8px) scale(.992)'},{opacity:1,transform:'none'}],'surface.expand')}
      renderedSpaceSurfaceIds=new Set(currentIds);
    }else renderedSpaceSurfaceIds=new Set();
    const focus=document.querySelector('.ag-approval-shell .ag-approval');
    if(surfaceLifecycle.entered('approval',Boolean(focus))&&focus)requestAnimationFrame(()=>animateElement(focus,[{opacity:0,transform:'translateY(12px) scale(.98)'},{opacity:1,transform:'none'}],'attention.focus'));
    if(mission){const prev=lastProgress.get(mission.id)??mission.progress;if(prev!==mission.progress){const bar=document.querySelector('.ag-live-progress i');if(bar)animateElement(bar,[{opacity:.7},{opacity:1}],'trajectory.advance');lastProgress.set(mission.id,mission.progress)}}
    try{document.documentElement.dataset.theme=localStorage.getItem('aftergraph-theme')||'dark'}catch{document.documentElement.dataset.theme='dark'}
  }

  function handleComposerSubmit(form){
    const input=form.querySelector('textarea[name="message"]');const text=input?.value.trim();if(!text)return;
    ui.followLatest=true;ui.forceFollowLatest=true;
    const conversationId=state.activeConversationId;
    const mode=state.composerMode||'Ask';
    const reply={
      type:mode==='Goal'?'plan':'agent_run',
      author:'Friday',
      text:mode==='Goal'?'Goal accepted. I turned it into structured work and will surface only the exceptions that need you.':'I’m on it. I’ll keep the live trajectory visible while the work changes state.',
      missionId:mode==='Goal'?chatMission()?.id:undefined,
      agentId:mode==='Goal'?undefined:'agent_data',
    };
    state=appendChatMessage(state,conversationId,{type:'text',author:'user',text});
    state=appendChatMessage(state,conversationId,reply);
    saveState();render();toast(`${mode} submitted`);
    if(backendConnected)void syncBackend(apiClient.sendMessage(conversationId,{text,mode,actor:state.user.id,reply}));
  }

  function startRuntime(missionId){
    stopRuntimeTimer();
    if(backendConnected){
      void apiClient.runtime(missionId,'start').then(payload=>{
        backendRuntimes={...backendRuntimes,[missionId]:payload.runtime};
        applyBackendPayload(payload);
      }).catch(backendFailed);
      return;
    }
    liveRuntime=createLiveRuntime(state,missionId);liveRuntime.status='running';
    liveTimer=setInterval(()=>{liveRuntime=stepMission(liveRuntime);state=liveRuntime.state;saveState();render();if(['verified','awaiting_approval'].includes(liveRuntime.status)){stopRuntimeTimer();if(liveRuntime.status==='verified')toast('Outcome verified and settled')}},1250);
    render();
  }
  function stopRuntimeTimer(){if(liveTimer){clearInterval(liveTimer);liveTimer=null}}

  function runAction(action,el={dataset:{}}){
    switch(action){
      case 'new-chat':{ui.followLatest=true;ui.forceFollowLatest=true;ui.messageScrollTop=0;const id=`conv_${Date.now()}`;const title='New conversation';state.conversations.unshift({id,missionId:null,title,updated:'now',status:'idle',messages:[]});state.activeConversationId=id;state.activeDomain='chat';state.primaryMode='chat';ui.artifactOpen=false;saveState();if(backendConnected)void syncBackend(apiClient.createConversation({id,title}));break}
      case 'new-goal':state.activeDomain='work';state.primaryMode='work';ui.selectedMissionId='mission_q4';break;
      case 'open-space':state.activeDomain='work';state.primaryMode='space';try{history.pushState({},'', '/space')}catch{};break;
      case 'delegate':state.composerMode='Delegate';state.activeDomain='chat';state.primaryMode='chat';toast('Delegate mode ready');break;
      case 'open-palette':ui.paletteOpen=true;ui.paletteQuery='';ui.paletteIndex=0;break;
      case 'close-palette':ui.paletteOpen=false;break;
      case 'open-artifact':{ui.pulseOpen=false;const m=state.activeDomain==='chat'?chatMission():currentMission();const artifact=state.artifacts.find(a=>a.missionId===m?.id)||currentArtifact();if(artifact)ui.selectedArtifactId=artifact.id;ui.artifactOpen=true;break}
      case 'close-artifact':ui.artifactOpen=false;break;
      case 'context-preview':ui.inspectorKind='context';ui.inspectorOpen=true;break;
      case 'close-inspector':ui.inspectorOpen=false;break;
      case 'show-control':{ui.pulseOpen=false;const pending=(el.dataset.targetId&&state.approvals.find(a=>a.id===el.dataset.targetId))||state.approvals.find(a=>a.state==='pending');if(pending){ui.selectedApprovalId=pending.id;ui.approvalOpen=true;ui.approvalEvidenceOpen=false}else toast('No approval needs attention');break}
      case 'close-approval':ui.approvalOpen=false;ui.approvalEvidenceOpen=false;break;
      case 'run-live':startRuntime((state.activeDomain==='chat'?chatMission():currentMission())?.id||'mission_q4');return;
      case 'pause-live':{const id=(state.activeDomain==='chat'?chatMission():currentMission())?.id;if(backendConnected&&id){void apiClient.runtime(id,'pause').then(payload=>{backendRuntimes={...backendRuntimes,[id]:payload.runtime};applyBackendPayload(payload);toast('Mission paused')}).catch(backendFailed)}else if(liveRuntime){liveRuntime=pauseMission(liveRuntime);state=liveRuntime.state;stopRuntimeTimer();toast('Mission paused')}break;}
      case 'resume-live':{const id=(state.activeDomain==='chat'?chatMission():currentMission())?.id;if(backendConnected&&id){void apiClient.runtime(id,'resume').then(payload=>{backendRuntimes={...backendRuntimes,[id]:payload.runtime};applyBackendPayload(payload);toast('Mission resumed')}).catch(backendFailed)}else if(liveRuntime){liveRuntime=resumeMission(liveRuntime);state=liveRuntime.state;startRuntime(liveRuntime.missionId)}break;}
      case 'toggle-immersive':ui.immersive=!ui.immersive;break;
      case 'toggle-pulse':ui.pulseOpen=!ui.pulseOpen;break;
      case 'takeover':if(el.dataset.id){const key=`control:${el.dataset.id}:takeover`;if(!beginUiAction(key))break;stopRuntimeTimer();if(backendConnected){void apiClient.setControl(el.dataset.id,'takeover',state.user.id).then(payload=>{applyBackendPayload(payload);toast('Human control active');endUiAction(key)}).catch(error=>{toast('Takeover failed');endUiAction(key);console.warn('Takeover failed',error?.code||error)})}else{state=setTakeover(state,el.dataset.id,true);if(liveRuntime?.missionId===el.dataset.id)liveRuntime=pauseMission(liveRuntime);saveState();toast('Human control active');endUiAction(key)}}break;
      case 'handback':if(el.dataset.id){const key=`control:${el.dataset.id}:observe`;if(!beginUiAction(key))break;if(backendConnected){void apiClient.setControl(el.dataset.id,'observe',state.user.id).then(payload=>{applyBackendPayload(payload);toast('Control handed back');endUiAction(key)}).catch(error=>{toast('Handback failed');endUiAction(key);console.warn('Handback failed',error?.code||error)})}else{state=setTakeover(state,el.dataset.id,false);saveState();toast('Control handed back');endUiAction(key)}}break;
      case 'show-evidence':ui.inspectorOpen=true;break;
      case 'revoke-memory':if(el.dataset.id){const key=`memory:${el.dataset.id}`;if(!beginUiAction(key))break;if(backendConnected){void apiClient.deleteMemory(el.dataset.id,state.user.id).then(payload=>{applyBackendPayload(payload);toast('Memory revoked');endUiAction(key)}).catch(error=>{toast('Memory revoke failed');endUiAction(key);console.warn('Memory revoke failed',error?.code||error)})}else{state.memory=state.memory.filter(m=>m.id!==el.dataset.id);saveState();toast('Memory revoked');endUiAction(key)}}break;
      case 'promote-memory':if(el.dataset.id){const key=`memory:${el.dataset.id}`;if(!beginUiAction(key))break;const evidence=state.artifacts.find(a=>a.verified)?.id;if(!backendConnected||!evidence){toast('Promotion needs server connection and verified evidence');endUiAction(key);break;}void apiClient.promoteMemory(el.dataset.id,{actor:state.user.id,evidence}).then(payload=>{applyBackendPayload(payload);toast('Memory promoted');endUiAction(key)}).catch(error=>{toast('Memory promotion failed');endUiAction(key);console.warn('Memory promotion failed',error?.code||error)})}break;
      case 'copy-link':{const type=el.dataset.type,id=el.dataset.id;const link=location.origin+buildDeepLink(domainForObject(type),type,id);navigator.clipboard?.writeText(link).catch(()=>{});toast('Deep link copied');break}
      case 'sync-upstreams':if(backendConnected){void apiClient.syncUpstreams().then(payload=>{applyUpstreamPayload(payload);toast('Source truth synchronized')}).catch(error=>{console.warn('Upstream sync failed',error?.code||error);toast('Upstream sync failed')})}break;
      case 'reset-demo':stopRuntimeTimer();try{localStorage.removeItem(STORAGE_KEY)}catch{};state=createInitialState();liveRuntime=null;backendRuntimes={};toast('Demo reset');if(backendConnected)void syncBackend(apiClient.reset());break;
      default:if(action)toast(action.replaceAll('-',' '));
    }
  }

  function stopReplay(){if(replayTimer){clearInterval(replayTimer);replayTimer=null}if(state.replay?.playing){state.replay={...state.replay,playing:false};saveState();if(backendConnected)void apiClient.replay(state.replay)}}
  function startReplay(){
    stopReplay();const frames=buildReplayFrames(state.events);if(frames.length<2)return;
    state.replay={...state.replay,playing:true};saveState();if(backendConnected)void apiClient.replay(state.replay);render();
    replayTimer=setInterval(()=>{const max=Math.max(0,buildReplayFrames(state.events).length-1);const next=Math.min(max,(state.replay?.cursor||0)+1);state.replay={...state.replay,cursor:next,playing:next<max};saveState();if(backendConnected)void apiClient.replay(state.replay);render();if(next>=max){clearInterval(replayTimer);replayTimer=null}},850);
  }
  function handleReplayAction(action){if(action==='play'){startReplay();return}if(action==='pause'){stopReplay();render();return}}

  function executePalette(el){
    const kind=el.dataset.resultKind,id=el.dataset.resultId;ui.paletteOpen=false;
    if(kind==='domain'){navigateDomain(el.dataset.resultDomain||id);return}
    if(kind==='object'){navigateObject(el.dataset.resultType,id);return}
    if(kind==='command'){runAction(id,el);render();return}
  }

  app.addEventListener('click',event=>{
    const el=event.target.closest('button,[data-action],[data-space-action],[data-presence-action],[data-space-add],[data-replay-index],[data-viz-action],[data-capability],[data-context-remove],[data-composer-action],[data-replay-action]');if(!el)return;
    if(el.dataset.spaceAction){handleSpaceAction(el);return}
    if(el.dataset.spaceCommand){updateSpace({type:'space.mode',mode:el.dataset.spaceCommand});return}
    if(el.dataset.spaceAdd){addSpaceSurface(el.dataset.spaceAdd);return}
    if(el.dataset.presenceAction==='follow'){ui.followedAgentId=ui.followedAgentId===el.dataset.presenceId?null:el.dataset.presenceId;if(ui.followedAgentId){ui.selectedAgentId=ui.followedAgentId;updateSpace({type:'zoom.set',level:'agent',objectId:ui.followedAgentId},{renderNow:false})}render();return}
    if(el.dataset.replayAction&&el.dataset.replayAction!=='scrub'){handleReplayAction(el.dataset.replayAction);return}
    if(el.dataset.replayIndex){const cursor=Number(el.dataset.replayIndex);state.replay={...state.replay,cursor};saveState();if(backendConnected)void apiClient.replay({cursor});render();return}
    if(el.dataset.capability){ui.intentMode=el.dataset.capability;render();return}
    if(el.dataset.contextRemove){if(!ui.hiddenIntentContextKeys.includes(el.dataset.contextRemove))ui.hiddenIntentContextKeys.push(el.dataset.contextRemove);render();return}
    if(el.dataset.composerAction){if(el.dataset.composerAction==='attach'){document.querySelector('.ag-intent-composer [data-intent-files]')?.click();return}if(el.dataset.composerAction==='context-picker'){ui.inspectorKind='context';ui.inspectorOpen=true;render();return}if(el.dataset.composerAction==='capability-picker'){document.querySelector('.ag-intent-capabilities button')?.focus();toast('Choose a capability above');return}}
    if(el.dataset.vizAction==='inspect-node'){ui.inspectorOpen=true;ui.inspectorKind='context';render();return}
    if(el.dataset.humanNav){navigateHuman(el.dataset.humanNav);return}
    if(el.dataset.conversation){ui.followLatest=true;ui.forceFollowLatest=true;ui.messageScrollTop=0;state.activeConversationId=el.dataset.conversation;const conv=state.conversations.find(c=>c.id===el.dataset.conversation);if(conv?.missionId)ui.selectedMissionId=conv.missionId;state.activeDomain=conv?.missionId?'work':'chat';state.primaryMode=conv?.missionId?'work':'chat';ui.artifactOpen=false;saveState();render();return}
    if(el.dataset.mission){ui.selectedMissionId=el.dataset.mission;state.activeDomain='work';state.primaryMode='work';ui.artifactOpen=false;render();return}
    if(el.dataset.agent){ui.selectedAgentId=el.dataset.agent;ui.inspectorKind='agent';ui.inspectorOpen=true;render();return}
    if(el.dataset.connection){ui.selectedConnectionId=el.dataset.connection;ui.inspectorKind='connection';ui.inspectorOpen=true;render();return}
    if(el.dataset.artifact){ui.selectedArtifactId=el.dataset.artifact;ui.artifactOpen=true;render();return}
    if(el.dataset.artifactTab){ui.artifactTab=el.dataset.artifactTab;render();return}
    if(el.dataset.resolveNeed){const id=el.dataset.resolveNeed;state=resolveNeed(state,id);saveState();render();if(backendConnected)void syncBackend(apiClient.resolveNeed(id));return}
    if(el.dataset.upstreamApproval){
      if(!backendConnected){ui.controlError='Trust Gateway is unavailable. Decision remains pending.';render();toast('Backend connection required');return}
      const id=el.dataset.upstreamApproval,decision=el.dataset.upstreamDecision;
      ui.controlError='';render();
      void apiClient.decideUpstreamApproval(id,decision)
        .then(()=>apiClient.syncUpstreams())
        .then(payload=>{ui.controlError='';applyUpstreamPayload(payload);toast(`Trust Gateway approval ${decision==='approve'?'approved':'denied'}`)})
        .catch(error=>{console.warn('Trust Gateway decision failed',error?.code||error);ui.controlError='Trust Gateway could not confirm this decision. It remains pending.';render();toast('Trust Gateway decision failed')});
      return
    }
    if(el.dataset.resultKind){executePalette(el);return}
    if(el.dataset.approvalAction){
      if(el.dataset.approvalAction==='inspect'){ui.approvalEvidenceOpen=!ui.approvalEvidenceOpen;render();return}
      const approval=currentApproval(),approvalId=approval.id,key=`approval:${approvalId}`;
      if(!beginUiAction(key))return;
      const decision=el.dataset.approvalAction==='approve'?'approved':'rejected';
      if(!backendConnected){state=decideApproval(state,approvalId,decision,state.user.id);ui.approvalOpen=false;ui.approvalEvidenceOpen=false;saveState();toast(`Approval ${decision}`);endUiAction(key);return}
      void apiClient.decideApproval(approvalId,decision,state.user.id).then(payload=>{applyBackendPayload(payload);ui.approvalOpen=false;ui.approvalEvidenceOpen=false;toast(`Approval ${decision}`);endUiAction(key)}).catch(error=>{ui.controlError='Approval could not be confirmed. It remains pending.';toast('Approval failed');endUiAction(key);console.warn('Approval decision failed',error?.code||error)});
      return
    }
    if(el.dataset.action){if(el.dataset.action==='close-palette'&&event.target!==el)return;runAction(el.dataset.action,el);render()}
  });

  app.addEventListener('scroll',event=>{const list=event.target;if(!(list instanceof Element)||list.id!=='message-list')return;ui.messageScrollTop=list.scrollTop;ui.followLatest=(list.scrollHeight-list.clientHeight-list.scrollTop)<32},true);

  app.addEventListener('submit',event=>{if(event.target.matches('.ag-composer')){event.preventDefault();handleComposerSubmit(event.target);return}if(event.target.matches('.ag-intent-composer')){event.preventDefault();handleIntentSubmit(event.target)}});
  app.addEventListener('change',event=>{if(event.target.matches('[data-intent-files]')){ui.intentAttachments=[...event.target.files].slice(0,8).map(file=>({name:file.name,kind:file.type||'file'}));render()}});
  app.addEventListener('input',event=>{if(event.target.id==='palette-input'){ui.paletteQuery=event.target.value;ui.paletteIndex=0;render();return}if(event.target.dataset.replayAction==='scrub'){const cursor=Number(event.target.value);state.replay={...state.replay,cursor};saveState();if(backendConnected)void apiClient.replay({cursor});render()}});

  let resizeState=null;
  let spaceDragState=null;
  app.addEventListener('pointerdown',event=>{
    const spatialHandle=event.target.closest('[data-space-drag-handle]');
    if(spatialHandle&&!event.target.closest('button')){spaceDragState={surfaceId:spatialHandle.dataset.spaceDragHandle,pointerId:event.pointerId};spatialHandle.closest('.ag-space-surface')?.classList.add('is-dragging');spatialHandle.setPointerCapture?.(event.pointerId);return}
    const handle=event.target.closest('.ag-resize-handle');if(!handle)return;resizeState={startX:event.clientX,startWidth:ui.artifactWidth,total:window.innerWidth};handle.setPointerCapture?.(event.pointerId)
  });
  app.addEventListener('pointermove',event=>{
    if(spaceDragState){document.querySelectorAll('.ag-space-region.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));const region=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('.ag-space-region');region?.classList.add('is-drop-target');return}
    if(!resizeState)return;const delta=(resizeState.startX-event.clientX)/resizeState.total*100;ui.artifactWidth=Math.max(34,Math.min(56,resizeState.startWidth+delta));document.querySelector('.ag-app')?.style.setProperty('--artifact-width',`${ui.artifactWidth}%`);const h=document.querySelector('.ag-resize-handle');h?.setAttribute('aria-valuenow',String(Math.round(ui.artifactWidth)))
  });
  app.addEventListener('pointerup',event=>{
    if(spaceDragState){const region=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('.ag-space-region');document.querySelectorAll('.ag-space-region.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));document.querySelectorAll('.ag-space-surface.is-dragging').forEach(el=>el.classList.remove('is-dragging'));const surfaceId=spaceDragState.surfaceId;spaceDragState=null;if(region?.dataset.region)updateSpace({type:'surface.move',surfaceId,regionId:region.dataset.region});return}
    resizeState=null
  });

  function trapFocus(container,event){const nodes=[...container.querySelectorAll('input,button,[tabindex]:not([tabindex="-1"])')].filter(n=>!n.disabled);if(!nodes.length)return;const i=nodes.indexOf(document.activeElement);event.preventDefault();const next=event.shiftKey?(i<=0?nodes.length-1:i-1):(i<0||i===nodes.length-1?0:i+1);nodes[next].focus()}

  document.addEventListener('keydown',event=>{
    const mod=event.metaKey||event.ctrlKey;
    if(mod&&event.key.toLowerCase()==='k'){event.preventDefault();ui.paletteOpen=true;ui.paletteQuery='';render();return}
    if(mod&&event.key.toLowerCase()==='n'){event.preventDefault();runAction('new-chat');render();return}
    if(event.key==='Escape'){
      if(ui.paletteOpen){ui.paletteOpen=false;render();return}
      if(ui.approvalOpen){ui.approvalOpen=false;ui.approvalEvidenceOpen=false;render();return}
      if(ui.inspectorOpen){ui.inspectorOpen=false;render();return}
      if(ui.artifactOpen&&ui.device==='mobile'){ui.artifactOpen=false;render();return}
    }
    if(ui.paletteOpen&&event.key==='Tab'){const c=document.querySelector('.ag-command-palette');if(c)trapFocus(c,event);return}
    if(ui.approvalOpen&&event.key==='Tab'){const c=document.querySelector('.ag-approval-shell');if(c)trapFocus(c,event);return}
    if(ui.paletteOpen&&['ArrowDown','ArrowUp','Enter'].includes(event.key)){const results=[...document.querySelectorAll('.ag-command-result')];if(event.key==='ArrowDown'){event.preventDefault();ui.paletteIndex=Math.min(results.length-1,ui.paletteIndex+1);render()}if(event.key==='ArrowUp'){event.preventDefault();ui.paletteIndex=Math.max(0,ui.paletteIndex-1);render()}if(event.key==='Enter'&&results[ui.paletteIndex]){event.preventDefault();results[ui.paletteIndex].click()}return}
    if(event.target?.matches('[data-viz-action]')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();return}
    if(event.target?.matches('.ag-resize-handle')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();ui.artifactWidth=Math.max(34,Math.min(56,ui.artifactWidth+(event.key==='ArrowLeft'?1:-1)));render()}
  });

  window.addEventListener('popstate',()=>{const r=routeFromLocation(window.location);if(r.kind==='mode'){state.primaryMode=r.mode;state.activeDomain=r.domain}else{state.activeDomain=r.domain;if(['chat','work'].includes(r.domain))state.primaryMode=r.domain}if(r.kind==='object')selectObject(r.type,r.id);render()});
  window.addEventListener('resize',()=>{const d=detectDevice();if(d!==ui.device){ui.device=d;render()}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&liveTimer){stopRuntimeTimer()}});

  try{document.documentElement.dataset.theme=localStorage.getItem('aftergraph-theme')||'dark'}catch{document.documentElement.dataset.theme='dark'}
  if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});
  renderScheduler=createRenderScheduler({
    root:app,
    renderView:()=>render(),
    patchers:{
      'mission.progress':()=>patchRuntimeUI(),
      'mission.runtime-status':()=>patchRuntimeUI(),
      'attention.runtime':()=>patchRuntimeUI(),
      'agents.presence':()=>patchRuntimeUI(),
      'replay.cursor':()=>patchRuntimeUI(),
      'system.upstream-health':()=>patchRuntimeUI(),
    },
    getState:()=>state,
    getUIState:()=>ui,
    metrics:qaMetrics,
  });
  renderScheduler.reset(state,backendRuntimes);
  if(qaEnabled)globalThis.__aftergraphQA={
    metrics:qaMetrics,
    snapshot:()=>({metrics:{...qaMetrics},activeDomain:state.activeDomain,primaryMode:state.primaryMode,domCount:document.querySelectorAll('*').length}),
    progressTick:(value)=>{
      const mission=state.activeDomain==='chat'?chatMission():currentMission();
      if(!mission)return false;
      const progress=Math.max(0,Math.min(100,Number(value)));
      const next={...state,missions:state.missions.map(item=>item.id===mission.id?{...item,progress}:item)};
      state=next;saveState();renderScheduler.update(next,backendRuntimes);return true;
    },
    openDomain:(domain)=>{navigateDomain(domain);return state.activeDomain},
    setFederationSnapshot:(snapshot)=>{federationSnapshot=Object.freeze({...snapshot});render();return federationSnapshot.phase},
    injectRemoteApproval:(approval)=>{
      const current=state.upstreams?.trustGateway?.approvals||[];
      state={...state,upstreams:{...state.upstreams,trustGateway:{...state.upstreams?.trustGateway,approvals:[...current.filter(item=>item.id!==approval.id),approval]}}};
      saveState();render();return true;
    },
  };
  render();
  void connectBackend();
  window.addEventListener('beforeunload',()=>{backendSession?.stop?.();stopReplay()},{once:true});

  // Pointer-reactive depth is intentionally decorative. State and controls never depend on it.
  let agPointerFrame=0;
  app.addEventListener('pointermove',event=>{
    if(prefersReducedMotion()) return;
    if(agPointerFrame) return;
    const x=event.clientX,y=event.clientY;
    agPointerFrame=requestAnimationFrame(()=>{
      agPointerFrame=0;
      const root=document.querySelector('.ag-app');
      if(!root) return;
      root.style.setProperty('--pointer-x',`${Math.round(x/window.innerWidth*100)}%`);
      root.style.setProperty('--pointer-y',`${Math.round(y/window.innerHeight*100)}%`);
    });
  });
  return ()=>{try{backendSession?.stop?.()}catch{};try{stopReplay()}catch{};try{stopRuntimeTimer()}catch{}};
}
