import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SCHEMA = 'aftergraph.state-backup.v1';

function required(value, name) {
  if (!value || typeof value !== 'string') {
    const error = new Error(`${name} required`);
    error.code = 'configuration_required';
    throw error;
  }
  return path.resolve(value);
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}
export async function collectStateFiles(stateFile) {
  const source = required(stateFile, 'AFTERGRAPH_STATE_FILE');
  const directory = path.dirname(source);
  const basename = path.basename(source);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter(entry => entry.isFile() && (entry.name === basename || entry.name.startsWith(`${basename}.`)) && !entry.name.endsWith('.tmp'))
    .map(entry => path.join(directory, entry.name))
    .sort();
}

function safeManifestName(name) {
  return typeof name === 'string'
    && name.length > 0
    && name !== '.'
    && name !== '..'
    && name === path.basename(name)
    && name === path.normalize(name)
    && !name.includes('\0');
}

export async function createStateBackup({ stateFile, backupDir, now = new Date(), pid = process.pid } = {}) {
  const source = required(stateFile, 'AFTERGRAPH_STATE_FILE');
  const destination = required(backupDir, 'AFTERGRAPH_BACKUP_DIR');
  if (path.dirname(source) === destination) {
    const error = new Error('backup directory must be separate from state directory');
    error.code = 'invalid_backup_directory';
    throw error;
  }  const files = await collectStateFiles(source);
  if (files.length === 0) {
    const error = new Error('no state files found');
    error.code = 'no_state_files';
    throw error;
  }
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const stamp = now.toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const backupPath = path.join(destination, `state-${stamp}-${pid}`);
  const tempPath = `${backupPath}.tmp`;
  await rm(tempPath, { recursive: true, force: true });
  await mkdir(tempPath, { recursive: true, mode: 0o700 });
  try {
    const manifestFiles = [];
    for (const sourceFile of files) {
      const name = path.basename(sourceFile);
      const targetFile = path.join(tempPath, name);
      await copyFile(sourceFile, targetFile);
      await chmod(targetFile, 0o600);
      const info = await stat(sourceFile);
      manifestFiles.push({ name, bytes: info.size, sha256: await sha256(sourceFile) });
    }
    const manifest = {
      schema: SCHEMA,
      createdAt: now.toISOString(),
      files: manifestFiles,
    };
    await writeFile(path.join(tempPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, backupPath);
    return { backupPath, manifest };
  } catch (error) {
    await rm(tempPath, { recursive: true, force: true });
    throw error;
  }
}
export async function restoreStateBackup({ backupPath, restoreDir } = {}) {
  const source = required(backupPath, 'AFTERGRAPH_BACKUP_PATH');
  const destination = required(restoreDir, 'AFTERGRAPH_RESTORE_DIR');
  const manifest = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
  if (manifest?.schema !== SCHEMA || !Array.isArray(manifest.files)) {
    const error = new Error('invalid backup manifest');
    error.code = 'invalid_backup_manifest';
    throw error;
  }
  for (const file of manifest.files) {
    if (!safeManifestName(file.name)) {
      const error = new Error('unsafe backup filename');
      error.code = 'unsafe_backup_filename';
      throw error;
    }
  }
  try {
    await stat(destination);
    const error = new Error('restore directory must not already exist');
    error.code = 'restore_target_exists';
    throw error;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const tempPath = `${destination}.tmp-${process.pid}`;
  await rm(tempPath, { recursive: true, force: true });
  await mkdir(tempPath, { recursive: true, mode: 0o700 });
  try {
    for (const file of manifest.files) {
      const sourceFile = path.join(source, file.name);
      const targetFile = path.join(tempPath, file.name);
      await copyFile(sourceFile, targetFile);
      await chmod(targetFile, 0o600);
      const info = await stat(targetFile);
      if (info.size !== file.bytes || await sha256(targetFile) !== file.sha256) {        const error = new Error(`backup checksum mismatch: ${file.name}`);
        error.code = 'backup_checksum_mismatch';
        throw error;
      }
    }
    await rename(tempPath, destination);
    return { restoreDir: destination, files: manifest.files };
  } catch (error) {
    await rm(tempPath, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  if (command === 'backup') {
    const result = await createStateBackup({
      stateFile: process.env.AFTERGRAPH_STATE_FILE,
      backupDir: process.env.AFTERGRAPH_BACKUP_DIR,
    });
    console.log(`backup_path=${result.backupPath}`);
    return;
  }
  if (command === 'restore') {
    const result = await restoreStateBackup({
      backupPath: process.env.AFTERGRAPH_BACKUP_PATH,
      restoreDir: process.env.AFTERGRAPH_RESTORE_DIR,
    });
    console.log(`restore_dir=${result.restoreDir}`);
    return;
  }
  throw new Error('command must be backup or restore');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(`state operation failed: ${error.code || error.message}`);
    process.exitCode = 1;
  });
}
