import test from 'node:test';
import assert from 'node:assert/strict';
import { createObjectGraph } from '../src/federation/object-graph.mjs';
import { createEnvelope } from '../src/federation/object-envelope.mjs';
import { createSurfaceRegistry } from '../src/federation/surface-registry.mjs';
import { createUniversalSpace } from '../src/federation/universal-space.mjs';
function graph(){const g=createObjectGraph();g.upsert(createEnvelope({sourceIntegration:'works',type:'work',canonicalId:'w1',canonicalOwner:'works',status:'RUNNING',freshness:'current',payload:{title:'Deploy'},sourceRevision:'sha'}));g.upsert(createEnvelope({sourceIntegration:'isr',type:'claim',canonicalId:'c1',canonicalOwner:'isr',status:'validated',freshness:'stale',payload:{title:'Finding'},sourceRevision:'sha2'}));return g}
function surfaces(){const s=createSurfaceRegistry();s.register({id:'work-detail',sourceIntegration:'works',objectTypes:['work'],renderer:'work'});s.register({id:'research-claim',sourceIntegration:'isr',objectTypes:['claim'],renderer:'research'});return s}
test('Universal Space keeps canonical graph identity when object is docked',()=>{const u=createUniversalSpace({objectGraph:graph(),surfaceRegistry:surfaces()});const x=u.open({graphId:'works:work:w1',surfaceId:'work-detail',regionId:'primary'});assert.equal(x.object.graphId,'works:work:w1');assert.equal(x.object.canonicalOwner,'works')});
test('moving a surface never duplicates or mutates underlying object',()=>{const g=graph(),u=createUniversalSpace({objectGraph:g,surfaceRegistry:surfaces()});u.open({graphId:'works:work:w1',surfaceId:'work-detail',regionId:'primary'});u.move('surface:works:work:w1','detail');assert.equal(g.list().length,2);assert.equal(g.get('works:work:w1').canonicalOwner,'works')});
test('stale object remains visibly stale in Space',()=>{const u=createUniversalSpace({objectGraph:graph(),surfaceRegistry:surfaces()});const x=u.open({graphId:'isr:claim:c1',surfaceId:'research-claim',regionId:'detail'});assert.equal(x.object.freshness,'stale')});
test('surface incompatible with object type fails closed',()=>{const u=createUniversalSpace({objectGraph:graph(),surfaceRegistry:surfaces()});assert.throws(()=>u.open({graphId:'isr:claim:c1',surfaceId:'work-detail'}),/does not support object type/)});
test('surface itself carries no authority',()=>{const u=createUniversalSpace({objectGraph:graph(),surfaceRegistry:surfaces()});const x=u.open({graphId:'works:work:w1',surfaceId:'work-detail'});assert.equal(x.surface.authority,'none')});
