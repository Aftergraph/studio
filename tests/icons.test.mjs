import test from 'node:test';
import assert from 'node:assert/strict';
import { icon } from '../src/icons.mjs';

test('icon renderer returns accessible-hidden svg instead of emoji glyphs', () => {
  const html = icon('chat');
  assert.match(html, /^<svg /);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /[😀-🙏]/u);
});
