import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createStateBackup,
  inspectStateBackup,
  verifyStateBackup,
} from '../scripts/state_backup.mjs';

async function fixture(now = '2026-09-13T10:00:00.000Z') {
  const root = await mkdtemp(join(tmpdir(), 'aftergraph-backup-readiness-'));
  const stateFile = join(root, 'state', 'workspace-state.json');
  const backupDir = join(root, 'backups');
  await mkdir(join(root, 'state'), { recursive: true });
  await writeFile(stateFile, '{"billing":{"invoices":[]}}\n');
  return { root, stateFile, backupDir, now };
}

test('backup inspection reports a fresh checksummed backup', async () => {
  const data = await fixture();
  try {
    const backup = await createStateBackup({
      stateFile: data.stateFile,
      backupDir: data.backupDir,
      now: new Date(data.now),
      pid: 7,
    });
    const status = await inspectStateBackup({
      backupDir: data.backupDir,
      now: new Date('2026-09-13T10:30:00.000Z'),
      maxAgeMs: 60 * 60 * 1000,
    });
    assert.equal(status.status, 'fresh');
    assert.equal(status.latestBackupPath, backup.backupPath);
    const verified = await verifyStateBackup({ backupPath: backup.backupPath });
    assert.equal(verified.files.length, 1);
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});
test('backup inspection fails closed for stale and missing evidence', async () => {
  const data = await fixture('2026-09-11T10:00:00.000Z');
  try {
    await createStateBackup({
      stateFile: data.stateFile,
      backupDir: data.backupDir,
      now: new Date(data.now),
      pid: 8,
    });
    const stale = await inspectStateBackup({
      backupDir: data.backupDir,
      now: new Date('2026-09-13T10:00:00.000Z'),
      maxAgeMs: 60 * 60 * 1000,
    });
    assert.equal(stale.status, 'stale');

    const missing = await inspectStateBackup({
      backupDir: join(data.root, 'missing'),
      now: new Date(data.now),
      maxAgeMs: 60 * 60 * 1000,
    });
    assert.equal(missing.status, 'missing');
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});

test('backup verification rejects tampered backup content', async () => {
  const data = await fixture();
  try {
    const backup = await createStateBackup({
      stateFile: data.stateFile,
      backupDir: data.backupDir,
      now: new Date(data.now),
      pid: 9,
    });
    await writeFile(join(backup.backupPath, 'workspace-state.json'), 'tampered\n');
    await assert.rejects(
      () => verifyStateBackup({ backupPath: backup.backupPath }),
      error => error?.code === 'backup_checksum_mismatch',
    );
  } finally {
    await rm(data.root, { recursive: true, force: true });
  }
});
