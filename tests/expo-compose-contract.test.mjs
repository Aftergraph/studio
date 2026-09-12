import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../platforms/expo/',import.meta.url);
const text=path=>readFile(new URL(path,root),'utf8');

test('Compose Expo package is runnable on SDK 57',async()=>{
  const pkg=JSON.parse(await text('package.json'));
  assert.equal(pkg.main,'expo-router/entry');
  assert.match(pkg.dependencies.expo,/57/);
  assert.equal(pkg.dependencies.react,'19.2.3');
  assert.match(pkg.dependencies['react-native'],/0\.86/);
  assert.match(pkg.dependencies['expo-router'],/57/);
});

test('app metadata identifies Aftergraph Compose and Router',async()=>{
  const app=JSON.parse(await text('app.json'));
  assert.equal(app.expo.name,'Aftergraph Compose');
  assert.equal(app.expo.slug,'aftergraph-compose');
  assert.ok(app.expo.plugins.includes('expo-router'));
});
test('default route enters Compose while legacy Space remains registered',async()=>{
  const index=await text('app/index.tsx');
  const layout=await text('app/_layout.tsx');
  assert.match(index,/compose/);
  assert.match(layout,/name="compose"/);
  assert.match(layout,/name="space"/);
});

test('capture screen owns rough-thought input and compile action',async()=>{
  const screen=await text('app/compose.tsx');
  assert.match(screen,/TextInput/);
  assert.match(screen,/compileIntent/);
  assert.match(screen,/Improve/);
  assert.match(screen,/roughThought/);
});

test('mobile API uses Studio compile route without provider credentials',async()=>{
  const api=await text('src/compose/api.ts');
  assert.match(api,/\/api\/v1\/intent\/compile/);
  assert.match(api,/EXPO_PUBLIC_AFTERGRAPH_API_URL/);
  assert.doesNotMatch(api,/AFTERGRAPH_INTENT_API_KEY|apiKey|Authorization/);
});

test('result route exposes usable output actions without direct delivery',async()=>{
  const screen=await text('app/compose-result.tsx');
  assert.match(screen,/Understood as/i);
  assert.match(screen,/Clipboard\.setStringAsync/);
  assert.match(screen,/Share\.share/);
  assert.match(screen,/selectable/);
  for(const label of ['Clearer','More autonomous','Safer','More detailed','Shorter','Execution-ready']){
    assert.match(screen,new RegExp(label,'i'));
  }
  assert.doesNotMatch(screen,/Run now|Send directly|Execute now/i);
});

test('result route can override all supported targets',async()=>{
  const screen=await text('app/compose-result.tsx');
  for(const target of ['friday.chatgpt','anthropic.claude-code','openai.codex','aftergraph.hermes','generic']){
    assert.match(screen,new RegExp(target.replace(/[.]/g,'\\.')));
  }
  assert.match(screen,/compileIntent/);
});
test('Compose persists drafts and bounded recents locally',async()=>{
  const history=await text('src/compose/history.ts');
  const draft=await text('src/compose/draft.ts');
  assert.match(history,/expo-sqlite\/kv-store/);
  assert.match(history,/aftergraph\.compose\.recents\.v1/);
  assert.match(history,/slice\(0,\s*50\)/);
  assert.match(draft,/expo-sqlite\/kv-store/);
  assert.match(draft,/aftergraph\.compose\.draft\.v1/);
});

test('capture restores and preserves draft while result saves successful compile',async()=>{
  const capture=await text('app/compose.tsx');
  const result=await text('app/compose-result.tsx');
  assert.match(capture,/loadDraft/);
  assert.match(capture,/saveDraft/);
  assert.match(result,/saveComposition/);
});

test('Recents route can reopen and delete local compositions',async()=>{
  const screen=await text('app/compose-recents.tsx');
  assert.match(screen,/FlatList/);
  assert.match(screen,/listRecentCompositions/);
  assert.match(screen,/deleteComposition/);
  assert.match(screen,/router\.push/);
  assert.match(screen,/Delete/);
});
