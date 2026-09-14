import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createAppServer } from '../server.mjs';
import { createStateBackup } from '../scripts/state_backup.mjs';

test('readyz fails closed until the required backup is fresh and checksummed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aftergraph-ready-backup-'));
  const stateFile = join(root, 'state', 'workspace-state.json');
  const backupDir = join(root, 'backups');
  await mkdir(join(root, 'state'), { recursive: true });
  const server = createAppServer({
    root: new URL('../', import.meta.url),
    stateFile,
    runtimeIntervalMs: 20,
    authSecret: 'ready-backup-test-secret',
    requireAuth: true,
    requireBackup: true,
    backupDir,
    releaseSha: 'backup-ready-sha',
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const missing = await fetch(base + '/readyz');
    assert.equal(missing.status, 503);
    assert.equal((await missing.json()).backup.status, 'missing');

    await server.workspace.store.readyP;
    await writeFile(stateFile + '.demo-user', '{"billing":{"invoices":[]}}\n');
    await createStateBackup({ stateFile, backupDir, pid: 99 });
    const ready = await fetch(base + '/readyz');
    const body = await ready.json();
    assert.equal(ready.status, 200);
    assert.equal(body.status, 'ready');
    assert.equal(body.backup.status, 'fresh');
    assert.equal(body.backup.required, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
