import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWorkView} from '../src/views/work-view.mjs';
import {renderSpaceView} from '../src/views/space-view.mjs';

test('work view is outcome-first and trajectory is progressive disclosure',()=>{
  const html=renderWorkView({rail:'rail',summary:'summary',attention:'',outcome:'outcome',trajectory:'trajectory',artifact:'',artifactOpen:false});
  assert.match(html,/ag-calm-work/);
  assert.match(html,/<details[^>]*class="ag-work-trajectory-disclosure"/);
  assert.doesNotMatch(html,/ag-artifact-surface/);
});

test('space view is direct canvas without hero frame and keeps edge controls',()=>{
  const html=renderSpaceView({toolbar:'tools',canvas:'canvas',context:'context',composer:'composer'});
  assert.match(html,/ag-direct-space/);
  assert.match(html,/ag-space-edge-controls/);
  assert.doesNotMatch(html,/<h1>|Live work, arranged around intent/);
});
