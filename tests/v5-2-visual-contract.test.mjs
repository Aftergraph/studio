import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract=JSON.parse(readFileSync(new URL('../scripts/visual-contract.json',import.meta.url),'utf8'));

test('visual parity contract has fixed measured thresholds',()=>{
  assert.equal(contract.thresholds.ssim_min,0.995);
  assert.equal(contract.thresholds.changed_pixel_ratio_max,0.005);
  assert.equal(contract.thresholds.channel_ignore_threshold,12);
});

test('visual parity contract includes canonical reference viewports',()=>{
  assert.deepEqual(contract.viewports.map(v=>[v.width,v.height]),[[1440,1000],[1280,800],[390,844]]);
  assert.deepEqual(contract.views.desktop,['chat','work','space','system','control']);
  assert.deepEqual(contract.views.mobile,['chat','work','space']);
});
