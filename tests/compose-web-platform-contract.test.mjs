import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Compose web platform is verified from root', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts['verify:compose-web'], 'npm --prefix platforms/web run verify');
  const web = JSON.parse(await read('platforms/web/package.json'));
  assert.match(web.scripts.verify, /typecheck/);
  assert.match(web.scripts.verify, /test/);
  assert.match(web.scripts.verify, /build/);
});
