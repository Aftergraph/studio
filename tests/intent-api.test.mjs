import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(provider,fn){
  const dir=await mkdtemp(join(tmpdir(),'aftergraph-intent-'));
  const server=createAppServer({
    root:new URL('../',import.meta.url),
    stateFile:join(dir,'ws.json'),
    runtimeIntervalMs:20,
    intentProvider:provider,
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await fn(server.address().port); }
  finally {
    await new Promise(resolve=>server.close(resolve));
    await rm(dir,{recursive:true,force:true});
  }
}
async function compile(port,body){
  const response=await fetch(`http://127.0.0.1:${port}/api/v1/intent/compile`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
  });
  return {status:response.status,json:await response.json()};
}

test('valid rough thought returns canonical IR target and artifact',async()=>{
  const provider={analyze:async()=>({goal:{statement:'Review Relay'},constraints:['Do not merge']})};
  await withServer(provider,async port=>{
    const result=await compile(port,{source:'review relay but do not merge',target:'auto'});
    assert.equal(result.status,200);
    assert.equal(result.json.ir.schema,'aftergraph/intent-ir/v0.1');
    assert.equal(result.json.ir.source.text,'review relay but do not merge');
    assert.equal(result.json.artifact.mediaType,'text/plain');
    assert.ok(result.json.artifact.content.includes('Do not merge'));
  });
});
test('empty source fails closed with source_required',async()=>{
  const provider={analyze:async()=>{throw new Error('provider should not run')}};
  await withServer(provider,async port=>{
    const result=await compile(port,{source:'   ',target:'auto'});
    assert.equal(result.status,422);
    assert.equal(result.json.error,'source_required');
  });
});
test('provider failure becomes 502 without echoing source',async()=>{
  const provider={analyze:async()=>{const error=new Error('boom');error.code='provider_request_failed';throw error;}};
  await withServer(provider,async port=>{
    const result=await compile(port,{source:'rough source text',target:'auto'});
    assert.equal(result.status,502);
    assert.equal(result.json.error,'provider_request_failed');
    assert.equal(JSON.stringify(result.json).includes('rough source text'),false);
  });
});
test('manual target override is respected',async()=>{
  const provider={analyze:async()=>({goal:{statement:'Refactor module'},targetHints:['aftergraph.hermes']})};
  await withServer(provider,async port=>{
    const result=await compile(port,{source:'refactor this module',target:'openai.codex'});
    assert.equal(result.status,200);
    assert.equal(result.json.target.target,'openai.codex');
    assert.equal(result.json.artifact.target,'openai.codex');
  });
});
test('ambiguity is returned as findings instead of hidden',async()=>{
  const provider={analyze:async()=>({goal:{statement:'Preserve behavior'},ambiguities:['Persistence is unclear']})};
  await withServer(provider,async port=>{
    const result=await compile(port,{source:'make this permanent maybe',target:'auto'});
    assert.equal(result.status,200);
    assert.ok(result.json.findings.some(finding=>finding.code==='AMBIGUITY'));
    assert.deepEqual(result.json.ir.ambiguities,['Persistence is unclear']);
  });
});
test('refinement changes artifact while preserving authority',async()=>{
  const provider={analyze:async()=>({goal:{statement:'Finish the task'},authority:{write:[],execute:[]}})};
  await withServer(provider,async port=>{
    const result=await compile(port,{source:'finish this properly',target:'generic',refinement:'more-autonomous'});
    assert.equal(result.status,200);
    assert.match(result.json.artifact.content,/independently within the granted authority/i);
    assert.deepEqual(result.json.artifact.authorityBefore,result.json.artifact.authorityAfter);
    assert.deepEqual(result.json.ir.authority.write,[]);
    assert.deepEqual(result.json.ir.authority.execute,[]);
  });
});
