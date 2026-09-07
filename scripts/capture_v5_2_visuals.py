#!/usr/bin/env python3
"""Deterministic local screenshots used by the V5.2 visual parity contract."""
from __future__ import annotations
import argparse,re,json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CONTRACT=json.loads((ROOT/'scripts'/'visual-contract.json').read_text())
MODULES=[
 'src/domain.mjs','src/router.mjs','src/state.mjs','src/search.mjs','src/economy/currency.mjs','src/ui-helpers.mjs','src/workspace-shell.mjs','src/icons.mjs',
 'packages/tokens/index.mjs','packages/icons/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs',
 'packages/ui/shared.mjs','packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs','packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs','packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs','packages/ui/trust/approval.mjs','packages/ui/trust/auth-panel.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs','packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs','packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs','packages/ui/index.mjs',
 'src/live-runtime.mjs','src/api-routes.mjs','src/storage-adapter.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/backend-reconciliation.mjs',
 'packages/spatial/index.mjs','packages/presence/index.mjs','packages/interaction/index.mjs','packages/visualization/index.mjs','packages/composer/index.mjs',
 'src/replay.mjs','src/spatial-lifecycle.mjs','src/app/ui-state.mjs','src/app/render-scheduler.mjs','src/runtime/backend-session.mjs','src/runtime/background-reconciliation.mjs','src/views/chat-view.mjs','src/views/work-view.mjs','src/views/space-view.mjs','src/views/system-view.mjs','src/views/control-view.mjs','src/app/bootstrap.mjs','src/main.mjs'
]
LAYER_FILES=['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css']

def rewrite_locals(name,source):
    maps={
      'packages/spatial/index.mjs':{'esc':'spatialEsc','attr':'spatialAttr','clone':'spatialClone','AGSurface':'AGSpatialSurface'},
      'packages/presence/index.mjs':{'esc':'presenceEsc','attr':'presenceAttr','AGAgentPresence':'AGSpatialAgentPresence'},
      'packages/visualization/index.mjs':{'esc':'vizEsc','attr':'vizAttr','nodeStateClass':'vizNodeStateClass'},
      'packages/composer/index.mjs':{'esc':'composerEsc','attr':'composerAttr','MODES':'COMPOSER_MODES'},
      'src/replay.mjs':{'clone':'replayClone'},
      'src/runtime/background-reconciliation.mjs':{'CLIENT_VIEW_KEYS':'RUNTIME_CLIENT_VIEW_KEYS'},
    }
    for old,new in maps.get(name,{}).items():source=re.sub(rf'\b{re.escape(old)}\b',new,source)
    return source

def bundle_for(domain='chat',mode=None):
    parts=[]
    for name in MODULES:
        source=rewrite_locals(name,(ROOT/name).read_text())
        source=re.sub(r'^import .*?;\n','',source,flags=re.M)
        source=re.sub(r'\bexport\s+(?=(const|let|var|function|class)\b)','',source)
        source=re.sub(r"^export\s*\{[^}]+\}\s*(?:from\s*['\"][^'\"]+['\"])?;?\n?",'',source,flags=re.M)
        parts.append(source)
    bundle='\n'.join(parts)
    route=f"{{kind:'mode',mode:'space',domain:'work'}}" if mode=='space' else f"{{kind:'domain',domain:'{domain}'}}"
    bundle=bundle.replace('const initialRoute=routeFromLocation(window.location);',f'const initialRoute={route};')
    bundle=bundle.replace("if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});",'')
    return bundle

def css_text(mode):
    if mode=='layered':
        return '\n'.join((ROOT/'styles'/name).read_text() for name in LAYER_FILES)
    return (ROOT/'styles.css').read_text()+'\n'+(ROOT/'v4.css').read_text()+'\n'+(ROOT/'v5.css').read_text()

def page_html(mode):
    freeze='''*,:before,:after{animation:none!important;transition:none!important;caret-color:transparent!important} html{scroll-behavior:auto!important}'''
    return f'''<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css_text(mode)}\n{freeze}</style></head><body><a class="skip-link" href="#main-content">Skip</a><div id="app"></div><div id="toast-region" class="toast-region" aria-live="polite"></div></body></html>'''

def capture(browser,out:Path,viewport:dict,view:str,css_mode:str):
    page=browser.new_page(viewport={'width':viewport['width'],'height':viewport['height']},reduced_motion='reduce',device_scale_factor=1)
    page.set_content(page_html(css_mode),wait_until='load')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    if view=='space':code=bundle_for('work','space')
    else:code=bundle_for(view)
    page.add_script_tag(type='module',content=code)
    page.wait_for_timeout(100)
    if errors:raise RuntimeError(f'{view} page errors: {errors}')
    if page.locator('#app').evaluate('e=>e.childElementCount')==0:raise RuntimeError(f'{view} rendered an empty app')
    path=out/f"{viewport['id']}--{view}.png"
    page.screenshot(path=str(path),full_page=False,animations='disabled')
    page.close()

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True);ap.add_argument('--css-mode',choices=['legacy','layered'],default='legacy')
    args=ap.parse_args();args.out.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        for vp in CONTRACT['viewports']:
            views=CONTRACT['views']['mobile' if vp['id']=='mobile' else 'desktop']
            for view in views:capture(browser,args.out,vp,view,args.css_mode)
        browser.close()
    print(f'captured {len(list(args.out.glob("*.png")))} deterministic views -> {args.out}')
if __name__=='__main__':main()
