import test from 'node:test';
import assert from 'node:assert/strict';
import { searchIndex } from '../src/search.mjs';

const docs = [
  { id:'m_1', type:'mission', title:'Deploy production release', domain:'work' },
  { id:'a_1', type:'approval', title:'Production deploy approval', domain:'control' },
  { id:'art_1', type:'artifact', title:'release-evidence.json', domain:'output' },
];

test('prefix search finds identifiers and ranks exact prefix first', () => {
  const results = searchIndex(docs, 'a_');
  assert.equal(results[0].id, 'a_1');
});

test('fuzzy token search finds semantically adjacent words by token overlap', () => {
  const results = searchIndex(docs, 'deploy production');
  assert.deepEqual(results.slice(0,2).map(x => x.id), ['m_1','a_1']);
});
