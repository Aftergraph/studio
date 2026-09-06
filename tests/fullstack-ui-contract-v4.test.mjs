import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bootstrap=await readFile(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const css=(await Promise.all(['tokens','reset','shell','components','views','motion','responsive'].map(name=>readFile(new URL(`../styles/${name}.css`,import.meta.url),'utf8')))).join('\n');

test('workspace integrates first-party API client with local fallback',()=>{
  assert.match(bootstrap,/createApiClient/);
  assert.match(bootstrap,/backendConnected/);
  assert.match(bootstrap,/connectBackend/);
  assert.match(bootstrap,/createBackendSession/);
  assert.match(bootstrap,/backendSession\.start\(\)/);
});

test('live controls route through backend when available',()=>{
  assert.match(bootstrap,/apiClient\.runtime/);
  assert.match(bootstrap,/apiClient\.setControl/);
  assert.match(bootstrap,/apiClient\.decideApproval/);
  assert.match(bootstrap,/apiClient\.sendMessage/);
});

test('workspace exposes backend connection state without dashboard noise',()=>{
  assert.match(bootstrap,/data-backend-state/);
  assert.match(css,/\[data-backend-state="connected"\]/);
});

test('visible context, work and telemetry surfaces are owned by the inhouse kernel',()=>{
  for (const component of ['AGContextSummary','AGMemoryItem','AGWorkSummary','AGTelemetryStrip']) assert.match(bootstrap,new RegExp(component));
});

test('offline shell caches local client modules but never caches live API/SSE responses',async()=>{
  const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(sw,/\/src\/api-client\.mjs/);
  assert.match(sw,/\/src\/surface-lifecycle\.mjs/);
  assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw,/\/healthz/);
  assert.doesNotMatch(sw,/esm\.sh|cdn\.jsdelivr|cdnjs/);
});
