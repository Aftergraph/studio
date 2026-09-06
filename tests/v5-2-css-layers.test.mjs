import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const layers=['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css'];

test('V5.2 loads the seven local CSS layers and no legacy stylesheets',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  for(const layer of layers){
    assert.equal(existsSync(new URL(`../styles/${layer}`,import.meta.url)),true,layer);
    assert.match(html,new RegExp(`/styles/${layer.replace('.','\\.')}`));
  }
  assert.doesNotMatch(html,/href="\/(styles\.css|v4\.css|v5\.css)"/);
});

test('legacy CSS files are absent after measured parity migration',()=>{
  for(const file of ['styles.css','v4.css','v5.css'])assert.equal(existsSync(new URL(`../${file}`,import.meta.url)),false,file);
});
