import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSkillOwner, projectSkillCapability } from '../src/integrations/skills-vault.mjs';
test('AVC canonical skill prefixes remain AVC-owned',()=>assert.equal(canonicalSkillOwner({name:'avc-deploy'}),'avc'));
test('curated generic skills remain Skills Vault-owned',()=>assert.equal(canonicalSkillOwner({name:'systematic-debugging'}),'skills-vault'));
test('skill projection never grants authority',()=>{const c=projectSkillCapability({name:'research',description:'Research things'});assert.equal(c.source,'skills-vault');assert.equal(c.granted,false);assert.deepEqual(c.authority,[])})
