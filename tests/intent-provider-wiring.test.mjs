import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('studio defaults intent compile to the isolated Hermes API provider', async () => {
  const source=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  assert.match(source,/createHermesApiIntentProvider/);
  assert.match(source,/intentProvider \|\| createHermesApiIntentProvider\(\)/);
});
