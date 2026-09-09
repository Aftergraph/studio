import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRAND_METADATA,
  BRAND_COLORS,
  BRAND_TYPOGRAPHY,
  BRAND_GRAMMAR,
  BRAND_TOKENS,
  BRAND_ASSETS,
  resolveBrandColor,
  getContrastRatio,
  isAccessiblePair,
} from '../packages/brand/index.mjs';

import { TOKENS, BRAND_COLORS as REEXPORTED_COLORS } from '../packages/tokens/index.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('brand package exports canonical institutional metadata and grammar', () => {
  assert.equal(BRAND_METADATA.name, 'Aftergraph');
  assert.equal(BRAND_METADATA.altName, undefined);
  assert.equal(BRAND_METADATA.tagline, 'Infrastructure for verifiable intelligent systems');
  assert.match(BRAND_METADATA.grammar, /graphs → boundaries → authority → execution → evidence → verified outcomes/);
  assert.equal(BRAND_METADATA.status, 'provisional-not-trademark-cleared');

  assert.deepEqual(BRAND_GRAMMAR, [
    'nodes',
    'edges',
    'boundaries',
    'gates',
    'receipts',
    'evidence',
    'verified-outcome',
  ]);
});

test('brand color tokens match official hex values exactly', () => {
  assert.equal(BRAND_COLORS.institutionBlack, '#080C14');
  assert.equal(BRAND_COLORS.graphMidnight, '#0E1630');
  assert.equal(BRAND_COLORS.evidenceWhite, '#F5F7FA');
  assert.equal(BRAND_COLORS.slate, '#8993A4');
  assert.equal(BRAND_COLORS.controlCyan, '#42C7E8');
  assert.equal(BRAND_COLORS.evidenceTeal, '#24C4AD');
  assert.equal(BRAND_COLORS.authorityViolet, '#7759E8');
  assert.equal(BRAND_COLORS.decisionAmber, '#F0A64A');
  assert.equal(BRAND_COLORS.systemBlue, '#4C8BD8');
});

test('brand color contrast satisfies WCAG 2.2 AA and AAA thresholds', () => {
  const whiteOnBlack = getContrastRatio(BRAND_COLORS.evidenceWhite, BRAND_COLORS.institutionBlack);
  assert.ok(whiteOnBlack >= 18.0, `White on black contrast ${whiteOnBlack} should be >= 18.0`);
  assert.equal(isAccessiblePair(BRAND_COLORS.evidenceWhite, BRAND_COLORS.institutionBlack, 'AAA'), true);

  const cyanOnBlack = getContrastRatio(BRAND_COLORS.controlCyan, BRAND_COLORS.institutionBlack);
  assert.ok(cyanOnBlack >= 9.5, `Cyan on black contrast ${cyanOnBlack} should be >= 9.5`);
  assert.equal(isAccessiblePair(BRAND_COLORS.controlCyan, BRAND_COLORS.institutionBlack, 'AA'), true);

  const tealOnBlack = getContrastRatio(BRAND_COLORS.evidenceTeal, BRAND_COLORS.institutionBlack);
  assert.ok(tealOnBlack >= 8.5, `Teal on black contrast ${tealOnBlack} should be >= 8.5`);
  assert.equal(isAccessiblePair(BRAND_COLORS.evidenceTeal, BRAND_COLORS.institutionBlack, 'AAA'), true);

  const amberOnBlack = getContrastRatio(BRAND_COLORS.decisionAmber, BRAND_COLORS.institutionBlack);
  assert.ok(amberOnBlack >= 8.0, `Amber on black contrast ${amberOnBlack} should be >= 8.0`);
  assert.equal(isAccessiblePair(BRAND_COLORS.decisionAmber, BRAND_COLORS.institutionBlack, 'AA'), true);

  const slateOnBlack = getContrastRatio(BRAND_COLORS.slate, BRAND_COLORS.institutionBlack);
  assert.ok(slateOnBlack >= 4.5, `Slate on black contrast ${slateOnBlack} should be >= 4.5`);
  assert.equal(isAccessiblePair(BRAND_COLORS.slate, BRAND_COLORS.institutionBlack, 'AA'), true);
});

test('brand semantic resolver handles theme switching', () => {
  assert.equal(resolveBrandColor('control', 'dark'), '#42C7E8');
  assert.equal(resolveBrandColor('evidence', 'dark'), '#24C4AD');
  assert.equal(resolveBrandColor('canvas', 'dark'), '#080C14');
  assert.equal(resolveBrandColor('canvas', 'light'), '#F5F7FA');
});

test('all required SVG master assets exist and are valid XML', () => {
  const svgFiles = [
    'aftergraph-monogram.svg',
    'aftergraph-monogram-mono.svg',
    'aftergraph-monogram-inverse.svg',
    'aftergraph-wordmark.svg',
    'aftergraph-wordmark-light.svg',
    'aftergraph-lockup-horizontal.svg',
    'aftergraph-lockup-horizontal-light.svg',
    'aftergraph-lockup-stacked.svg',
    'aftergraph-app-icon.svg',
    'aftergraph-social-banner.svg',
    'team-platform.svg',
    'team-research.svg',
    'team-security.svg',
    'team-intelligence.svg',
    'team-product.svg',
    'team-infrastructure.svg',
  ];

  for (const file of svgFiles) {
    const filePath = path.join(root, 'packages/brand/svg', file);
    assert.ok(existsSync(filePath), `Asset ${file} must exist`);
    const content = readFileSync(filePath, 'utf8');
    assert.match(content, /<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${file} must be valid SVG`);
    assert.match(content, /role="img"/, `${file} must include accessibility role`);
    assert.match(content, /aria-label="/, `${file} must include aria-label`);
  }
});

test('living shell packages/tokens directly dogfoods the official brand tokens', () => {
  assert.equal(TOKENS.color.institutionBlack, BRAND_COLORS.institutionBlack);
  assert.equal(TOKENS.color.graphMidnight, BRAND_COLORS.graphMidnight);
  assert.equal(TOKENS.color.controlCyan, BRAND_COLORS.controlCyan);
  assert.equal(TOKENS.color.evidenceTeal, BRAND_COLORS.evidenceTeal);
  assert.equal(TOKENS.color.authorityViolet, BRAND_COLORS.authorityViolet);
  assert.equal(TOKENS.color.decisionAmber, BRAND_COLORS.decisionAmber);
  assert.equal(TOKENS.color.canvas, '#080C14');
  assert.equal(TOKENS.color.canvasRaised, '#0E1630');
  assert.equal(TOKENS.color.accent, '#42C7E8');
  assert.equal(TOKENS.color.success, '#24C4AD');
  assert.equal(TOKENS.color.evidence, '#24C4AD');
  assert.equal(TOKENS.color.warning, '#F0A64A');
  assert.equal(TOKENS.color.attention, '#F0A64A');
  assert.equal(REEXPORTED_COLORS.institutionBlack, '#080C14');
});

test('styles/tokens.css defines official institutional brand variables', () => {
  const css = readFileSync(path.join(root, 'styles/tokens.css'), 'utf8');
  assert.match(css, /--ag-institution-black:\s*#080c14;/i);
  assert.match(css, /--ag-graph-midnight:\s*#0e1630;/i);
  assert.match(css, /--ag-evidence-white:\s*#f5f7fa;/i);
  assert.match(css, /--ag-control-cyan:\s*#42c7e8;/i);
  assert.match(css, /--ag-evidence-teal:\s*#24c4ad;/i);
  assert.match(css, /--ag-authority-violet:\s*#7759e8;/i);
  assert.match(css, /--ag-decision-amber:\s*#f0a64a;/i);
  assert.match(css, /--ag-system-blue:\s*#4c8bd8;/i);

  // Dark mode mappings
  assert.match(css, /html\[data-theme="dark"\][\s\S]*--bg:\s*#080c14;/);
  assert.match(css, /html\[data-theme="dark"\][\s\S]*--canvas:\s*#0e1630;/);
  assert.match(css, /html\[data-theme="dark"\][\s\S]*--accent:\s*#42c7e8;/);
  assert.match(css, /html\[data-theme="dark"\][\s\S]*--success:\s*#24c4ad;/);
});
