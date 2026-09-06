import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMAINS, resolveDomain, domainForObject } from '../src/domain.mjs';
import { parseDeepLink, buildDeepLink } from '../src/router.mjs';

test('canonical domain order is stable', () => {
  assert.deepEqual(DOMAINS.map(d => d.id), ['now','chat','work','agents','brain','research','capabilities','output','control','connect','system']);
});

test('legacy aliases resolve to canonical domains', () => {
  assert.equal(resolveDomain('history'), 'output');
  assert.equal(resolveDomain('builder'), 'work');
  assert.equal(resolveDomain('integrations'), 'connect');
});

test('object types map to owning domains', () => {
  assert.equal(domainForObject('approval'), 'control');
  assert.equal(domainForObject('artifact'), 'output');
  assert.equal(domainForObject('mission'), 'work');
});

test('deep links round-trip canonical object identity', () => {
  const href = buildDeepLink('CONTROL', 'approval', 'apr_42');
  assert.equal(href, '/d/CONTROL/o/approval/apr_42');
  assert.deepEqual(parseDeepLink(href), { domain: 'control', type: 'approval', id: 'apr_42' });
});
