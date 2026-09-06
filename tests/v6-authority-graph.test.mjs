import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthority, executeConsequentialWrite } from '../src/federation/authority-graph.mjs';

test('ProjectionNeverGrantsAuthority',()=>{const projected={canonicalOwner:'works',authority:[]};assert.throws(()=>resolveAuthority(projected,'cancel'),/authority/)});
test('FailedAuthorityWriteNeverShowsSuccess',async()=>{const ui=[];await assert.rejects(()=>executeConsequentialWrite({object:{canonicalOwner:'tg',authority:[{owner:'tg',operations:['approve']}]},operation:'approve',input:{id:'apr_1'},registry:{canWrite:()=>true},adapters:{tg:{write:async()=>{throw new Error('503')}}},onUiState:s=>ui.push(s)}),/503/);assert.equal(ui.includes('approved'),false);assert.deepEqual(ui,['submitted'])});
test('consequential write blocks when authority owner is not current',async()=>{await assert.rejects(()=>executeConsequentialWrite({object:{authority:[{owner:'tg',operations:['approve']}]},operation:'approve',input:{},registry:{canWrite:()=>false},adapters:{tg:{write:async()=>({ok:true})}}}),/not current/)});
test('successful write ends at resyncing, never synthetic approved',async()=>{const ui=[];const result=await executeConsequentialWrite({object:{authority:[{owner:'tg',operations:['approve']}]},operation:'approve',input:{id:'1'},registry:{canWrite:()=>true},adapters:{tg:{write:async()=>({accepted:true})}},onUiState:s=>ui.push(s)});assert.deepEqual(result,{accepted:true});assert.deepEqual(ui,['submitted','resyncing'])});
