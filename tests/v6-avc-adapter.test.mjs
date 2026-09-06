import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvcManifest, projectAvcSnapshot } from '../src/integrations/avc.mjs';

test('AVC manifest exposes venture and agent objects without borrowing UI authority',()=>{const m=createAvcManifest({repositoryRevision:'sha-avc'});assert.equal(m.repository,'Aftergraph/autonomous-venture-company');assert.ok(m.objects.includes('agent'));assert.ok(m.objects.includes('product_cell'));assert.equal(m.authority[0].owner,'avc')});
test('AVC snapshot projects stable typed objects',()=>{const p=projectAvcSnapshot({revision:'sha-avc',agents:[{id:'ag1',name:'Hermes',status:'active'}],missions:[{id:'m1',status:'RUNNING'}],productCells:[{id:'pc1',status:'active'}],incidents:[{id:'i1',status:'open'}]});assert.equal(p.objects.length,4);assert.equal(p.objects.find(x=>x.type==='agent').graphId,'avc:agent:ag1');assert.equal(p.objects.find(x=>x.type==='mission').canonicalOwner,'avc')});
test('AVC projection does not convert evidence into approval',()=>{const p=projectAvcSnapshot({revision:'sha',evidence:[{id:'e1',method:'verifier',status:'verified'}]});const e=p.evidence[0];assert.equal(e.owner,'avc');assert.equal(e.class,'venture-runtime');assert.equal(e.authority,undefined)});
test('AVC missing revision fails closed',()=>assert.throws(()=>projectAvcSnapshot({agents:[]}),/revision/));
