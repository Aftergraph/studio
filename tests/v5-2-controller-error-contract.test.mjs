import test from 'node:test';
import assert from 'node:assert/strict';
import { runControllerAction } from '../src/app/controller.mjs';

test('controller exceptions become explicit failure results and diagnostics',async()=>{
  const diagnostics=[];
  const result=await runControllerAction('approve',async()=>{throw new Error('offline')},{diagnostics:e=>diagnostics.push(e)});
  assert.equal(result.ok,false);
  assert.equal(result.error.message,'offline');
  assert.equal(diagnostics.length,1);
  assert.equal(diagnostics[0].type,'controller.error');
  assert.equal(diagnostics[0].action,'approve');
});
