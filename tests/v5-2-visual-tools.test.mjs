import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('visual capture and diff tools are release-local',()=>{
  assert.equal(existsSync(new URL('../scripts/capture_v5_2_visuals.py',import.meta.url)),true);
  assert.equal(existsSync(new URL('../scripts/visual_diff.py',import.meta.url)),true);
});

test('visual diff accepts identical images and rejects material drift',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ag-v52-visual-'));
  const make=`from PIL import Image
import sys
Image.new('RGB',(20,20),(10,20,30)).save(sys.argv[1])
Image.new('RGB',(20,20),(10,20,30)).save(sys.argv[2])
Image.new('RGB',(20,20),(240,240,240)).save(sys.argv[3])
`;
  const py=join(dir,'make.py');writeFileSync(py,make);
  const a=join(dir,'a.png'),b=join(dir,'b.png'),c=join(dir,'c.png');
  assert.equal(spawnSync('python',[py,a,b,c]).status,0);
  const out=join(dir,'result.json');
  const script=fileURLToPath(new URL('../scripts/visual_diff.py',import.meta.url));
  const same=spawnSync('python',[script,a,b,'--json',out],{encoding:'utf8'});
  assert.equal(same.status,0,same.stderr||same.stdout);
  const report=JSON.parse(readFileSync(out,'utf8'));
  assert.equal(report.pass,true);assert.equal(report.changed_pixel_ratio,0);
  const drift=spawnSync('python',[script,a,c,'--json',out],{encoding:'utf8'});
  assert.notEqual(drift.status,0);
});
