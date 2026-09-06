import { createIntegrationRegistry } from './integration-registry.mjs';
import { createObjectGraph } from './object-graph.mjs';
import { createEvidenceGraph } from './evidence-graph.mjs';
import { createCapabilityRegistry } from './capability-registry.mjs';
import { createSurfaceRegistry } from './surface-registry.mjs';
import { createFederationReconciler } from './reconciler.mjs';
import { executeConsequentialWrite } from './authority-graph.mjs';
import { createLiveHealthMonitor } from './live/health-monitor.mjs';
import { createAuthoritativeResyncProtocol } from './live/resync-protocol.mjs';
import { createContextResolver } from '../search/context-resolver.mjs';
import { createCapabilityRuntime } from '../runtime/capability-runtime.mjs';

// ponytail: unified federation kernel with live federation, universal context, and governed capability runtime
export function createFederationKernel({
  adapters = {},
  resolveGrant = () => false,
  getHumanState = () => null,
  onProjection = () => {},
  pinnedRevisions = {},
  fetchSnapshot = async () => ({})
} = {}) {
  const registry = createIntegrationRegistry();
  const objects = createObjectGraph();
  const evidence = createEvidenceGraph();
  const capabilities = createCapabilityRegistry({ resolveGrant });
  const surfaces = createSurfaceRegistry();
  const reconciler = createFederationReconciler({ registry, objects, evidence, capabilities, getHumanState, onProjection });
  const healthMonitor = createLiveHealthMonitor({ registry, pinnedRevisions });
  const resyncProtocol = createAuthoritativeResyncProtocol({ registry, objects, evidence, getHumanState, fetchSnapshot });
  const contextResolver = createContextResolver({ objects, evidence, registry });
  const capabilityRuntime = createCapabilityRuntime({ registry, evidence });

  return Object.freeze({
    registerIntegration: m => registry.register(m),
    setIntegrationState: (id, state, detail) => registry.setState(id, state, detail),
    integration: id => registry.get(id),
    integrations: () => registry.list(),
    canRead: id => registry.canRead(id),
    canWrite: id => registry.canWrite(id),
    reconcile: (id, p) => reconciler.reconcile(id, p),
    object: id => objects.get(id),
    objects: () => objects.list(),
    neighbors: (id, type) => objects.neighbors(id, type),
    evidence: id => evidence.getEvidence(id),
    evidenceFor: id => evidence.evidenceFor(id),
    registerSurface: s => surfaces.register(s),
    surface: id => surfaces.get(id),
    surfacesForObject: type => surfaces.forObjectType(type),
    discoverCapabilities: q => capabilities.discover(q),
    grantStatus: (subject, id) => capabilities.grantStatus(subject, id),
    executeCapability: args => capabilityRuntime.executeCapability(args),
    write: args => executeConsequentialWrite({ ...args, registry, adapters }),
    liveHealth: id => healthMonitor.getHealth(id),
    recordHeartbeat: (id, data) => healthMonitor.recordHeartbeat(id, data),
    resync: id => resyncProtocol.resyncEngine(id),
    handleLiveEvent: env => resyncProtocol.handleEvent(env),
    resolveContext: args => contextResolver.resolveContext(args),
    _registries: Object.freeze({ registry, objects, evidence, capabilities, surfaces, healthMonitor, resyncProtocol, contextResolver, capabilityRuntime })
  });
}
