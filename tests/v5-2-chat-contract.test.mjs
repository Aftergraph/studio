import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AGComposer} from '../packages/ui/conversation/composer.mjs';
import {renderChatView} from '../src/views/chat-view.mjs';

test('composer exposes stable focus key for caret restoration',()=>{
  const html=AGComposer({mode:'Ask'});
  assert.match(html,/data-focus-key="composer-input"/);
});

test('calm chat view owns one reading stream and one primary composer',()=>{
  const html=renderChatView({header:'<header>H</header>',takeover:'',messages:'<article>m</article>',live:'<section>L</section>',composer:'<form data-ag-component="composer"></form>',artifact:''});
  assert.match(html,/class="ag-calm-chat/);
  assert.match(html,/data-scroll-key="conversation-stream"/);
  assert.equal((html.match(/data-ag-component="composer"/g)||[]).length,1);
  assert.doesNotMatch(html,/ag-telemetry-strip|ag-evidence-reveal/);
});

test('desktop shell does not expose duplicate top mode navigation',()=>{
  const css=readFileSync(new URL('../styles/shell.css',import.meta.url),'utf8')+readFileSync(new URL('../styles/responsive.css',import.meta.url),'utf8');
  assert.match(css,/\.ag-mode-switch\s*\{[^}]*display\s*:\s*none/s);
});
