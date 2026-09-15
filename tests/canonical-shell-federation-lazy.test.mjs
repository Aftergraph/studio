import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('optional federation is lazy and does not generate cold-start 404 probes',()=>{
  const connect=source.match(/async function connectBackend\(\)[\s\S]*?function applyFederationSnapshot/)?.[0]||'';
  assert.doesNotMatch(connect,/refreshFederation\(\)/);
  const navigate=source.match(/function navigateDomain\(domain\)[\s\S]*?function navigateHuman/)?.[0]||'';
  assert.match(navigate,/research/);
  assert.match(navigate,/capabilities/);
  assert.match(navigate,/refreshFederation\(\)/);
});