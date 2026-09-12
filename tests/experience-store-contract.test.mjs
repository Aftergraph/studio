import test from 'node:test';
import assert from 'node:assert/strict';
import { assertExperienceStore, EXPERIENCE_STORE_METHODS } from '../src/persistence/experience-store-contract.mjs';

test('experience store contract is closed and future-driver compatible',()=>{
  assert.deepEqual(EXPERIENCE_STORE_METHODS,[
    'init','read','write','readEvents','pruneEventsThrough',
    'integrityCheck','diagnostics','backup','close',
  ]);
  const candidate=Object.fromEntries(EXPERIENCE_STORE_METHODS.map(name=>[name,async()=>{}]));
  assert.equal(assertExperienceStore(candidate),candidate);
  assert.throws(()=>assertExperienceStore({}),/read|store/i);
});
