#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, math, statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
from v5_2_browser_qa import boot

ROOT=Path(__file__).resolve().parents[1]
BUDGET_PATH=ROOT/'scripts'/'performance-budget.json'
OUT_PATH=ROOT/'qa'/'performance-v5.2.json'

def percentile(values,p):
    if not values:return 0.0
    xs=sorted(values)
    rank=max(0,min(len(xs)-1,math.ceil((p/100)*len(xs))-1))
    return float(xs[rank])

def run(calibrate=False):
    budget=json.loads(BUDGET_PATH.read_text())
    evidence={'schema':'aftergraph-performance-evidence/1.0','budget':budget,'dom':{},'interaction':{},'render_churn':{},'frames':{}}
    failures=[]
    with sync_playwright() as p:
        chromium_bin='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        pages={}
        for mode in ('chat','work','space'):
            page,errors=boot(browser,mode,{'width':1440,'height':1000})
            if errors: failures.append(f'{mode}: page errors: {errors}')
            snap=page.evaluate('window.__aftergraphQA.snapshot()')
            count=int(snap['domCount'])
            evidence['dom'][mode]={'count':count}
            ref=(budget.get('dom_reference') or {}).get(mode)
            if ref:
                max_allowed=math.floor(ref*float(budget['dom_growth_ratio_max'])+1e-9)
                evidence['dom'][mode].update(reference=ref,max_allowed=max_allowed,ratio=count/ref)
                if count>max_allowed: failures.append(f'{mode}: DOM count {count}>{max_allowed} (reference {ref})')
            pages[mode]=page

        chat=pages['chat']
        for mode,page in list(pages.items()):
            if mode!='chat': page.close()
        chat.bring_to_front()
        composer=chat.locator('[data-focus-key="composer-input"]')
        composer.fill('keep this human draft stable')
        composer.focus(); handle=composer.element_handle()
        chat.evaluate('(el)=>el.setSelectionRange(5,15)',handle)
        before=chat.evaluate('window.__aftergraphQA.snapshot()')
        chat.evaluate('window.__aftergraphQA.progressTick(67)')
        chat.wait_for_timeout(40)
        after=chat.evaluate('window.__aftergraphQA.snapshot()')
        stable=chat.evaluate('(el)=>document.querySelector(`[data-focus-key="composer-input"]`)===el && document.activeElement===el && el.selectionStart===5 && el.selectionEnd===15',handle)
        shell_delta=after['metrics']['shellRenders']-before['metrics']['shellRenders']
        patch_delta=after['metrics'].get('patch:mission.progress',0)-before['metrics'].get('patch:mission.progress',0)
        evidence['render_churn']={'progress_tick_shell_render_delta':shell_delta,'mission_progress_patch_delta':patch_delta,'composer_identity_focus_selection_stable':bool(stable)}
        if shell_delta>int(budget['progress_tick_shell_render_delta_max']):failures.append(f'progress tick shell render delta {shell_delta}')
        if patch_delta<1:failures.append('progress tick did not increment mission.progress patch counter')
        if budget.get('composer_node_identity_must_remain_stable') and not stable:failures.append('composer identity/focus/selection changed during progress patch')

        samples=chat.evaluate('''()=>{
          const values=[];
          const modes=['work','chat'];
          for(let i=0;i<20;i++){
            const mode=modes[i%2];
            const button=document.querySelector(`.ag-mode-nav [data-human-nav="${mode}"]`);
            const start=performance.now();
            button.click();
            const active=document.querySelector(`.ag-mode-nav [data-human-nav="${mode}"]`);
            if(!active?.classList.contains('active'))throw new Error(`mode ${mode} did not reach DOM response`);
            values.push(performance.now()-start);
          }
          return values;
        }''')
        p95=percentile(samples,95)
        evidence['interaction']={'samples_ms':[round(float(x),3) for x in samples],'p50_ms':round(percentile(samples,50),3),'p95_ms':round(p95,3),'max_ms':round(max(samples),3)}
        if p95>float(budget['interaction_p95_ms_max']):failures.append(f'interaction p95 {p95:.2f}ms>{budget["interaction_p95_ms_max"]}ms')

        frame_samples=chat.evaluate('''async()=>{
          const out=[];let last=performance.now();
          for(let i=0;i<30;i++)await new Promise(resolve=>requestAnimationFrame(now=>{out.push(now-last);last=now;resolve()}));
          return out.slice(1);
        }''')
        evidence['frames']={'samples':len(frame_samples),'p50_ms':round(percentile(frame_samples,50),3),'p95_ms':round(percentile(frame_samples,95),3),'max_ms':round(max(frame_samples),3),'enforced':False,'note':'Environment-specific rAF evidence; reported, not a universal FPS claim.'}

        chat.close()
        browser.close()

    OUT_PATH.parent.mkdir(parents=True,exist_ok=True)
    OUT_PATH.write_text(json.dumps(evidence,indent=2)+"\n")
    if calibrate:
        print(json.dumps({mode:data['count'] for mode,data in evidence['dom'].items()},sort_keys=True))
    for mode,data in evidence['dom'].items():print(f'DOM {mode}: {data["count"]}')
    print(f'INTERACTION p95: {evidence["interaction"]["p95_ms"]:.3f} ms')
    print(f'PROGRESS shell delta: {evidence["render_churn"]["progress_tick_shell_render_delta"]}; patch delta: {evidence["render_churn"]["mission_progress_patch_delta"]}')
    print(f'FRAME p95: {evidence["frames"]["p95_ms"]:.3f} ms (report-only)')
    if failures:
        for failure in failures:print('FAIL',failure)
        raise SystemExit(1)
    print('PASS V5.2 performance budgets')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--calibrate',action='store_true')
    args=parser.parse_args()
    run(calibrate=args.calibrate)
