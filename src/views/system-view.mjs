import { AGUpstreamServiceRow, AGEventRow } from '../../packages/ui/index.mjs';
import { escapeHtml, compactMoney } from '../ui-helpers.mjs';

const SERVICE_LABELS=Object.freeze({
  trustGateway:'Trust Gateway',works:'WORKS',aie:'AIE',workIntelligence:'Work Intelligence',governance:'Governance',research:'ISR Research',
});

const phaseLabel=phase=>({current:'Current',resyncing:'Resyncing',stale:'Stale',offline:'Unavailable',unavailable:'Unavailable'}[phase]||'Local');

function serviceState(service={}){return !service.configured?'unconfigured':service.online?'online':'offline'}
function serviceDetails(id,label,service={}){
  const short=String(service.headSha||service.sha||'').slice(0,8);
  return `<details class="ag-source-truth-details" data-upstream-details="${escapeHtml(id)}"><summary><span>${escapeHtml(label)}</span><span class="ag-service-state" data-state="${escapeHtml(serviceState(service))}">${escapeHtml(serviceState(service))}</span></summary>${AGUpstreamServiceRow({id,label,service})}<dl class="ag-source-truth-meta"><div><dt>Owner</dt><dd>${escapeHtml(service.role||'not synchronized')}</dd></div>${service.repo?`<div><dt>Repository</dt><dd>${escapeHtml(service.repo)}</dd></div>`:''}${short?`<div><dt>Exact head</dt><dd><code>${escapeHtml(short)}</code></dd></div>`:''}</dl></details>`;
}

export function renderSystemSurface({services={},telemetry={},syncedAt='',backendPhase='offline',identity={},events=[]}={}){
  const status=phaseLabel(backendPhase);
  const serviceRows=Object.entries(SERVICE_LABELS).map(([id,label])=>serviceDetails(id,label,services[id]||{configured:false,online:false,role:'not synchronized'})).join('');
  return `<main id="main-content" class="ag-domain-page ag-calm-system" data-domain-surface="system" data-system-state="${escapeHtml(backendPhase)}">
    <header class="ag-domain-header ag-product-header"><div><small>SYSTEM</small><h1>System</h1><p>Runtime health and source truth, with protocol detail available when you need it.</p></div><span class="ag-freshness-pill" data-state="${escapeHtml(backendPhase)}">${escapeHtml(status)}</span></header>
    <div class="ag-system-product-grid">
      <section class="ag-domain-section ag-system-health"><div class="ag-section-heading"><span>Runtime</span><small>${escapeHtml(telemetry.chain||'unknown')}</small></div><dl class="ag-health-metrics"><div><dt>Status</dt><dd>${escapeHtml(telemetry.runtime||status)}</dd></div><div><dt>Latency</dt><dd>${Number(telemetry.latency||0)} ms</dd></div><div><dt>Active runs</dt><dd>${Number(telemetry.activeRuns||0)}</dd></div><div><dt>Evidence</dt><dd>${Number(telemetry.evidence||0)}</dd></div><div><dt>Cost</dt><dd>${compactMoney(Number(telemetry.cost||0))}</dd></div></dl></section>
      <section class="ag-domain-section ag-system-sources"><div class="ag-section-heading"><span>Source truth</span><small>${escapeHtml(syncedAt||'not synchronized')}</small></div><div class="ag-source-truth-stack">${serviceRows}</div><button class="ag-button" data-action="sync-upstreams" ${backendPhase==='current'?'':'disabled aria-disabled="true"'}>Synchronize source truth</button></section>
      <aside class="ag-system-secondary"><section class="ag-domain-section"><div class="ag-section-heading"><span>Identity</span><small>Current actor</small></div><div class="ag-system-identity"><span aria-hidden="true">${escapeHtml(String(identity.name||'A').slice(0,2).toUpperCase())}</span><strong>${escapeHtml(identity.name||'Workspace user')}</strong><small>${escapeHtml(identity.role||'member')} · ${escapeHtml(identity.capabilityLabel||'scoped capabilities')}</small></div></section><section class="ag-domain-section"><div class="ag-section-heading"><span>Recent system events</span><small>${events.length}</small></div><div class="ag-system-event-list">${events.slice(0,6).map(event=>AGEventRow({event})).join('')||'<p class="ag-domain-empty">No recent system events.</p>'}</div></section><button class="ag-button quiet" data-action="reset-demo">Reset workspace state</button></aside>
    </div>
  </main>`;
}

export function renderSystemView(context){return context.renderSystem()}
