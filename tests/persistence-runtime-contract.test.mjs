import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function json(rel) {
  return JSON.parse(await readFile(new URL(rel, root), 'utf8'));
}

test('production SQLite driver is pinned and supports the repository Node baseline', async () => {
  const pkg = await json('package.json');
  assert.equal(pkg.engines.node, '>=22');
  assert.equal(pkg.dependencies?.['better-sqlite3'], '13.0.3');
  const mod = await import('better-sqlite3');
  assert.equal(typeof mod.default, 'function');
});

test('CI installs locked Node dependencies before verification', async () => {
  const ci = await readFile(new URL('.github/workflows/ci.yml', root), 'utf8');
  assert.match(ci, /Install Node dependencies[\s\S]*run: npm ci/);
  assert.ok(ci.indexOf('run: npm ci') < ci.indexOf('Run Node Unit & Invariant Tests'));
});
