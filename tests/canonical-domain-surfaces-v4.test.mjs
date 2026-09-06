import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap=fs.readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const systemView=fs.readFileSync(new URL('../src/views/system-view.mjs',import.meta.url),'utf8');
const controlView=fs.readFileSync(new URL('../src/views/control-view.mjs',import.meta.url),'utf8');
const surfaceSource=bootstrap+'\n'+systemView+'\n'+controlView;
const css=['tokens','reset','shell','components','views','motion','responsive']
  .map(name=>fs.readFileSync(new URL(`../styles/${name}.css`,import.meta.url),'utf8')).join('\n');

test('all non-primary canonical domains render real product surfaces instead of generic command-only copy', () => {
  for (const fn of ['renderNowDomain','renderAgentsDomain','renderBrainDomain','renderOutputDomain','renderControlDomain','renderConnectDomain','renderSystemDomain']) {
    assert.match(bootstrap,new RegExp(`function ${fn}\\(`));
  }
  assert.doesNotMatch(bootstrap,/Available through the command layer/);
  assert.match(bootstrap,/const domainRenderers=/);
});

test('canonical surfaces use first-party semantic rows and cards', () => {
  for (const component of ['AGAgentCard','AGConnectionRow','AGArtifactRow','AGEventRow']) assert.match(bootstrap,new RegExp(component));
  for (const domain of ['now','agents','brain','output','control','connect','system']) {
    assert.match(surfaceSource,new RegExp(`data-domain-surface="${domain}"`));
  }
});

test('domain design layer uses open rails and semantic rows rather than default card grids', () => {
  for (const hook of ['ag-domain-page','ag-domain-rail','ag-agent-card','ag-connection-row','ag-artifact-row','ag-event-row']) {
    assert.match(css,new RegExp(`\\.${hook}`));
  }
});
