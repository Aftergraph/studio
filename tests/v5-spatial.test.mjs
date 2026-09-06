import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIMARY_MODES } from '../src/workspace-shell.mjs';
import { routeFromLocation } from '../src/router.mjs';
import { createSpatialState, reduceSpatialState, semanticZoomLevels, AGSpace } from '../packages/spatial/index.mjs';

test('V5 exposes Chat, Work and Space as the only permanent primary modes', () => {
  assert.deepEqual(PRIMARY_MODES.map(x => x.id), ['chat','work','space']);
});

test('spatial kernel creates serializable deterministic default space', () => {
  const space = createSpatialState({ id:'space_primary', device:'desktop' });
  assert.equal(space.id, 'space_primary');
  assert.equal(space.version, 1);
  assert.equal(space.regions.length, 2);
  assert.equal(space.zoom.level, 'mission');
  assert.doesNotThrow(() => JSON.stringify(space));
});

test('spatial reducer docks, focuses and semantically zooms without mutating previous state', () => {
  const start = createSpatialState({ id:'space_primary' });
  const docked = reduceSpatialState(start, { type:'surface.dock', surface:{ id:'artifact:art_q4', kind:'artifact', title:'Q4 report' }, regionId:'detail' });
  assert.equal(start.regions.find(r=>r.id==='detail').surfaces.length, 0);
  assert.equal(docked.regions.find(r=>r.id==='detail').surfaces[0].id, 'artifact:art_q4');
  const focused = reduceSpatialState(docked, { type:'surface.focus', surfaceId:'artifact:art_q4' });
  assert.equal(focused.focusedSurfaceId, 'artifact:art_q4');
  const zoomed = reduceSpatialState(focused, { type:'zoom.set', level:'agent', objectId:'agent_data' });
  assert.deepEqual(zoomed.zoom, { level:'agent', objectId:'agent_data' });
});

test('semantic zoom hierarchy is stable and V5-owned', () => {
  assert.deepEqual(semanticZoomLevels, ['mission','workstream','task','agent','action','evidence']);
});

test('AGSpace renders semantic regions and keyboard-accessible surfaces', () => {
  const space = reduceSpatialState(createSpatialState({id:'space_primary'}), { type:'surface.dock', surface:{id:'mission:mission_q4',kind:'mission',title:'Q4 report'}, regionId:'primary' });
  const html = AGSpace({ space });
  assert.match(html, /data-ag-component="space"/);
  assert.match(html, /data-region="primary"/);
  assert.match(html, /data-surface="mission:mission_q4"/);
  assert.match(html, /tabindex="0"/);
});

test('Space deep link resolves as a human mode while preserving canonical WORK ownership',()=>{
  assert.deepEqual(routeFromLocation({pathname:'/space'}),{kind:'mode',mode:'space',domain:'work'});
});

test('V5 spatial package exposes first-party Region Dock Stack Peek Focus and ContextLens primitives',async()=>{
  const mod=await import('../packages/spatial/index.mjs');
  for(const name of ['AGRegion','AGDock','AGSurfaceStack','AGPeek','AGFocus','AGContextLens']) assert.equal(typeof mod[name],'function',`${name} export`);
  assert.match(mod.AGRegion({region:{id:'primary',role:'primary',size:.6,surfaces:[]}}),/data-ag-component="space-region"/);
  assert.match(mod.AGDock({items:[{kind:'artifact',label:'Artifact'}]}),/data-space-add="artifact"/);
  assert.match(mod.AGContextLens({level:'agent',objectId:'agent_data'}),/agent_data/);
});

test('spatial surfaces expose pointer drag handles while preserving the Move button alternative',()=>{
  const space=reduceSpatialState(createSpatialState({id:'space_primary'}),{type:'surface.dock',surface:{id:'artifact:1',kind:'artifact',title:'Report'},regionId:'detail'});
  const html=AGSpace({space});
  assert.match(html,/data-space-drag-handle="artifact:1"/);
  assert.match(html,/aria-label="Move Report to other region"/);
});
