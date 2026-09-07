// ponytail: frozen pure functions — no state, no deps, no runtime cost beyond string concat
const e = encodeURIComponent;

export const healthz = () => '/healthz';
export const state = () => '/api/v1/state';
export const needs = () => '/api/v1/needs';
export const missions = () => '/api/v1/missions';
export const agents = () => '/api/v1/agents';
export const artifacts = () => '/api/v1/artifacts';
export const connections = () => '/api/v1/connections';
export const spaces = () => '/api/v1/spaces';
export const system = () => '/api/v1/system';
export const upstreams = () => '/api/v1/upstreams';
export const upstreamsSync = () => '/api/v1/upstreams/sync';
export const upstreamApprovalDecision = id => `/api/v1/upstreams/trust-gateway/approvals/${e(id)}/decision`;
export const upstreamWorkControl = id => `/api/v1/upstreams/works/${e(id)}/control`;
export const workIntelligenceReview = id => `/api/v1/upstreams/work-intelligence/${e(id)}/review`;
export const workIntelligencePromote = id => `/api/v1/upstreams/work-intelligence/${e(id)}/promote`;
export const aieTaskCancel = id => `/api/v1/upstreams/aie/tasks/${e(id)}/cancel`;
export const aieMessages = () => '/api/v1/upstreams/aie/messages';
export const conversations = () => '/api/v1/conversations';
export const need = id => `/api/v1/needs/${e(id)}`;
export const context = conversationId => `/api/v1/context?conversationId=${e(conversationId)}`;
export const artifact = id => `/api/v1/artifacts/${e(id)}`;
export const conversationMessages = id => `/api/v1/conversations/${e(id)}/messages`;
export const approvalDecision = id => `/api/v1/approvals/${e(id)}/decision`;
export const missionControl = id => `/api/v1/missions/${e(id)}/control`;
export const missionRuntime = id => `/api/v1/missions/${e(id)}/runtime`;
export const memory = id => `/api/v1/memory/${e(id)}`;
export const memoryPromote = id => `/api/v1/memory/${e(id)}/promote`;
export const authoritativeMemory = () => '/api/v1/memory/authoritative';
export const space = id => `/api/v1/spaces/${e(id)}`;
export const replay = () => '/api/v1/replay';
export const reset = () => '/api/v1/reset';
export const autonomyKillRead = scope => `/api/v1/autonomy/kill?scope=${e(scope)}`;
export const autonomyKillEngage = () => '/api/v1/autonomy/kill';
export const autonomyKillRelease = () => '/api/v1/autonomy/kill/release';
export const syncEventsSubmit = () => '/api/v1/sync/events';
export const syncEventsRead = () => '/api/v1/sync/events';
export const events = () => '/api/v1/events';

// federation / browser-client routes
export const federationIntegrations = () => '/api/v1/federation/integrations';
export const federationObjects = () => '/api/v1/federation/objects';
export const federationObject = id => `/api/v1/federation/objects/${e(id)}`;
export const federationSearch = (q, { tenantId = null } = {}) => {
  const p = new URLSearchParams({ q: String(q ?? '') });
  if (tenantId) p.set('tenantId', tenantId);
  return `/api/v1/federation/search?${p}`;
};
export const federationNow = () => '/api/v1/federation/now';
export const federationCapabilities = (q = '') => `/api/v1/federation/capabilities?q=${e(q)}`;
