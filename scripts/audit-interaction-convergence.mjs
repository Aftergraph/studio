#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditInteractionOwnership } from '../src/interaction/ownership-audit.mjs';

function parseArgs(argv) {
  const args={};
  for(let i=0;i<argv.length;i+=2){
    const key=argv[i]; const value=argv[i+1];
    if(!key?.startsWith('--')||!value) throw new Error('expected --key value arguments');
    args[key.slice(2)]=value;
  }
  for(const key of ['topology','org-state','reviewed-manifest','out']) {
    if(!args[key]) throw new Error(`missing --${key}`);
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file,'utf8'));
}

async function main() {
  const args=parseArgs(process.argv.slice(2));
  const report=auditInteractionOwnership({
    topology:await readJson(args.topology),
    orgState:await readJson(args['org-state']),
    reviewedManifest:await readJson(args['reviewed-manifest']),
  });
  const target=path.resolve(args.out);
  await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,`${JSON.stringify(report,null,2)}\n`,'utf8');
  process.stdout.write(`${target}\n`);
}

main().catch(error=>{
  process.stderr.write(`${error?.message||String(error)}\n`);
  process.exitCode=1;
});
