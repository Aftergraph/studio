from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
MODULES=[
 'src/domain.mjs','src/router.mjs','src/state.mjs','src/search.mjs','src/economy/currency.mjs','src/auth/ui-actions.mjs','src/ui-helpers.mjs','src/workspace-shell.mjs','src/icons.mjs',
 'packages/tokens/index.mjs','packages/icons/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs',
    'packages/ui/shared.mjs','packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs','packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs','packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs','packages/ui/trust/approval.mjs','packages/ui/trust/auth-panel.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs','packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs','packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs','packages/ui/index.mjs',
 'src/live-runtime.mjs','src/api-routes.mjs','src/storage-adapter.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/backend-reconciliation.mjs',
 'packages/spatial/index.mjs','packages/presence/index.mjs','packages/interaction/index.mjs','packages/visualization/index.mjs','packages/composer/index.mjs',
 'src/replay.mjs','src/spatial-lifecycle.mjs','src/app/ui-state.mjs','src/app/render-scheduler.mjs','src/runtime/backend-session.mjs','src/runtime/background-reconciliation.mjs','src/federation/browser-client.mjs','src/runtime/federation-session.mjs','src/views/chat-view.mjs','src/views/work-view.mjs','src/views/space-view.mjs','src/views/system-view.mjs','src/views/control-view.mjs','src/views/research-view.mjs','src/views/capabilities-view.mjs','src/app/bootstrap.mjs','src/main.mjs'
]

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

def bundle_for(mode='space'):
    parts=[]
    for name in MODULES:
        source=rewrite_locals(name,(ROOT/name).read_text(encoding='utf-8'))
        source=re.sub(r'^import .*?;\n','',source,flags=re.M)
        source=re.sub(r'\bexport\s+(?=(const|let|var|function|class)\b)','',source)
        source=re.sub(r"^export\s*\{[^}]+\}\s*(?:from\s*['\"][^'\"]+['\"])?;?\n?",'',source,flags=re.M)
        parts.append(source)
    bundle='\n'.join(parts)
    route="{kind:'mode',mode:'space',domain:'work'}" if mode=='space' else f"{{kind:'domain',domain:'{mode}'}}"
    bundle=bundle.replace("const initialRoute=routeFromLocation(window.location);",f"const initialRoute={route};")
    bundle=bundle.replace("if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});",'')
    return bundle

def html():
    css='\n'.join((ROOT/'styles'/name).read_text(encoding='utf-8') for name in ['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css'])
    return f'''<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aftergraph V5 Agentic Operating Environment</title><style>{css}</style></head><body><a class="skip-link" href="#main-content">Skip</a><div id="app"></div><div id="toast-region" class="toast-region" aria-live="polite"></div></body></html>'''

def boot(browser,mode='space',viewport=None):
    page=browser.new_page(viewport=viewport or {'width':1536,'height':1024},reduced_motion='no-preference')
    errs=[];warns=[]
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.on('console',lambda m:warns.append(m.text) if m.type in ('error','warning') else None)
    page.set_content(html(),wait_until='load')
    page.add_script_tag(type='module',content=bundle_for(mode))
    page.wait_for_timeout(300)
    return page,errs,warns

def check(v,label):
    if not v: raise AssertionError(label)
    print('PASS',label)

with sync_playwright() as p:
    chromium_bin='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page,errs,warns=boot(browser,'space')
    check(page.locator('.ag-space-stage').is_visible(),'Space is a real first-class primary surface')
    check(page.locator('.ag-mode-switch button').count()==3,'desktop exposes only Chat Work Space primary modes')
    check(page.locator('.ag-space-surface').count()>=2,'Space restores durable docked objects')
    check(page.locator('[data-space-action="zoom"][data-zoom-level="mission"]').get_attribute('aria-current')=='step','semantic zoom starts at mission')
    page.locator('[data-space-action="zoom"][data-zoom-level="agent"]').click();page.wait_for_timeout(80)
    check(page.locator('[data-space-action="zoom"][data-zoom-level="agent"]').get_attribute('aria-current')=='step','semantic zoom enters agent level')

    before=page.locator('.ag-space-surface').count()
    page.locator('[data-space-add="evidence"]').first.click();page.wait_for_timeout(80)
    check(page.locator('.ag-space-surface').count()==before+1,'Evidence docks as a typed spatial surface')
    evidence=page.locator('.ag-space-surface[data-kind="evidence"]')
    check(evidence.is_visible(),'Evidence surface is visibly rendered')
    evidence.scroll_into_view_if_needed();page.wait_for_timeout(40)
    drag=evidence.locator('[data-space-drag-handle]').bounding_box();target=page.locator('.ag-space-region[data-region="primary"]').bounding_box()
    visible_top=max(target['y']+24,88);visible_bottom=min(target['y']+target['height']-24,page.viewport_size['height']-24)
    target_x=target['x']+target['width']*.5;target_y=visible_top+min(220,max(24,(visible_bottom-visible_top)*.42))
    page.mouse.move(drag['x']+30,drag['y']+20);page.mouse.down();page.mouse.move(target_x,target_y,steps=6);page.mouse.up();page.wait_for_timeout(100)
    evidence=page.locator('.ag-space-surface[data-kind="evidence"]')
    check(evidence.locator('xpath=ancestor::*[@data-region][1]').get_attribute('data-region')=='primary','pointer drag docks a surface into another region')
    page.wait_for_function("el=>el.getAnimations().every(a=>a.playState!=='running')",arg=evidence.element_handle(),timeout=1500)
    check(evidence.evaluate("e=>e.getAnimations().filter(a=>a.playState==='running').length")==0,'new surface entrance motion settles once')
    page.locator('[data-capability="Build"]').click();page.wait_for_timeout(50)
    check(page.locator('.ag-intent-composer').get_attribute('data-intent-mode')=='Build','intent composer changes capability mode')

    agent=page.locator('.ag-presence-item[data-presence-id="agent_data"]')
    check(agent.count()==1,'agent presence is first-class')
    agent.get_by_role('button',name='Follow').click();page.wait_for_timeout(70)
    check('is-followed' in page.locator('.ag-presence-item[data-presence-id="agent_data"]').get_attribute('class'),'Follow agent updates spatial presence')
    page.locator('[data-space-add="replay"]').first.click();page.wait_for_timeout(70)
    check(page.locator('.ag-space-surface[data-kind="replay"]').count()==1,'Replay opens as a spatial time surface')
    check(page.locator('.ag-space-surface[data-kind="replay"] input[type="range"]').count()==1,'replay surface has interactive scrub')

    evidence.locator('[data-space-action="focus"]').click();page.wait_for_timeout(70)
    check(page.locator('.ag-space-surface.is-focused').count()==1 and page.locator('.ag-space-surface.is-focused').get_attribute('data-kind')=='evidence','surface focus state is durable and singular')
    page.locator('[data-space-command="focus"]').click();page.wait_for_timeout(70)
    check(page.locator('.ag-space-stage').get_attribute('data-space-mode')=='focus','Space focus layout is interactive')
    page.screenshot(path=str(ROOT/'screenshot-space-v5.png'),full_page=True)
    check(len(errs)==0,'desktop Space has no uncaught page errors')
    page.close()

    chat,cerrs,cwarns=boot(browser,'chat')
    check(chat.locator('.ag-conversation').is_visible(),'V5 preserves conversation-first Chat mode')
    chat.get_by_role('tab',name='Space',exact=True).click();chat.wait_for_timeout(80)
    check(chat.locator('.ag-space-stage').is_visible(),'Chat morphs into Space without reload')
    chat.screenshot(path=str(ROOT/'screenshot-desktop-v5.png'),full_page=True)
    check(len(cerrs)==0,'Chat to Space transition has no uncaught errors')
    chat.close()

    mobile,merrs,mwarns=boot(browser,'space',{'width':390,'height':844})
    check(mobile.locator('.ag-sidebar').is_hidden(),'mobile removes desktop sidebar')
    check(mobile.locator('.ag-mode-switch button').count()==3,'mobile preserves Chat Work Space modes')
    dims=mobile.evaluate('()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth})')
    check(dims['s']<=dims['c']+1,'390px Space has no page-level horizontal overflow')
    check(mobile.locator('.ag-space-surface').count()>=2,'mobile keeps durable spatial objects')
    mobile.screenshot(path=str(ROOT/'screenshot-mobile-v5.png'),full_page=True)
    check(len(merrs)==0,'mobile Space has no uncaught page errors')
    mobile.close();browser.close()

print('ALL WORKSPACE V5 BROWSER SMOKE CHECKS PASS')
