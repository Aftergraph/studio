#!/usr/bin/env python3
"""Measured screenshot parity gate for Aftergraph V5.2.

Compares either two PNG files or two directories containing matching PNGs.
Exit 0 means every image satisfies both SSIM and changed-pixel thresholds.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image

try:
    from skimage.metrics import structural_similarity
except ImportError:
    # ponytail: compute SSIM using numpy when skimage is not installed; ceiling: global image mean rather than gaussian patch window
    def structural_similarity(aa, bb, channel_axis=2, data_range=255):
        aa = aa.astype(np.float64)
        bb = bb.astype(np.float64)
        c1 = (0.01 * data_range) ** 2
        c2 = (0.03 * data_range) ** 2
        mu_a = np.mean(aa, axis=(0, 1))
        mu_b = np.mean(bb, axis=(0, 1))
        var_a = np.var(aa, axis=(0, 1))
        var_b = np.var(bb, axis=(0, 1))
        cov_ab = np.mean((aa - mu_a) * (bb - mu_b), axis=(0, 1))
        ssim_per_ch = ((2 * mu_a * mu_b + c1) * (2 * cov_ab + c2)) / ((mu_a**2 + mu_b**2 + c1) * (var_a + var_b + c2))
        return float(np.mean(ssim_per_ch))

ROOT=Path(__file__).resolve().parents[1]
CONTRACT=json.loads((ROOT/'scripts'/'visual-contract.json').read_text(encoding='utf-8'))
TH=CONTRACT['thresholds']

def load_rgb(path:Path)->np.ndarray:
    return np.asarray(Image.open(path).convert('RGB'),dtype=np.uint8)

def compare(a:Path,b:Path,ignore:int)->dict:
    aa,bb=load_rgb(a),load_rgb(b)
    if aa.shape!=bb.shape:
        return {'baseline':str(a),'current':str(b),'dimensions_match':False,'ssim':0.0,'changed_pixel_ratio':1.0,'pass':False}
    score=float(structural_similarity(aa,bb,channel_axis=2,data_range=255))
    delta=np.abs(aa.astype(np.int16)-bb.astype(np.int16))
    changed=float(np.mean(np.any(delta>ignore,axis=2)))
    passed=score>=float(TH['ssim_min']) and changed<=float(TH['changed_pixel_ratio_max'])
    return {'baseline':str(a),'current':str(b),'dimensions_match':True,'width':int(aa.shape[1]),'height':int(aa.shape[0]),'ssim':score,'changed_pixel_ratio':changed,'pass':passed}

def heatmap(a:Path,b:Path,out:Path)->None:
    aa,bb=load_rgb(a),load_rgb(b)
    if aa.shape!=bb.shape:return
    delta=np.max(np.abs(aa.astype(np.int16)-bb.astype(np.int16)),axis=2).astype(np.uint8)
    # Monochrome heatmap keeps this diagnostic deterministic and dependency-light.
    Image.fromarray(delta,mode='L').save(out)

def collect(base:Path,current:Path)->list[tuple[Path,Path,str]]:
    if base.is_file() and current.is_file():return [(base,current,base.name)]
    if not base.is_dir() or not current.is_dir():raise ValueError('baseline/current must both be files or directories')
    pairs=[]
    for a in sorted(base.rglob('*.png')):
        rel=a.relative_to(base);b=current/rel
        if not b.exists():pairs.append((a,b,str(rel)))
        else:pairs.append((a,b,str(rel)))
    return pairs

def main()->int:
    ap=argparse.ArgumentParser()
    ap.add_argument('baseline',type=Path);ap.add_argument('current',type=Path)
    ap.add_argument('--json',dest='json_out',type=Path)
    ap.add_argument('--diff',dest='diff_out',type=Path)
    args=ap.parse_args()
    try:pairs=collect(args.baseline,args.current)
    except ValueError as exc:print(str(exc),file=sys.stderr);return 2
    results=[]
    for a,b,rel in pairs:
        if not b.exists():r={'baseline':str(a),'current':str(b),'missing_current':True,'ssim':0.0,'changed_pixel_ratio':1.0,'pass':False}
        else:r=compare(a,b,int(TH['channel_ignore_threshold']))
        r['name']=rel;results.append(r)
    passed=bool(results) and all(r['pass'] for r in results)
    report={
      'schema':'aftergraph.visual-parity-result/1.0','pass':passed,
      'thresholds':TH,'count':len(results),'results':results,
      'ssim':min((r['ssim'] for r in results),default=0.0),
      'changed_pixel_ratio':max((r['changed_pixel_ratio'] for r in results),default=1.0),
    }
    if args.diff_out and len(pairs)==1 and pairs[0][1].exists():
        args.diff_out.parent.mkdir(parents=True,exist_ok=True);heatmap(pairs[0][0],pairs[0][1],args.diff_out)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True,exist_ok=True);args.json_out.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return 0 if passed else 1
if __name__=='__main__':raise SystemExit(main())
