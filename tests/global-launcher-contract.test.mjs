import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/app/bootstrap.mjs', import.meta.url), 'utf8');

test('Studio command palette exposes the canonical Aftergraph Launcher', () => {
  assert.match(source, /id:'aftergraph-launcher',kind:'command'/);
  assert.match(source, /title:'Aftergraph Launcher'/);
  assert.match(source, /https:\/\/aftergraph\.org\/launch/);
});

test('Studio keeps its local Cmd\/Ctrl-K palette ownership', () => {
  assert.match(source, /mod&&event\.key\.toLowerCase\(\)==='k'/);
  assert.doesNotMatch(source, /aftergraph-launcher[^\n]+shortcut:'⌘K'/);
});
