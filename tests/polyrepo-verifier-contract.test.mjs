import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('release verifier covers every polyrepo integration module and exact-head source-truth gate',async()=>{
  const verify=await readFile(new URL('../scripts/verify.mjs',import.meta.url),'utf8');
  for(const module of ['http-json.mjs','trust-gateway.mjs','works.mjs','aie.mjs','work-intelligence.mjs','governance.mjs','upstream-hub.mjs','source-truth.mjs']){
    assert.match(verify,new RegExp(module.replaceAll('.','\\.')));
  }
  assert.match(verify,/UPSTREAM-MANIFEST\.json/);
  assert.match(verify,/work-intelligence-boundary-1\.0\.json/);
  assert.match(verify,/validateSourceTruthBundle/);
});
