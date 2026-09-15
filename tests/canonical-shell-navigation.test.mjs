import test from 'node:test';
import assert from 'node:assert/strict';
import { PRIMARY_MODES, MOBILE_PRIMARY_MODES, SIDEBAR_DESTINATIONS, canonicalDomainForNav } from '../src/workspace-shell.mjs';

test('desktop primary modes preserve Chat Work Space',()=>{
  assert.deepEqual(PRIMARY_MODES.map(item=>item.id),['chat','work','space']);
});

test('mobile primary modes are exactly Chat and Work',()=>{
  assert.deepEqual(MOBILE_PRIMARY_MODES.map(item=>item.id),['chat','work']);
});

test('canonical sidebar collects contextual destinations in one shell',()=>{
  const ids=SIDEBAR_DESTINATIONS.map(item=>item.id);
  for(const id of ['space','projects','billing','plugins','remote','settings']) assert.ok(ids.includes(id),id);
  assert.equal(canonicalDomainForNav('plugins'),'connect');
  assert.equal(canonicalDomainForNav('settings'),'system');
  assert.equal(canonicalDomainForNav('billing'),'work');
});
