import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const bootstrap=await readFile(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const css=(await Promise.all(['tokens','reset','shell','components','views','motion','responsive'].map(name=>readFile(new URL(`../styles/${name}.css`,import.meta.url),'utf8')))).join('\n');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

test('V5 bootstrap imports all first-party agentic operating environment packages',()=>{
  assert.match(main,/bootstrapAftergraph/);
  for(const path of ['packages/spatial','packages/presence','packages/interaction','packages/visualization','packages/composer']) assert.match(bootstrap,new RegExp(path.replace('/','\\/')));
});

test('Space is a first-class rendered mode rather than a canonical-domain fallback',()=>{
  assert.match(bootstrap,/function renderSpace\(/);
  assert.match(bootstrap,/state\.primaryMode==='space'.*renderSpace\(\)/s);
  assert.match(bootstrap,/state\.primaryMode/);
  assert.match(bootstrap,/data-space-action/);
});

test('V5.2 visual layers define spatial, presence, visualization, replay and intent composer signatures',()=>{
  for(const selector of ['.ag-space-stage','.ag-space-region','.ag-presence-rail','.ag-trajectory-graph','.ag-replay-timeline','.ag-intent-composer']) assert.match(css,new RegExp(selector.replace('.','\\.')));
});

test('V5 index and package metadata load the seven V5.2 design layers',()=>{
  for(const layer of ['tokens','reset','shell','components','views','motion','responsive']) assert.match(index,new RegExp(`/styles/${layer}\\.css`));
  assert.match(pkg.version,/^(?:5|6)\./);
  assert.match(pkg.description,/(?:Agentic|Unified Intelligence) Operating Environment/i);
  assert.doesNotMatch(index,/v5\.css|v4\.css|styles\.css/);
});

test('Space suppresses the legacy global pulse rail to avoid overlapping native presence',()=>{
  assert.match(bootstrap,/activeMode\(\)==='space'\?'':renderPulseRail\(mission\)/);
});
