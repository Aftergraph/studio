#!/usr/bin/env node
// @ts-nocheck
// Sync packages/brand from the canonical Brand OS release (fail-closed).
// Replaces the former local fork with versioned consumption: the directory
// is a deployed copy of @aftergraph/brand v1.1.0, not a canonical source.
// Run: node scripts/sync-brand.mjs [--check]
// Env BRAND_TARBALL overrides the download with a local .tgz (offline).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BRAND_VERSION = '1.1.0';
const TARBALL_URL = `https://github.com/Aftergraph/brand/releases/download/v${BRAND_VERSION}/aftergraph-brand-${BRAND_VERSION}.tgz`;
const TARBALL_SHA256 = '3d881b90d99a5af04a922fad0381c562d5b7dff766732b64350605db97bd6f8f';
const CHECK_ONLY = process.argv.includes('--check');
const root = path.resolve(import.meta.dirname, '..');
const dest = path.join(root, 'packages', 'brand');
const fail = (m) => { console.error(`SYNC-FAIL: ${m}`); process.exit(1); };

let tgz;
if (process.env.BRAND_TARBALL) {
  tgz = process.env.BRAND_TARBALL;
  if (!fs.existsSync(tgz)) fail(`BRAND_TARBALL missing: ${tgz}`);
} else {
  tgz = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'brand-')), 'brand.tgz');
  try {
    execFileSync('curl', ['-sSL', '--max-time', '120', '-o', tgz, TARBALL_URL], { stdio: 'inherit' });
  } catch { fail(`download failed: ${TARBALL_URL}`); }
}
const sum = createHash('sha256').update(fs.readFileSync(tgz)).digest('hex');
if (sum !== TARBALL_SHA256) fail(`tarball SHA mismatch: got ${sum}`);
console.log(`brand tarball OK: v${BRAND_VERSION} sha256:${sum.slice(0, 12)}…`);

const list = execFileSync('tar', ['-tzf', tgz]).toString('utf8').split('\n').filter(Boolean);
const members = list.filter((m) => m.startsWith('package/')).map((m) => m.slice('package/'.length)).filter(Boolean);
if (!members.includes('index.mjs') || !members.includes('package.json')) fail('tarball missing package core');
console.log(`tarball members: ${members.length} under package/`);

if (!CHECK_ONLY) {
  execFileSync('tar', ['-xzf', tgz, '-C', dest, '--strip-components=1', 'package']);
  fs.writeFileSync(path.join(dest, 'PROVENANCE.md'),
    `# Provenance: packages/brand\n\nDeployed copy of \`@aftergraph/brand\` v${BRAND_VERSION} (release tarball\nSHA-256 \`${TARBALL_SHA256}\`). Canonical source: \`Aftergraph/brand\`.\nDo not edit here; refresh with \`node scripts/sync-brand.mjs\`.\n`);
  console.log(`synced ${members.length} files into packages/brand/`);
}
console.log('brand sync PASS');
