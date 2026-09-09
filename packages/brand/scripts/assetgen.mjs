#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((v, i, all) => v.startsWith('--') ? [v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true] : null).filter(Boolean));
if (!args.title || !args.type) {
  console.error('Usage: assetgen --type <github|og|square|portrait|release|research> --title <text> [--subtitle <text>] [--product <name>] [--version <semver>] [--status <label>] [--evidence-class <E0-E6>] [--output <file.svg>]');
  process.exit(2);
}
const sizes = { github:[1280,640], og:[1200,630], square:[1080,1080], portrait:[1080,1350], release:[1280,640], research:[1200,630] };
if (!sizes[args.type]) throw new Error(`Unsupported type: ${args.type}`);
const [width, height] = sizes[args.type];
const text = String(args.title).trim();
if (text.length > 92) throw new Error('Title exceeds 92 characters; shorten it instead of silently truncating.');
const esc = (s='') => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const label = args.product ? `AFTERGRAPH / ${String(args.product).toUpperCase()}` : 'AFTERGRAPH';
const status = [args.status, args.version, args['evidence-class']].filter(Boolean).join(' · ');
const y = Math.round(height * .42);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(text)}"><rect width="${width}" height="${height}" fill="#080C14"/><path d="M0 ${height*.82} Q ${width*.35} ${height*.6} ${width*.62} ${height*.78} T ${width} ${height*.55}V${height}H0z" fill="#0E1630"/><text x="${width*.075}" y="${height*.18}" fill="#42C7E8" font-family="Inter,Arial,sans-serif" font-size="${Math.round(height*.037)}" font-weight="700" letter-spacing="4">${esc(label)}</text><text x="${width*.075}" y="${y}" fill="#F5F7FA" font-family="Inter,Arial,sans-serif" font-size="${Math.round(height*.085)}" font-weight="700">${esc(text)}</text>${args.subtitle?`<text x="${width*.075}" y="${y+height*.09}" fill="#8993A4" font-family="Inter,Arial,sans-serif" font-size="${Math.round(height*.035)}">${esc(args.subtitle)}</text>`:''}${status?`<text x="${width*.075}" y="${height*.86}" fill="#24C4AD" font-family="JetBrains Mono,monospace" font-size="${Math.round(height*.028)}">${esc(status)}</text>`:''}<text x="${width*.075}" y="${height*.93}" fill="#F5F7FA" font-family="JetBrains Mono,monospace" font-size="${Math.round(height*.026)}">aftergraph.org</text></svg>\n`;
const output = path.resolve(args.output || `aftergraph-${args.type}.svg`);
fs.mkdirSync(path.dirname(output), {recursive:true});
fs.writeFileSync(output, svg);
console.log(output);

