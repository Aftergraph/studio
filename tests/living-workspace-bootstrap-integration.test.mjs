import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('Studio shell renders persistent Active Context from canonical workspace state',()=>{
  assert.match(source,/deriveActiveContext\(state,ui,/);
  assert.match(source,/AGActiveContextBar\(\{context[,}]/);
  assert.match(source,/ag-active-context-strip/);
});

test('human mode navigation aligns view selection to Active Context',()=>{
  assert.match(source,/alignModeToActiveContext\(state,ui,id\)/);
  assert.match(source,/conversationIdForMission\(state,/);
});

test('backend phase changes patch Active Context freshness without forcing a full shell render',()=>{
  assert.match(source,/function refreshActiveContextStrip\(\)/);
  assert.match(source,/setBackendPhase\(phase\)[\s\S]*refreshActiveContextStrip\(\)/);
  assert.match(source,/host\.innerHTML=AGActiveContextBar/);
});

test('Chat message rendering mounts governed generated surfaces through the Aftergraph registry',()=>{
  assert.match(source,/createAftergraphGenerativeRegistry/);
  assert.match(source,/renderGeneratedMessageSurfaces/);
  assert.match(source,/const generativeRegistry=createAftergraphGenerativeRegistry\(\)/);
  assert.match(source,/generated=renderGeneratedMessageSurfaces/);
});

test('generated action clicks are prepared through governed interaction handoff instead of direct API execution',()=>{
  assert.match(source,/createAftergraphGeneratedActionCatalog/);
  assert.match(source,/prepareGeneratedInteraction/);
  assert.match(source,/function handleGeneratedAction\(/);
  assert.match(source,/data\.generatedAction/);
  assert.doesNotMatch(source,/data\.generatedAction[\s\S]{0,500}apiClient\./);
});

test('composer and generated surfaces consume canonical Active Context freshness state',()=>{
  assert.match(source,/freshness\.state/);
  assert.doesNotMatch(source,/freshness\.phase/);
});

test('backend freshness changes patch generated surfaces without a full shell render',()=>{
  assert.match(source,/function refreshGeneratedSurfaces\(/);
  assert.match(source,/refreshActiveContextStrip\(\);\s*refreshGeneratedSurfaces\(\);/);
});
