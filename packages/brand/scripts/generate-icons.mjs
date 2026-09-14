import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'semantics/registry.json'), 'utf8'));
const out = path.join(root, 'semantics/icons');
fs.mkdirSync(out, { recursive: true });

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const glyph = (name, state) => {
  const seed = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  const a = 5 + (seed % 4);
  const b = 15 + (seed % 3);
  const base = state
    ? `<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M7 12h10"/><path d="M12 7v10"/>`
    : `<path d="M4 18V7l8-4 8 4v11l-8 3z"/><circle cx="${a}" cy="${b}" r="1.5"/><circle cx="16" cy="8" r="1.5"/><path d="M${a} ${b} 16 8 12 16z"/>`;
  const overlay = {
    verified: '<path d="m7.5 12 3 3 6-7"/>', stale: '<circle cx="12" cy="12" r="5"/><path d="M12 9v3l2 1"/>',
    revoked: '<path d="M7 17 17 7M8 8l8 8"/>', conflict: '<path d="M8 6v5l-3 3M16 6v5l3 3"/>',
    proposed: '<path d="m8 12 3 3 6-7" stroke-dasharray="2 2"/>', canonical: '<path d="M7 8h10M7 12h10M7 16h10"/>',
    observed: '<path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z"/><circle cx="12" cy="12" r="2"/>',
    unavailable: '<path d="M7 12h10"/>', superseded: '<path d="m7 9 5 3-5 3M12 9l5 3-5 3"/>',
    withheld: '<path d="M8 8h8v8H8z"/><path d="M6 18 18 6"/>', unknown: '<path d="M9 9a3 3 0 1 1 3 3v2M12 17h.01"/>',
    unverified: '<path d="M8 8l8 8M16 8l-8 8"/>', indeterminate: '<path d="M7 12h10"/>'
  }[name] || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="Aftergraph ${esc(name)} symbol"><title>${esc(name)}</title><g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${state ? overlay || base : base}</g></svg>\n`;
};

for (const name of registry.concepts) fs.writeFileSync(path.join(out, `${name}.svg`), glyph(name, false));
for (const name of registry.states) fs.writeFileSync(path.join(out, `state-${name}.svg`), glyph(name, true));
console.log(`Generated ${registry.concepts.length + registry.states.length} institutional symbols.`);

