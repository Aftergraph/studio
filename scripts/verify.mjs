import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSourceTruthBundle } from '../src/integrations/source-truth.mjs';
import { UPSTREAM_REVISIONS } from '../src/integrations/upstream-hub.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const upstreamRoot=path.resolve(root,'../upstreams');
function run(name,cmd,args,cwd=root){const r=spawnSync(cmd,args,{cwd,encoding:'utf8'});if(r.status!==0){console.error(`FAIL ${name}\n${r.stdout}\n${r.stderr}`);process.exitCode=1}else console.log(`PASS ${name}`)}
function check(name,ok){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)process.exitCode=1}
const tests=readdirSync(path.join(root,'tests')).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>`tests/${x}`);
run('node tests',process.execPath,['--test','--test-concurrency=1',...tests]);
const syntax=[
 'src/main.mjs','src/live-runtime.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/spatial-lifecycle.mjs','src/replay.mjs','src/server-store.mjs','src/server-runtime-hub.mjs','src/backend-reconciliation.mjs','server.mjs',
 'src/integrations/http-json.mjs','src/integrations/trust-gateway.mjs','src/integrations/works.mjs','src/integrations/aie.mjs','src/integrations/work-intelligence.mjs','src/integrations/governance.mjs','src/integrations/upstream-hub.mjs','src/integrations/source-truth.mjs',
 'src/federation/integration-manifest.mjs','src/federation/integration-registry.mjs','src/federation/object-envelope.mjs','src/federation/object-graph.mjs','src/federation/authority-graph.mjs','src/federation/evidence-graph.mjs','src/federation/capability-registry.mjs','src/federation/surface-registry.mjs','src/federation/reconciler.mjs','src/federation/federation-kernel.mjs','src/federation/universal-space.mjs','src/composer/universal-resolver.mjs','src/composer/resolver.mjs','src/search/federated-index.mjs','src/integrations/isr.mjs','src/research/projection.mjs','src/research/promotion-proposal.mjs','src/now/projection.mjs','src/integrations/skills-vault.mjs','src/integrations/avc.mjs','src/runtime/federation-session.mjs','src/views/research-view.mjs','src/views/capabilities-view.mjs','server/federation-routes.mjs','server/search-routes.mjs','server/research-routes.mjs','server/now-routes.mjs',
 'src/federation/live/event-envelope.mjs','src/federation/live/event-normalizer.mjs','src/federation/live/live-stream-adapter.mjs','src/federation/live/health-monitor.mjs','src/federation/live/resync-protocol.mjs',
 'src/search/context-resolver.mjs',
 'src/runtime/capability-runtime.mjs',
 'packages/ui/index.mjs','packages/motion/index.mjs','packages/tokens/index.mjs','packages/brand/index.mjs','packages/brand/react.mjs','packages/icons/index.mjs','packages/runtime-ui/index.mjs','packages/spatial/index.mjs','packages/presence/index.mjs','packages/interaction/index.mjs','packages/visualization/index.mjs','packages/composer/index.mjs'
];
for(const file of syntax)run(`syntax ${file}`,process.execPath,['--check',file]);
run('platform source contracts',process.execPath,['scripts/platform_verify.mjs']);

const upstreamJson=rel=>JSON.parse(readFileSync(path.join(upstreamRoot,rel),'utf8'));
const sourceTruth=validateSourceTruthBundle({
  manifest:upstreamJson('UPSTREAM-MANIFEST.json'),
  missionState:upstreamJson('contracts/governance/mission-state-1.0.json'),
  policyToken:upstreamJson('contracts/governance/policy.token.schema.json'),
  workIntelligenceBoundary:upstreamJson('contracts/work-intelligence/work-intelligence-boundary-1.0.json'),
  revisions:UPSTREAM_REVISIONS,
});
check('exact-head polyrepo source truth',sourceTruth.ok);
if(!sourceTruth.ok) for(const error of sourceTruth.errors) console.error(`  ${error}`);

const read=f=>readFileSync(path.join(root,f),'utf8');
const styles=['tokens','reset','shell','components','views','motion','responsive'].map(l=>read(`styles/${l}.css`)).join('\n');
const serverDir=readdirSync(path.join(root,'server')).filter(x=>x.endsWith('.mjs')).map(x=>read(`server/${x}`)).join('\n');
const appDir=readdirSync(path.join(root,'src/app')).filter(x=>x.endsWith('.mjs')).map(x=>read(`src/app/${x}`)).join('\n');
const ui=readdirSync(path.join(root,'packages/ui'),{recursive:true}).filter(x=>x.endsWith('.mjs')).map(x=>read(`packages/ui/${x}`)).join('\n');
const html=read('index.html'), main=read('src/main.mjs')+'\n'+appDir, shell=read('src/workspace-shell.mjs'), domain=read('src/domain.mjs'), spatial=read('packages/spatial/index.mjs'), presence=read('packages/presence/index.mjs'), viz=read('packages/visualization/index.mjs'), composer=read('packages/composer/index.mjs'), interaction=read('packages/interaction/index.mjs'), motion=read('packages/motion/index.mjs'), server=read('server.mjs')+'\n'+serverDir, sw=read('sw.js'), api=read('src/api-client.mjs'), replay=read('src/replay.mjs');
const files=[html,styles,main,ui,spatial,presence,viz,composer,interaction,motion,server].join('\n');
check('V5/V6 identity',html.includes('Aftergraph Workspace')||html.includes('Aftergraph V5')||html.includes('Aftergraph V6')||html.includes('Operating Environment'));
check('Seven design layers',['tokens','reset','shell','components','views','motion','responsive'].every(l=>html.includes(`/styles/${l}.css`)));
check('Chat/Work/Space human modes',shell.includes("id:'chat'")&&shell.includes("id:'work'")&&shell.includes("id:'space'"));
check('canonical domains stay canonical',domain.match(/id:'/g)?.length>=9);
check('all ten first-party packages present and wired',['ui','motion','tokens','icons','runtime-ui','spatial','presence','interaction','visualization','composer'].every(name=>existsSync(path.join(root,`packages/${name}/index.mjs`)))&&['spatial','presence','interaction','visualization','composer'].every(name=>main.includes(`packages/${name}/index.mjs`))&&ui.includes('../icons/index.mjs')&&motion.includes('../tokens/index.mjs'));
check('Spatial kernel',spatial.includes('AGSpace')&&spatial.includes('AGRegion')&&spatial.includes('surface.dock')&&spatial.includes('semanticZoomLevels'));
check('Semantic zoom',spatial.includes('AGSemanticZoom')&&main.includes('zoom-in')&&main.includes('zoom-out'));
check('Presence kernel',presence.includes('AGPresenceRail')&&presence.includes('derivePresence')&&main.includes('followedAgentId'));
check('Visualization kernel',viz.includes('AGTrajectoryGraph')&&viz.includes('AGEvidenceGraph')&&viz.includes('AGReplayTimeline'));
check('Multimodal intent composer',composer.includes('AGIntentComposer')&&composer.includes('Research')&&composer.includes('Delegate'));
check('Replay time layer',replay.includes('buildReplayFrames')&&api.includes('/api/v1/replay')&&server.includes('/api/v1/replay'));
check('Durable spatial server state',api.includes('/api/v1/spaces')&&server.includes('/api/v1/spaces'));
check('Lifecycle-stable spatial motion',main.includes('diffSurfaceEntries')||styles.includes('ag-space-surface'));
check('V4 living interaction preserved',main.includes('morphSurface')||main.includes('toggle-immersive')||styles.includes('.ag-app.is-immersive')||styles.includes('.ag-space-stage'));
check('Reduced motion parity',styles.includes('prefers-reduced-motion')&&motion.includes('prefersReducedMotion'));
check('PWA caches runtime',sw.includes('aftergraph-workspace')&&sw.includes('/styles/tokens.css')&&sw.includes('/packages/spatial/index.mjs')&&sw.includes('/packages/composer/index.mjs'));
check('PWA excludes live APIs',sw.includes("url.pathname.startsWith('/api/')"));
check('SSE + durable backend',server.includes('text/event-stream')&&(server.includes('WorkspaceStateStore')||server.includes('stateStore'))&&(server.includes('MissionRuntimeHub')||server.includes('runtimeHub')));
check('Polyrepo backend bridge',server.includes('/api/v1/upstreams/sync')&&server.includes('createUpstreamHub')&&api.includes('syncUpstreams'));
check('Source-truth UX',main.includes('AGUpstreamServiceRow')&&main.includes('AGSourceTruthBadge')&&main.includes('sync-upstreams'));
check('WI remains proposal-only',main.includes('AGDetectionProposalRow')&&ui.includes('Explicit promotion required'));
check('CSP keeps vetted host',server.includes("script-src 'self'")&&server.includes("object-src 'none'"));
check('No obvious live secrets',!/(sk-[A-Za-z0-9]{20,}|dgr_live_|ghp_[A-Za-z0-9]{20,})/.test(files));
if(!process.exitCode)console.log('ALL WORKSPACE V5 VERIFY CHECKS PASS');
