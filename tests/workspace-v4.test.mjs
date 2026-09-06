import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../src/main.mjs', import.meta.url),'utf8');
const bootstrap = await readFile(new URL('../src/app/bootstrap.mjs', import.meta.url),'utf8');
const html = await readFile(new URL('../index.html', import.meta.url),'utf8');
const chatView = await readFile(new URL('../src/views/chat-view.mjs', import.meta.url),'utf8');
const css = (await Promise.all(['tokens','reset','shell','components','views','motion','responsive'].map(name=>readFile(new URL(`../styles/${name}.css`,import.meta.url),'utf8')))).join('\n');

test('V5.2 bootstrap imports first-party ui kernel packages while main remains a tiny entry point', () => {
  assert.match(main,/bootstrapAftergraph/);
  for (const path of ['packages/ui/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs','live-runtime.mjs']) assert.match(bootstrap,new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('living shell exposes live runtime actions and immersive mode', () => {
  for (const action of ['run-live','pause-live','resume-live','toggle-immersive']) assert.match(bootstrap,new RegExp(action));
});

test('layered styles preserve living interface signatures', () => {
  for (const hook of ['ag-ambient-field','attention-gravity','surface-morph','outcome-settlement','ag-resize-handle']) assert.match(css,new RegExp(hook));
  assert.match(css,/prefers-reduced-motion/);
});

test('index loads the seven local V5.2 design layers', () => {
  for (const layer of ['tokens','reset','shell','components','views','motion','responsive']) assert.match(html,new RegExp(`/styles/${layer}\\.css`));
  assert.match(html,/Aftergraph Workspace v5/);
  assert.doesNotMatch(html,/v4\.css|v5\.css|styles\.css/);
});

test('workspace uses first-party interactive completion components', () => {
  for (const name of ['AGActionDock','AGAgentCluster','AGOutcomeReceipt','AGCommandPalette']) assert.match(bootstrap,new RegExp(name));
  for (const hook of ['ag-action-dock','ag-agent-cluster','ag-outcome-receipt']) assert.match(css,new RegExp(hook));
});

test('workspace mounts pulse rail with explicit toggle state', () => {
  assert.match(bootstrap,/AGPulseRail/);
  assert.match(bootstrap,/pulseOpen/);
  assert.match(bootstrap,/toggle-pulse/);
  assert.match(css,/\.ag-pulse-rail/);
});

test('conversation surface exposes live semantic state to the visual system', () => {
  assert.match(chatView,/data-live-state/);
  assert.match(css,/ag-conversation\[data-live-state="running"\]/);
  assert.match(css,/ag-conversation\[data-live-state="verified"\]/);
});

const sw = await readFile(new URL('../sw.js', import.meta.url),'utf8');
const manifest = await readFile(new URL('../manifest.webmanifest', import.meta.url),'utf8');

test('V5 offline shell caches the V5.2 local graph and preserves the living runtime', () => {
  assert.match(sw, /aftergraph-workspace-v5/);
  for (const asset of [
    '/styles/tokens.css','/styles/reset.css','/styles/shell.css','/styles/components.css','/styles/views.css','/styles/motion.css','/styles/responsive.css',
    '/src/live-runtime.mjs','/packages/ui/index.mjs','/packages/motion/index.mjs','/packages/tokens/index.mjs','/packages/icons/index.mjs','/packages/runtime-ui/index.mjs',
  ]) assert.match(sw, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(sw,/v4\.css|v5\.css|styles\.css|esm\.sh/);
  const parsed=JSON.parse(manifest);
  assert.equal(parsed.theme_color,'#07111f');
  assert.equal(parsed.background_color,'#07111f');
});
