import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('main is bootstrap-only',()=>{
  const src=read('src/main.mjs');
  const nonblank=src.split(/\r?\n/).filter(x=>x.trim()).length;
  assert.ok(nonblank<=80,`main nonblank lines ${nonblank}`);
  assert.match(src,/bootstrapAftergraph/);
  assert.doesNotMatch(src,/addEventListener|function renderChat|function renderWork|function renderSpace|EventSource/);
});

test('frontend is decomposed into app runtime and explicit views',()=>{
  for(const p of ['src/app/bootstrap.mjs','src/app/events.mjs','src/app/controller.mjs','src/app/selectors.mjs','src/app/navigation.mjs','src/app/render-scheduler.mjs','src/app/scroll-policy.mjs','src/runtime/backend-session.mjs','src/views/chat-view.mjs','src/views/work-view.mjs','src/views/space-view.mjs','src/views/system-view.mjs','src/views/control-view.mjs','src/views/domain-view.mjs']) assert.equal(existsSync(new URL(`../${p}`,import.meta.url)),true,p);
});
