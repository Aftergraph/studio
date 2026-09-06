import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
const expoTheme=await readFile(new URL('../platforms/expo/src/theme.ts',import.meta.url),'utf8');
const expoLayout=await readFile(new URL('../platforms/expo/app/_layout.tsx',import.meta.url),'utf8');
const expoSpace=await readFile(new URL('../platforms/expo/app/space.tsx',import.meta.url),'utf8').catch(()=> '');
const swiftRoot=await readFile(new URL('../platforms/swiftui/Aftergraph/RootView.swift',import.meta.url),'utf8');
const swiftSpace=await readFile(new URL('../platforms/swiftui/Aftergraph/SpaceView.swift',import.meta.url),'utf8').catch(()=> '');

test('V5 offline shell caches every new first-party runtime package and V5.2 design layer',()=>{
  assert.match(sw,/aftergraph-workspace-v5/);
  for(const asset of [
    '/styles/tokens.css','/styles/reset.css','/styles/shell.css','/styles/components.css','/styles/views.css','/styles/motion.css','/styles/responsive.css',
    '/src/replay.mjs','/packages/spatial/index.mjs','/packages/presence/index.mjs','/packages/interaction/index.mjs','/packages/visualization/index.mjs','/packages/composer/index.mjs'
  ]) assert.match(sw,new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
  assert.doesNotMatch(sw,/v5\.css|v4\.css|styles\.css|esm\.sh/);
});

test('V5 manifest identifies the agentic operating environment',()=>{
  assert.match(manifest.description,/Agentic Operating Environment/i);
  assert.equal(manifest.start_url,'/chat');
});

test('Expo native shell exposes Chat Work Space and a real Space source view',()=>{
  assert.match(expoTheme,/\['Chat', 'Work', 'Space'\]/);
  assert.match(expoLayout,/name="space"/);
  assert.match(expoSpace,/contentInsetAdjustmentBehavior="automatic"/);
  assert.match(expoSpace,/Semantic zoom/);
  assert.match(expoSpace,/Follow agent/);
});

test('SwiftUI native shell exposes Chat Work Space and native spatial controls',()=>{
  assert.match(swiftRoot,/Label\("Space"/);
  assert.match(swiftSpace,/struct SpaceView/);
  assert.match(swiftSpace,/NavigationStack/);
  assert.match(swiftSpace,/Semantic zoom/);
  assert.match(swiftSpace,/sensoryFeedback/);
});
