import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStateBackup, restoreStateBackup } from '../scripts/state_backup.mjs';

test('state backup creates a checksummed snapshot and restores into an isolated directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aftergraph-state-backup-'));
  const stateDir = join(root, 'state');
  const backupDir = join(root, 'backups');
  const restoreDir = join(root, 'restored');
  const stateFile = join(stateDir, 'workspace-state.json');
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, '{"missions":[]}\n');
  await writeFile(`${stateFile}.pilot-owner`, '{"missions":[{"id":"m1"}]}\n');
  try {
    const backup = await createStateBackup({ stateFile, backupDir, now: new Date('2026-09-12T12:00:00.000Z'), pid: 42 });
    assert.equal(backup.manifest.schema, 'aftergraph.state-backup.v1');
    assert.equal(backup.manifest.files.length, 2);
    const restored = await restoreStateBackup({ backupPath: backup.backupPath, restoreDir });
    assert.equal(restored.files.length, 2);
    assert.equal(await readFile(join(restoreDir, 'workspace-state.json'), 'utf8'), '{"missions":[]}\n');
    assert.equal(await readFile(join(restoreDir, 'workspace-state.json.pilot-owner'), 'utf8'), '{"missions":[{"id":"m1"}]}\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('state restore rejects dot-segment manifest names', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aftergraph-state-backup-'));
  const backupPath = join(root, 'backup');
  const restoreDir = join(root, 'restored');
  await mkdir(backupPath, { recursive: true });
  await writeFile(join(backupPath, 'manifest.json'), JSON.stringify({
    schema: 'aftergraph.state-backup.v1',
    files: [{ name: '..', bytes: 0, sha256: '' }],
  }));
  try {
    await assert.rejects(
      () => restoreStateBackup({ backupPath, restoreDir }),
      error => error?.code === 'unsafe_backup_filename',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
