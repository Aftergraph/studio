#!/usr/bin/env node
// Raster text is rendered with system fonts via fontconfig: install Inter and
// JetBrains Mono before regenerating, otherwise fallback metrics reflow text.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch {
  const runtimeModules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtimeModules) throw new Error('Install the optional sharp dependency to generate raster exports.');
  sharp = require(path.join(runtimeModules, 'sharp'));
}
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'exports');
fs.mkdirSync(path.join(out,'favicon'),{recursive:true});
fs.mkdirSync(path.join(out,'identity'),{recursive:true});
fs.mkdirSync(path.join(out,'social'),{recursive:true});

const jobs = [
  ['identity/aftergraph-micro-mark.svg','favicon/favicon-16.png',16,16,'png'],
  ['identity/aftergraph-micro-mark.svg','favicon/favicon-32.png',32,32,'png'],
  ['identity/aftergraph-micro-mark.svg','favicon/favicon-48.png',48,48,'png'],
  ['identity/aftergraph-micro-mark.svg','favicon/favicon-64.png',64,64,'png'],
  ['svg/aftergraph-app-icon.svg','favicon/apple-touch-icon.png',180,180,'png'],
  ['svg/aftergraph-app-icon.svg','favicon/pwa-192.png',192,192,'png'],
  ['svg/aftergraph-app-icon.svg','favicon/pwa-512.png',512,512,'png'],
  ['svg/aftergraph-monogram.svg','identity/aftergraph-monogram-1024.png',1024,1024,'png'],
  ['svg/aftergraph-monogram.svg','identity/aftergraph-monogram-1024.webp',1024,1024,'webp'],
  ['social/og-aftergraph.svg','social/og-aftergraph.png',1200,630,'png'],
  ['social/og-docs.svg','social/og-docs.png',1200,630,'png'],
  ['social/og-work-intelligence.svg','social/og-work-intelligence.png',1200,630,'png']
];
for (const [input,output,w,h,format] of jobs) {
  const pipeline=sharp(path.join(root,input),{density:192}).resize(w,h,{fit:'fill'});
  await (format==='webp'?pipeline.webp({quality:90}):pipeline.png({compressionLevel:9})).toFile(path.join(out,output));
}

// ICO supports PNG-compressed entries. Embed 16/32/48 sources without recompression.
const icoSizes=[16,32,48];
const images=icoSizes.map(n=>fs.readFileSync(path.join(out,'favicon',`favicon-${n}.png`)));
const header=Buffer.alloc(6+16*images.length); header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(images.length,4);
let offset=header.length;
images.forEach((img,i)=>{const p=6+i*16,n=icoSizes[i];header[p]=n;header[p+1]=n;header[p+2]=0;header[p+3]=0;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(img.length,p+8);header.writeUInt32LE(offset,p+12);offset+=img.length;});
fs.writeFileSync(path.join(out,'favicon','favicon.ico'),Buffer.concat([header,...images]));
fs.copyFileSync(path.join(root,'svg/favicon.svg'),path.join(out,'favicon','favicon.svg'));
console.log(`Exported ${jobs.length + 2} raster/favicon assets.`);

