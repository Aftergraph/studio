import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('server root is composition-only',()=>{
 const src=read('server.mjs');const nonblank=src.split(/\r?\n/).filter(x=>x.trim()).length;
 assert.ok(nonblank<=100,`server root nonblank lines ${nonblank}`);
 assert.doesNotMatch(src,/\/api\/v1\/(?:approvals|missions|spaces|upstreams|conversations)/);
 assert.match(src,/createAppServer/);
});

test('server responsibilities have explicit modules',()=>{
 for(const p of ['server/app-server.mjs','server/http-utils.mjs','server/static-handler.mjs','server/api-router.mjs','server/sse-broker.mjs','server/workspace-routes.mjs','server/mission-routes.mjs','server/approval-routes.mjs','server/space-routes.mjs','server/upstream-routes.mjs']) assert.equal(existsSync(new URL(`../${p}`,import.meta.url)),true,p);
});
