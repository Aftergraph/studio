import test from 'node:test';
import assert from 'node:assert/strict';
import { createFederatedIndex } from '../src/search/federated-index.mjs';
function obj(id,type,source,payload,freshness='current',tenantId='t1'){return {graphId:`${source}:${type}:${id}`,canonicalId:id,type,sourceIntegration:source,canonicalOwner:source,payload,freshness,tenantId}}
test('search returns provenance and freshness with every result',()=>{const x=createFederatedIndex();x.index(obj('w1','work','works',{title:'Deploy API'}));const r=x.search('deploy',{tenantId:'t1'});assert.equal(r.results[0].sourceIntegration,'works');assert.equal(r.results[0].freshness,'current')});
test('SearchReportsIncompleteCoverageDuringOutage',()=>{const x=createFederatedIndex();x.setCoverage('works','current');x.setCoverage('isr','unavailable');const r=x.search('anything',{tenantId:'t1'});assert.equal(r.complete,false);assert.deepEqual(r.unavailable,['isr'])});
test('tenant filter prevents cross-tenant search leakage',()=>{const x=createFederatedIndex();x.index(obj('a','work','works',{title:'Secret A'},'current','t1'));x.index(obj('b','work','works',{title:'Secret B'},'current','t2'));const r=x.search('secret',{tenantId:'t1'});assert.equal(r.results.length,1);assert.equal(r.results[0].canonicalId,'a')});
test('stale objects are labeled stale, never upgraded by search',()=>{const x=createFederatedIndex();x.index(obj('w1','work','works',{title:'Deploy'},'stale'));assert.equal(x.search('deploy',{tenantId:'t1'}).results[0].freshness,'stale')});
test('empty query returns no accidental global dump',()=>{const x=createFederatedIndex();x.index(obj('w1','work','works',{title:'Deploy'}));assert.deepEqual(x.search('',{tenantId:'t1'}).results,[])});
