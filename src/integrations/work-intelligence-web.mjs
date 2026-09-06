import { validateIntegrationManifest } from '../federation/integration-manifest.mjs';
const SURFACES=Object.freeze([
  Object.freeze({id:'drive',label:'Drive',mode:'live',canonicalOwner:'work-intelligence'}),
  Object.freeze({id:'gmail',label:'Gmail',mode:'live',canonicalOwner:'work-intelligence'}),
  Object.freeze({id:'calendar',label:'Calendar',mode:'live',canonicalOwner:'work-intelligence'}),
  Object.freeze({id:'docs',label:'Docs',mode:'live',canonicalOwner:'work-intelligence'}),
  Object.freeze({id:'sheets',label:'Sheets',mode:'live',canonicalOwner:'work-intelligence'}),
  Object.freeze({id:'keep',label:'Keep',mode:'preview-only',canonicalOwner:null}),
]);
export function createWorkIntelligenceWebManifest({repositoryRevision}={}){if(!repositoryRevision)throw new TypeError('repositoryRevision required');return validateIntegrationManifest({schema:'aftergraph.integration/v1',id:'work-intelligence-web',repository:'Aftergraph/work-intelligence-web',integrationVersion:'1.0.0',repositoryRevision,roles:['presentation','connect-surfaces','bff'],objects:[],relations:[],capabilities:['workspace.connect','workspace.inspect'],surfaces:SURFACES.map(x=>x.id),events:[],reads:['same-origin-projection'],writes:[],authority:[],evidence:[],health:{kind:'presentation'},degradedBehavior:{reads:'stale',writes:'block'},compatibility:{mode:'exact-or-declared',supported:['1.x']}})}
export function donatedConnectSurfaces(){return SURFACES}
export function projectConnectState(input={}){const backend=input.backend==='current'?'current':input.backend==='stale'?'stale':'unavailable';const healthy=backend==='current';const providers=(input.providers??[]).map(p=>Object.freeze({id:String(p.id),connected:healthy?Boolean(p.connected):false,status:healthy?(p.connected?'connected':'disconnected'):'unavailable'}));const review=input.review?Object.freeze({status:input.review.status??'unknown',executionStatus:'not-executed',publicationStatus:'not-published'}):null;return Object.freeze({mode:healthy?'live':'degraded',backend,fixturesEnabled:false,providers:Object.freeze(providers),review})}
