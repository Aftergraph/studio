import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/auth/rate-limit.mjs';

test('allows bursts under the cap', () => {
  const limiter = createRateLimiter({ maxHits: 3, windowMs: 60_000, now: () => 1000 });
  assert.ok(limiter.hit('ip-1').allowed);
  assert.ok(limiter.hit('ip-1').allowed);
  assert.ok(limiter.hit('ip-1').allowed);
  assert.equal(limiter.hit('ip-1').allowed, false, 'fourth hit rejected');
});

test('window slides and keys are isolated', () => {
  let now = 0;
  const limiter = createRateLimiter({ maxHits: 1, windowMs: 1000, now: () => now });
  assert.ok(limiter.hit('a').allowed);
  assert.equal(limiter.hit('b').allowed, true, 'other key unaffected');
  assert.equal(limiter.hit('a').allowed, false);
  now = 1001;
  assert.ok(limiter.hit('a').allowed, 'window slid');
});

test('reports retry-after seconds', () => {
  const limiter = createRateLimiter({ maxHits: 1, windowMs: 60_000, now: () => 0 });
  limiter.hit('x');
  const rejected = limiter.hit('x');
  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterSec >= 59 && rejected.retryAfterSec <= 60);
});
