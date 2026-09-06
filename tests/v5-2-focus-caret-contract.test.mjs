import test from 'node:test';
import assert from 'node:assert/strict';
import { captureFocusSnapshot, restoreFocusSnapshot } from '../src/app/render-scheduler.mjs';

test('focus snapshot is null without a focused keyed element',()=>{
  const root={contains:()=>false};
  assert.equal(captureFocusSnapshot(root,{activeElement:null}),null);
});

test('focus/caret restoration targets stable data-focus-key',()=>{
  let focused=false,selection=null;
  const target={disabled:false,focus(){focused=true},setSelectionRange(a,b,d){selection=[a,b,d]}};
  const root={querySelector(sel){return sel==='[data-focus-key="composer-input"]'?target:null}};
  const snapshot={key:'composer-input',selectionStart:4,selectionEnd:7,selectionDirection:'forward'};
  assert.equal(restoreFocusSnapshot(root,snapshot),true);
  assert.equal(focused,true);
  assert.deepEqual(selection,[4,7,'forward']);
});
