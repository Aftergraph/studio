import test from 'node:test';
import assert from 'node:assert/strict';
import { TOKENS, MOTION_TOKENS } from '../packages/tokens/index.mjs';
import { iconSpec } from '../packages/icons/index.mjs';
import { motionFor, transitionDescriptor } from '../packages/motion/index.mjs';
import { composeLivingLayout, attentionGravity } from '../packages/runtime-ui/index.mjs';
import { COMPONENTS, AGSurface, AGTrajectory, AGArtifact, AGApproval, AGNeedYou, AGComposer, AGAgentPresence, AGButton, AGProgress, AGNotice, AGMetric, AGTabs } from '../packages/ui/index.mjs';

test('token kernel exposes semantic color, density and motion groups', () => {
  assert.ok(TOKENS.color.canvas);
  assert.ok(TOKENS.color.attention);
  assert.ok(TOKENS.density.comfortable);
  assert.equal(MOTION_TOKENS.micro.max, 150);
  assert.equal(MOTION_TOKENS.surface.min, 260);
});

test('icon vocabulary is Aftergraph-owned and semantic', () => {
  assert.equal(iconSpec('trajectory').name, 'trajectory');
  assert.equal(iconSpec('approval').name, 'approval');
  assert.equal(iconSpec('artifact').name, 'artifact');
});

test('motion semantics collapse essential duration under reduced motion', () => {
  assert.equal(motionFor('surface.expand', { reduced:true }).duration, 0);
  assert.ok(motionFor('surface.expand', { reduced:false }).duration >= 260);
  assert.equal(transitionDescriptor('artifact','split').layoutId, 'artifact');
});

test('living runtime opens artifacts as split on desktop and fullscreen on mobile', () => {
  assert.equal(composeLivingLayout({ device:'desktop', artifactOpen:true }).artifact.presentation, 'split');
  assert.equal(composeLivingLayout({ device:'mobile', artifactOpen:true }).artifact.presentation, 'fullscreen');
});

test('attention gravity focuses destructive approval and suppresses competing surfaces', () => {
  const gravity = attentionGravity({ risk:'destructive', approvalPending:true, takeover:false });
  assert.equal(gravity.mode, 'approval-focus');
  const layout = composeLivingLayout({ risk:'destructive', approvalPending:true, artifactOpen:true, inspectorOpen:true });
  assert.equal(layout.control.presentation, 'focus');
  assert.equal(layout.artifact.presentation, 'background');
  assert.equal(layout.inspector.presentation, 'hidden');
});

test('takeover creates explicit ownership mode without destructive focus', () => {
  const gravity = attentionGravity({ risk:'low', approvalPending:false, takeover:true });
  assert.equal(gravity.mode, 'takeover');
  const layout = composeLivingLayout({ takeover:true, device:'desktop' });
  assert.equal(layout.workspace.mode, 'takeover');
});


test('inhouse component registry covers semantic product and base primitives', () => {
  assert.ok(COMPONENTS.length >= 15);
  for (const name of ['AGComposer','AGSurface','AGArtifact','AGApproval','AGTrajectory','AGNeedYou','AGButton','AGProgress','AGNotice','AGMetric','AGTabs']) assert.ok(COMPONENTS.includes(name));
  assert.match(AGButton({label:'Run',action:'run-live',tone:'primary'}), /data-ag-component="button"/);
  assert.match(AGProgress({value:68,label:'Progress'}), /aria-valuenow="68"/);
  assert.match(AGNotice({title:'Verified',detail:'Evidence sealed',tone:'success'}), /data-tone="success"/);
  assert.match(AGMetric({value:'94%',label:'Retention',delta:'+3%'}), /Retention/);
  assert.match(AGTabs({items:[{id:'a',label:'A'}],active:'a'}), /role="tablist"/);
});

test('semantic components expose stable Aftergraph hooks and accessible roles', () => {
  const surface = AGSurface({ id:'s1', kind:'conversation', content:'hello' });
  const trajectory = AGTrajectory({ steps:[{label:'Research',state:'running'}], compact:false });
  const artifact = AGArtifact({ id:'a1', title:'Report', state:'draft', content:'Body' });
  const approval = AGApproval({ id:'p1', title:'Deploy', risk:'destructive', state:'pending', why:'Verified', impact:'Restart', rollback:'Rollback', authority:'production.deploy', evidence:['e1'] });
  const need = AGNeedYou({ id:'n1', type:'approval', title:'Needs approval', severity:'high', action:'show-control' });
  const composer = AGComposer({ mode:'Ask' });
  const agent = AGAgentPresence({ name:'Friday', state:'running' });
  assert.match(surface, /data-ag-component="surface"/);
  assert.match(trajectory, /data-ag-component="trajectory"/);
  assert.match(artifact, /data-ag-component="artifact"/);
  assert.match(approval, /role="dialog"/);
  assert.match(approval, /data-risk="destructive"/);
  assert.match(need, /data-ag-component="need-you"/);
  assert.match(need, /data-action="show-control"/);
  assert.match(composer, /aria-label="Composer"/);
  assert.match(agent, /aria-live="polite"/);
});

test('completion wave adds first-party interactive semantic components', async () => {
  const ui = await import('../packages/ui/index.mjs');
  for (const name of ['AGActionDock','AGAgentCluster','AGOutcomeReceipt','AGCommandPalette']) assert.ok(ui.COMPONENTS.includes(name));
  assert.match(ui.AGActionDock({actions:[{label:'Deep research',action:'delegate',icon:'sparkle'}]}), /data-ag-component="action-dock"/);
  assert.match(ui.AGAgentCluster({agents:[{name:'Data Analyst',state:'running'},{name:'Research',state:'idle'}]}), /data-ag-component="agent-cluster"/);
  assert.match(ui.AGOutcomeReceipt({title:'Verified outcome',detail:'Evidence sealed',evidenceCount:4,action:'open-artifact'}), /data-ag-component="outcome-receipt"/);
  assert.match(ui.AGCommandPalette({query:'run',results:[{id:'run-live',title:'Run live',subtitle:'Start mission',icon:'play'}],activeIndex:0}), /data-ag-component="command-palette"/);
});

test('pulse rail is a first-party progressive-disclosure system surface', async () => {
  const ui = await import('../packages/ui/index.mjs');
  assert.ok(ui.COMPONENTS.includes('AGPulseRail'));
  const html = ui.AGPulseRail({
    agents:[{name:'Data Analyst',state:'running',task:'Analyzing Q4'}],
    attentionCount:3,
    mission:{title:'Q4 Business Analysis',progress:72,state:'running'},
    expanded:false,
  });
  assert.match(html,/data-ag-component="pulse-rail"/);
  assert.match(html,/aria-expanded="false"/);
  assert.match(html,/data-action="toggle-pulse"/);
  assert.match(html,/Q4 Business Analysis/);
});
