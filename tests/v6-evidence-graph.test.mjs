import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidenceGraph } from '../src/federation/evidence-graph.mjs';

test('EvidenceProvenanceNeverMutatesThroughComposition',()=>{const g=createEvidenceGraph();g.registerEvidence({id:'isr:E-1',owner:'isr',class:'scientific',method:'deterministic-testbed',integrity:{sha256:'abc'},limitations:['simulated']});g.linkEvidence('works:work:wrk_1','isr:E-1');assert.deepEqual(g.getEvidence('isr:E-1').limitations,['simulated']);assert.equal(g.getEvidence('isr:E-1').owner,'isr')});
test('evidence records are deeply immutable',()=>{const g=createEvidenceGraph();const e=g.registerEvidence({id:'tg:a1',owner:'tg',class:'runtime',method:'audit-chain',integrity:{sha256:'abc'},limitations:[]});assert.equal(Object.isFrozen(e),true);assert.equal(Object.isFrozen(e.integrity),true);assert.throws(()=>{e.integrity.sha256='def'},TypeError)});
test('linking unknown evidence fails closed',()=>{const g=createEvidenceGraph();assert.throws(()=>g.linkEvidence('works:work:1','missing'),/unknown evidence/)});
test('duplicate evidence id with changed provenance is rejected',()=>{const g=createEvidenceGraph();g.registerEvidence({id:'isr:E-1',owner:'isr',class:'scientific',method:'simulation'});assert.throws(()=>g.registerEvidence({id:'isr:E-1',owner:'works',class:'execution',method:'runtime'}),/provenance conflict/)});
test('stale evidence never appears newly verified',()=>{const g=createEvidenceGraph();g.registerEvidence({id:'works:e1',owner:'works',class:'execution',method:'verifier',freshness:'stale',verified:true});g.linkEvidence('works:work:w1','works:e1');const x=g.evidenceFor('works:work:w1')[0];assert.equal(x.freshness,'stale');assert.equal(g.isFreshVerified('works:e1'),false)});
