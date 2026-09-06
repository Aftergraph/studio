import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRegistry } from '../src/federation/capability-registry.mjs';

test('CapabilityDiscoveryNeverEqualsCapabilityGrant',()=>{const r=createCapabilityRegistry();r.register({id:'skill:research',source:'skills-vault',discoverable:true,requiresAuthority:['research.execute']});assert.equal(r.discover('research').length,1);assert.equal(r.grantStatus({id:'agent:1'},'skill:research'),'not-granted')});
test('explicit resolver is required for grant',()=>{const r=createCapabilityRegistry({resolveGrant:(subject,cap)=>subject.id==='agent:1'&&cap.id==='skill:research'});r.register({id:'skill:research',source:'skills-vault',discoverable:true});assert.equal(r.grantStatus({id:'agent:1'},'skill:research'),'granted');assert.equal(r.eligibleFor({id:'agent:2'},'skill:research'),false)});
test('hidden capability is not discoverable',()=>{const r=createCapabilityRegistry();r.register({id:'secret:rotate',source:'tg',discoverable:false});assert.deepEqual(r.discover('rotate'),[])});
test('duplicate capability id with different source is rejected',()=>{const r=createCapabilityRegistry();r.register({id:'skill:x',source:'skills-vault'});assert.throws(()=>r.register({id:'skill:x',source:'avc'}),/conflict/)});
test('unknown capability is not granted',()=>{const r=createCapabilityRegistry({resolveGrant:()=>true});assert.equal(r.grantStatus({id:'a'},'missing'),'not-granted')});
