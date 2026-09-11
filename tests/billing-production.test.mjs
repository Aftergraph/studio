import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

test('offline billing read cache is namespaced by non-secret identity', () => {
  const app = read('src/billing/billing-app.mjs');
  assert.match(app, /cacheKeyForIdentity|cacheKeyForActor|identityCacheKey/);
  assert.doesNotMatch(app, /localStorage\.setItem\(CACHE_KEY\s*,/, 'a single global billing cache key can leak data across users');
});

test('billing API responses are explicitly non-cacheable by browsers and intermediaries', () => {
  const http = read('server/http-utils.mjs');
  assert.match(http, /cache-control/i);
  assert.match(http, /no-store/i);
});
