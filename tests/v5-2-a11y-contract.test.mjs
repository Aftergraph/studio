import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync,readFileSync } from 'node:fs';

test('release contains local test-only accessibility gate and axe bundle',()=>{
  assert.equal(existsSync(new URL('../scripts/a11y_smoke.py',import.meta.url)),true);
  assert.equal(existsSync(new URL('../scripts/vendor/axe.min.js',import.meta.url)),true);
  assert.equal(existsSync(new URL('../scripts/vendor/AXE-LICENSE.txt',import.meta.url)),true);
});

test('production index does not load axe',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/axe(?:\.min)?\.js/i);
});
