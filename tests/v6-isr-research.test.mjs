import test from 'node:test';
import assert from 'node:assert/strict';
import { createIsrManifest, projectResearchSnapshot, createPromotionProposal } from '../src/integrations/isr.mjs';

test('ISR manifest is research-only and owns no runtime execution',()=>{const m=createIsrManifest({repositoryRevision:'sha-isr'});assert.ok(m.roles.includes('research'));assert.equal(m.authority.some(a=>a.operations?.includes('execute')),false);assert.ok(m.objects.includes('claim'));assert.ok(m.objects.includes('experiment'))});
test('research claims retain evidence method and limitations',()=>{const p=projectResearchSnapshot({revision:'sha',claims:[{id:'C-1',status:'validated',evidenceIds:['E-1']}],evidence:[{id:'E-1',method:'deterministic-testbed',limitations:['simulated'],verified:true}]});const e=p.evidence[0];assert.equal(e.owner,'isr');assert.equal(e.class,'scientific');assert.deepEqual(e.limitations,['simulated']);assert.equal(p.objects[0].authority.length,0)});
test('ResearchEvidenceNeverBecomesRuntimeAuthority',()=>{const p=projectResearchSnapshot({revision:'sha',claims:[{id:'C-1',status:'validated'}]});assert.deepEqual(p.objects[0].authority,[])});
test('promotion creates proposal only, never a runtime grant',()=>{const x=createPromotionProposal({claimId:'C-1',target:'aie',actor:'human:1',reason:'candidate spec'});assert.equal(x.kind,'research-promotion-proposal');assert.equal(x.status,'proposed');assert.equal(x.runtimeAuthority,'none');assert.equal(x.requiresHumanApproval,true)});
test('promotion requires explicit human actor',()=>assert.throws(()=>createPromotionProposal({claimId:'C-1',target:'aie'}),/actor/));
