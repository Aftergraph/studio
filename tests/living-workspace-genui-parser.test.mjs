import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeneratedUIParser, normalizeGeneratedFrame } from '../src/genui/parser-adapter.mjs';
import { AGGenUIError } from '../src/genui/component-registry.mjs';

test('parser withholds partial generated UI until a complete structured boundary exists',()=>{
  const parser=createGeneratedUIParser();
  const a=parser.push('{"componentId":"EvidenceSummary",');
  assert.equal(a.status,'incomplete');
  const b=parser.push('"version":"1.0.0","props":{"title":"Evidence","count":4}}');
  assert.equal(b.status,'complete');
  assert.equal(b.node.componentId,'EvidenceSummary');
  assert.deepEqual(b.node.props,{title:'Evidence',count:4});
});

test('parser rejects raw html and unknown top-level fields',()=>{
  assert.throws(()=>normalizeGeneratedFrame({componentId:'X',version:'1',props:{},html:'<button>deploy</button>'}),error=>error instanceof AGGenUIError&&error.code==='generated_frame_invalid');
  assert.throws(()=>normalizeGeneratedFrame({componentId:'X',version:'1',props:{},endpoint:'/admin'}),error=>error.code==='generated_frame_invalid');
});

test('parser enforces a bounded stream and malformed final payload fails closed',()=>{
  const parser=createGeneratedUIParser({maxBytes:40});
  assert.throws(()=>parser.push('x'.repeat(41)),error=>error.code==='generated_frame_too_large');
  const broken=createGeneratedUIParser();
  broken.push('{"componentId":');
  assert.throws(()=>broken.finish(),error=>error.code==='generated_frame_parse_failed');
});
