import { escapeHtml } from '../ui-helpers.mjs';

function capabilityList(value) {
  return Array.isArray(value) ? value : [];
}

// ponytail: typed capabilities view with kind categorization and explicit discovery!=grant indicators
export function renderCapabilitiesSurface(snapshot = {}) {
  const capabilities = capabilityList(snapshot.capabilities);
  const activeKind = snapshot.filterKind || 'all';

  const kinds = ['all', 'skill', 'agent', 'tool', 'model', 'provider'];
  const kindFilterButtons = kinds.map(k =>
    `<button class="ag-filter-chip ${k === activeKind ? 'is-active' : ''}" data-filter-kind="${k}">${k.toUpperCase()}</button>`
  ).join('');

  const filtered = activeKind === 'all'
    ? capabilities
    : capabilities.filter(c => (c.kind || 'skill') === activeKind);

  const cards = filtered.map(cap => {
    const isGranted = Boolean(cap.granted);
    const kind = cap.kind || 'skill';
    const risk = cap.risk || 'low';
    return `
      <article class="ag-federated-card" data-capability-id="${escapeHtml(cap.id)}" data-kind="${escapeHtml(kind)}">
        <header>
          <div class="cap-meta">
            <span class="cap-kind-badge">${escapeHtml(kind.toUpperCase())}</span>
            <small>${escapeHtml(cap.sourceIntegration || cap.source || 'capability provider')}</small>
          </div>
          <span class="status-pill ${isGranted ? 'current' : 'stale'}">${isGranted ? 'Authorized' : 'Not granted'}</span>
        </header>
        <h2>${escapeHtml(cap.id)}</h2>
        <p>${escapeHtml(cap.description || 'Discoverable capability')}</p>
        <div class="cap-footer">
          <small class="risk-badge risk-${escapeHtml(risk)}">Risk: ${escapeHtml(risk)}</small>
          <button class="ag-button ${isGranted ? 'primary' : 'secondary'}" data-action="${isGranted ? 'execute' : 'request-access'}" data-cap-id="${escapeHtml(cap.id)}">
            ${isGranted ? 'Execute' : 'Request Access'}
          </button>
        </div>
        <p class="ag-federated-note">Discovery only. Authority is resolved by the canonical owner when an action is requested.</p>
      </article>
    `;
  }).join('');

  return `
    <main id="main-content" class="ag-domain-page ag-federated-domain" data-domain-surface="capabilities">
      <header class="ag-domain-header">
        <div>
          <small>CAPABILITIES RUNTIME</small>
          <h1>Capabilities</h1>
          <p>Discover skills, agents, tools, models and providers without confusing availability with permission.</p>
        </div>
        <span>${escapeHtml(snapshot.phase || 'idle')}</span>
      </header>
      <section class="ag-domain-section">
        <div class="ag-filter-bar">
          ${kindFilterButtons}
        </div>
        <div class="ag-section-heading">
          <span>Registered capabilities</span>
          <small>${filtered.length} shown (${capabilities.length} total discovered)</small>
        </div>
        <div class="ag-federated-grid">
          ${cards || '<p class="ag-domain-empty">No federated capabilities match the current filter.</p>'}
        </div>
      </section>
    </main>
  `;
}
