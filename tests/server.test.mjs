import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer, isMainModule } from '../server.mjs';

test('server exposes health and deep-link shell fallback', async (t) => {
  const server = createAppServer({ root: new URL('../', import.meta.url) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const { port } = server.address();
  const health = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status:'ok', app:'aftergraph-workspace-v5-reference', api:'aftergraph.workspace.v5', releaseSha:'unknown' });
  const deep = await fetch(`http://127.0.0.1:${port}/d/CONTROL/o/approval/apr_prod_1`);
  assert.equal(deep.status, 200);
  assert.match(await deep.text(), /Aftergraph Workspace v5/);
  assert.match(deep.headers.get('content-security-policy') || '', /default-src 'self'/);
});

test('server entrypoint detection follows versioned release symlinks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-entrypoint-'));
  const target = new URL('../server.mjs', import.meta.url);
  const alias = join(dir, 'current', 'server.mjs');
  try {
    await mkdir(join(dir, 'current'));
    await symlink(target, alias);
    assert.equal(isMainModule(target.href, alias), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
