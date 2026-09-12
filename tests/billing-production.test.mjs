import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { serializeJson } from '../server/http-utils.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('billing shell precaches every first-party module required for first offline launch', () => {
  const sw = read('billing/sw.js');
  assert.match(sw, /\/src\/billing\/app-state\.mjs/);
});

test('service worker never persists user-specific billing API responses', () => {
  const sw = read('billing/sw.js');
  const start = sw.indexOf("pathname.startsWith('/api/v1/billing')");
  const end = sw.indexOf("request.mode === 'navigate'", start);
  const apiBranch = sw.slice(start, end);
  assert.ok(start >= 0 && end > start, 'billing API branch must exist');
  assert.doesNotMatch(apiBranch, /cache\.put\s*\(/, 'authenticated billing responses must not enter shared Cache Storage');
});

test('legacy billing route redirects through a self-hosted CSP-safe script', () => {
  const html = read('billing.html');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, 'inline redirect scripts violate Studio CSP');
  assert.match(html, /src=["']\/src\/billing\/legacy-redirect\.mjs["']/);

  const redirect = read('src/billing/legacy-redirect.mjs');
  assert.match(redirect, /new URL\(['"]\/billing\/['"],\s*location\.origin\)/);
  assert.match(redirect, /target\.search\s*=\s*location\.search/);
  assert.match(redirect, /target\.hash\s*=\s*location\.hash/);
});

test('billing never persists customer or invoice state in browser storage', () => {
  const app = read('src/billing/billing-app.mjs');
  assert.doesNotMatch(app, /READ_CACHE_PREFIX|writeReadCache|readReadCache|sanitizeBillingForCache/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^,]+,\s*JSON\.stringify\(/, 'billing payloads must remain memory-only');
});

test('offline Billing disables the company settings write surface', () => {
  const app = read('src/billing/billing-app.mjs');
  assert.match(app, /companySettings:\s*\$\('\[data-action="company-settings"\]'\)/);
  assert.match(app, /els\.companySettings\.disabled\s*=\s*!canMutate\(\)/);
});

test('billing API responses are explicitly non-cacheable and JSON output is HTML-safe', () => {
  const http = read('server/http-utils.mjs');
  assert.match(http, /cache-control/i);
  assert.match(http, /no-store/i);
  const payload = { error: '<img src=x onerror=alert(1)>&problem' };
  const serialized = serializeJson(payload);
  assert.doesNotMatch(serialized, /[<>&]/);
  assert.deepEqual(JSON.parse(serialized), payload);
});

test('connectivity loss synchronously re-renders financial controls before refresh', () => {
  const app = read('src/billing/billing-app.mjs');
  assert.match(app, /billing-connectivity[\s\S]{0,300}state\.online\s*=\s*event\.detail\?\.online\s*!==\s*false;[\s\S]{0,120}render\(\);[\s\S]{0,120}if \(state\.online !== wasOnline\) void refresh\(\)/);
});

test('offline render disables stale financial action nodes already present in the DOM', () => {
  const app = read('src/billing/billing-app.mjs');
  assert.match(app, /const financialActions = \$\$\(/);
  assert.match(app, /data-action="deliver"/);
  assert.match(app, /financialActions[\s\S]{0,500}button\.disabled\s*=\s*!canMutate\(\)/);
});
