import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkIntelligenceWebManifest, donatedConnectSurfaces, projectConnectState } from '../src/integrations/work-intelligence-web.mjs';

test('WI Web is presentation-only and never canonical Work Intelligence state',()=>{const m=createWorkIntelligenceWebManifest({repositoryRevision:'sha-web'});assert.ok(m.roles.includes('presentation'));assert.equal(m.authority.length,0);assert.equal(m.objects.length,0)});
test('connect surfaces include live workspace providers and mark Keep preview-only',()=>{const s=donatedConnectSurfaces();assert.equal(s.find(x=>x.id==='gmail').mode,'live');assert.equal(s.find(x=>x.id==='keep').mode,'preview-only')});
test('backend failure never silently enables preview fixtures',()=>{const p=projectConnectState({backend:'unavailable',providers:[{id:'gmail',connected:true}]});assert.equal(p.mode,'degraded');assert.equal(p.fixturesEnabled,false);assert.equal(p.providers[0].connected,false)});
test('browser projection contains no backend bearer token field',()=>{const p=projectConnectState({backend:'current',providers:[{id:'drive',connected:true}],backendToken:'secret'});assert.equal(JSON.stringify(p).includes('secret'),false);assert.equal('backendToken' in p,false)});
test('approval remains distinct from execution or publication',()=>{const p=projectConnectState({backend:'current',review:{status:'approved'}});assert.equal(p.review.status,'approved');assert.equal(p.review.executionStatus,'not-executed');assert.equal(p.review.publicationStatus,'not-published')});
