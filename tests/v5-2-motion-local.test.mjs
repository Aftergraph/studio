import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {motionFor,animateElement,morphSurface} from '../packages/motion/index.mjs';

test('production motion source has no remote runtime dependency',()=>{
 const src=readFileSync(new URL('../packages/motion/index.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/https?:\/\/|esm\.sh|import\s*\(\s*['"]https?:/);
});

test('reduced motion preserves final state with zero duration',()=>{
 assert.equal(motionFor('surface.expand',{reduced:true}).duration,0);
 const style={};const el={style};
 assert.equal(animateElement(el,[{opacity:0},{opacity:1,transform:'none'}],'surface.expand',{reduced:true}),null);
 assert.equal(style.opacity,1);assert.equal(style.transform,'none');
});

test('surface morph stays local and returns WAAPI animation when available',()=>{
 let called=false;const el={style:{},animate(frames,opts){called=true;return{frames,opts}}};
 const result=morphSurface(el,{from:{opacity:.2},to:{opacity:1}});
 assert.equal(called,true);assert.ok(result);
});
