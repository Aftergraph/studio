import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrieRouter } from '../server/trie-router.mjs';

describe('TrieRouter correctness and security', () => {
  it('static segment takes precedence over param wildcard (LIFO fix)', () => {
    const router = new TrieRouter();
    router.add('GET', '/items/:id', () => 'param');
    router.add('GET', '/items/fixed', () => 'static');

    const match = router.find('GET', '/items/fixed');
    assert.ok(match, 'should match /items/fixed');
    assert.equal(match.handler(), 'static', 'static route must win over param');
    assert.deepEqual(match.params, {}, 'static match should have no params');
  });

  it('param wildcard still matches when no static segment exists', () => {
    const router = new TrieRouter();
    router.add('GET', '/items/:id', () => 'param');

    const match = router.find('GET', '/items/123');
    assert.ok(match);
    assert.equal(match.handler(), 'param');
    assert.equal(match.params.id, '123');
  });

  it('/constructor/x does not crash via inherited Object.prototype.children', () => {
    const router = new TrieRouter();
    router.add('GET', '/:ns/:id', () => 'ok');

    // Must not throw or return a non-node truthy value
    const match = router.find('GET', '/constructor/x');
    assert.ok(match);
    assert.equal(match.handler(), 'ok');
    assert.equal(match.params.ns, 'constructor');
    assert.equal(match.params.id, 'x');
  });

  it('/__proto__/x does not pollute prototype chain', () => {
    const router = new TrieRouter();
    router.add('GET', '/:a/:b', () => 'safe');

    const match = router.find('GET', '/__proto__/polluted');
    assert.ok(match);
    assert.equal(match.handler(), 'safe');
    assert.equal(match.params.a, '__proto__');
    assert.equal(match.params.b, 'polluted');
  });

  it('malformed percent encoding returns null instead of throwing', () => {
    const router = new TrieRouter();
    router.add('GET', '/items/:id', () => 'decoded');

    // %ZZ is invalid hex; decodeURIComponent throws URIError
    const match = router.find('GET', '/items/%ZZ');
    assert.equal(match, null, 'invalid percent encoding must not crash or match');
  });

  it('valid percent encoding is decoded in params', () => {
    const router = new TrieRouter();
    router.add('GET', '/items/:id', () => 'decoded');

    const match = router.find('GET', '/items/hello%20world');
    assert.ok(match);
    assert.equal(match.params.id, 'hello world');
  });

  it('method mismatch returns null', () => {
    const router = new TrieRouter();
    router.add('GET', '/items', () => 'get');

    assert.equal(router.find('POST', '/items'), null);
    assert.ok(router.find('GET', '/items'));
  });

  it('trailing slash is ignored (slash semantics)', () => {
    const router = new TrieRouter();
    router.add('GET', '/items', () => 'no-slash');

    const a = router.find('GET', '/items');
    const b = router.find('GET', '/items/');
    assert.ok(a);
    assert.ok(b);
    assert.equal(a.handler(), b.handler());
  });

  it('leading slash is ignored', () => {
    const router = new TrieRouter();
    router.add('GET', '/items', () => 'ok');

    assert.ok(router.find('GET', 'items'));
  });

  it('multiple params are captured correctly', () => {
    const router = new TrieRouter();
    router.add('GET', '/orgs/:org/repos/:repo', () => 'multi');

    const match = router.find('GET', '/orgs/acme/repos/widget');
    assert.ok(match);
    assert.equal(match.params.org, 'acme');
    assert.equal(match.params.repo, 'widget');
  });

  it('static + param coexistence at same level with correct fallback', () => {
    const router = new TrieRouter();
    router.add('GET', '/users/me', () => 'me');
    router.add('GET', '/users/:id', () => 'id');

    const meMatch = router.find('GET', '/users/me');
    assert.equal(meMatch.handler(), 'me');
    assert.deepEqual(meMatch.params, {});

    const idMatch = router.find('GET', '/users/42');
    assert.equal(idMatch.handler(), 'id');
    assert.equal(idMatch.params.id, '42');
  });
});
