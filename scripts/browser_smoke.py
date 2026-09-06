from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
MODULES=[
    'src/domain.mjs','src/router.mjs','src/state.mjs','src/search.mjs','src/ui-helpers.mjs','src/workspace-shell.mjs','src/icons.mjs',
    'packages/tokens/index.mjs','packages/icons/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs',
    'packages/ui/shared.mjs','packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs','packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs','packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs','packages/ui/trust/approval.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs','packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs','packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs','packages/ui/index.mjs',
    'src/live-runtime.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/backend-reconciliation.mjs',
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

def bundle_for(domain='chat'):
    parts=[]
    for name in MODULES:
        source=rewrite_locals(name,(ROOT/name).read_text(encoding='utf-8'))
        source=re.sub(r'^import .*?;\n','',source,flags=re.M)
        source=re.sub(r'\bexport\s+(?=(const|let|var|function|class)\b)','',source)
        source=re.sub(r"^export\s*\{[^}]+\}\s*(?:from\s*['\"][^'\"]+['\"])?;?\n?",'',source,flags=re.M)
        parts.append(source)
    bundle='\n'.join(parts)
    bundle=bundle.replace("const initialRoute=routeFromLocation(window.location);",f"const initialRoute={{kind:'domain',domain:'{domain}'}};")
    bundle=bundle.replace("if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});",'')
    return bundle

def html():
    css='\n'.join((ROOT/'styles'/name).read_text(encoding='utf-8') for name in ['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css'])
    return f'''<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><a class="skip-link" href="#main-content">Skip</a><div id="app"></div><div id="toast-region" class="toast-region" aria-live="polite"></div></body></html>'''

def boot(browser,domain='chat',viewport=None):
    page=browser.new_page(viewport=viewport or {'width':1536,'height':1024},reduced_motion='no-preference')
    page.set_content(html(),wait_until='load')
    page.add_script_tag(type='module',content=bundle_for(domain))
    page.wait_for_timeout(300)
    return page

def check(cond,label):
    if not cond: raise AssertionError(label)
    print('PASS',label)

with sync_playwright() as p:
    chromium_bin='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
    browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=boot(browser,'chat')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))

    check(page.locator('.ag-mode-nav button').count()==3,'V5 desktop preserves Chat/Work flows while adding Space as the third permanent mode')
    check(page.locator('.ag-projects button').count()>=3,'sidebar carries project context')
    check(page.locator('.ag-recents button').count()>=5,'sidebar has unified recents')
    check(page.locator('.ag-artifact-surface').count()==0,'artifact is closed by default')
    check(page.locator('.ag-ambient-field[data-ambient]').count()==1,'living ambient runtime is present')
    check(page.locator('[data-ag-component="trajectory"]').count()>=1,'semantic trajectory component renders')
    check(page.locator('[data-ag-component="composer"]').count()==1,'first-party composer renders')
    check(page.locator('[data-ag-component="agent-presence"]').count()>=1,'agent presence renders')
    check(page.locator('[data-ag-component="agent-cluster"]').count()==1,'first-party agent cluster renders')
    check(page.locator('[data-ag-component="action-dock"]').count()==1,'contextual action dock renders')
    live_box=page.locator('.ag-live-strip').bounding_box();dock_box=page.locator('.ag-action-dock').bounding_box()
    check(live_box is not None and dock_box is not None and live_box['y']+live_box['height']<=dock_box['y']+1,'live strip never overlaps the action dock')
    check(page.locator('[data-ag-component="pulse-rail"]').is_visible(),'desktop pulse rail is present but peripheral')
    page.locator('[data-action="toggle-pulse"]').click();page.wait_for_timeout(120)
    check(page.locator('.ag-pulse-rail.is-open').count()==1,'pulse rail expands on explicit interaction')
    check(page.locator('[data-action="toggle-pulse"]').get_attribute('aria-expanded')=='true','pulse rail exposes expanded state accessibly')
    page.screenshot(path=str(ROOT/'screenshot-pulse-v4.png'),full_page=True)
    page.locator('[data-action="toggle-pulse"]').click();page.wait_for_timeout(80)
    page.mouse.move(1080,180); page.wait_for_timeout(40)
    pointer=page.locator('.ag-app').evaluate("e=>getComputedStyle(e).getPropertyValue('--pointer-x').trim()")
    check(bool(pointer),'pointer movement feeds the ambient interaction field')

    stream=page.locator('#message-list')
    scrollable=stream.evaluate('e=>e.scrollHeight>e.clientHeight+64')
    if scrollable:
        stream.evaluate('e=>{e.scrollTop=0;e.dispatchEvent(new Event("scroll"))}')
        page.wait_for_timeout(30)
    before=int(page.locator('.ag-live-strip>b').inner_text().replace('%',''))
    page.get_by_role('button',name='Run live').click();page.wait_for_timeout(1450)
    after=int(page.locator('.ag-live-strip>b').inner_text().replace('%',''))
    check(after>before,'live mission advances progress in-place')
    if scrollable:
        check(stream.evaluate('e=>e.scrollTop')<12,'live updates preserve a user-owned conversation scroll position')
    page.screenshot(path=str(ROOT/'screenshot-live-v4.png'),full_page=True)
    page.get_by_role('button',name='Pause').click();page.wait_for_timeout(60)
    check(page.get_by_role('button',name='Resume').count()==1,'live mission can pause and resume')
    page.get_by_role('button',name='Resume').click();page.wait_for_timeout(120)
    check(page.get_by_role('button',name='Pause').count()==1,'resume restores active live controls')

    page.locator('[data-action="open-artifact"]').first.click();page.wait_for_timeout(10)
    artifact_surface=page.locator('.ag-artifact-surface.split')
    check(artifact_surface.is_visible(),'artifact morphs into desktop split surface')
    artifact_content=artifact_surface.locator('[data-ag-component="artifact"]')
    shell_opacity=float(artifact_surface.evaluate("e=>getComputedStyle(e).opacity"))
    early_opacity=float(artifact_content.evaluate("e=>getComputedStyle(e).opacity"))
    check(shell_opacity>0.98 and early_opacity>=0.25,'artifact shell is immediate and content never enters from an invisible frame')
    page.wait_for_timeout(210)
    mid_opacity=float(artifact_content.evaluate("e=>getComputedStyle(e).opacity"))
    check(mid_opacity>=early_opacity,'artifact content morph is monotonic and never flashes backward after entry')
    page.wait_for_timeout(240)
    check(page.locator('.ag-resize-handle').is_visible(),'artifact split has accessible resize separator')
    handle=page.locator('.ag-resize-handle');w0=int(handle.get_attribute('aria-valuenow'));handle.focus();page.keyboard.press('ArrowLeft');page.wait_for_timeout(80);w1=int(page.locator('.ag-resize-handle').get_attribute('aria-valuenow'))
    check(w1!=w0,'artifact separator responds to keyboard resizing')
    page.wait_for_timeout(1300)
    running_artifact_animations=artifact_content.evaluate("e=>e.getAnimations().filter(a=>a.playState==='running').length")
    check(running_artifact_animations==0 and float(artifact_content.evaluate("e=>getComputedStyle(e).opacity"))>0.98,'live updates do not restart artifact entrance motion')
    page.screenshot(path=str(ROOT/'screenshot-artifact-v4.png'),full_page=True)
    page.get_by_role('button',name='Close artifact').click();page.wait_for_timeout(70)
    check(page.locator('.ag-artifact-surface.split').count()==0,'artifact collapses back into conversation')

    page.keyboard.press('Control+K');page.wait_for_timeout(100)
    check(page.locator('.ag-command-palette').is_visible(),'Ctrl+K opens immersive command palette')
    check(page.evaluate("document.activeElement && document.activeElement.id==='palette-input'"),'command palette receives focus')
    page.locator('#palette-input').fill('live mission');page.wait_for_timeout(100)
    check(page.locator('.ag-command-result').count()>=1,'command palette searches actions and objects')
    page.keyboard.press('Escape');page.wait_for_timeout(50)

    page.locator('[data-action="context-preview"]').first.click();page.wait_for_timeout(80)
    check(page.locator('.ag-inspector').is_visible(),'context inspector is ephemeral')
    page.keyboard.press('Escape');page.wait_for_timeout(50)

    page.locator('[data-action="toggle-immersive"]').first.click();page.wait_for_timeout(70)
    check(page.locator('.ag-app.is-immersive').count()==1,'immersive mode reorganizes workspace chrome')
    page.locator('[data-action="toggle-immersive"]').first.click();page.wait_for_timeout(60)

    page.locator('[data-action="show-control"]').first.click();page.wait_for_timeout(120)
    check(page.locator('.ag-approval-shell').is_visible(),'consequential approval becomes focus surface')
    check(page.locator('.ag-app.attention-gravity').count()==1,'approval activates attention gravity')
    box=page.locator('.ag-approval-shell').bounding_box()
    check(box is not None and abs((box['x']+box['width']/2)-768)<32 and abs((box['y']+box['height']/2)-512)<70,'approval focus remains centered inside the viewport')
    page.get_by_role('button',name='Evidence').click();page.wait_for_timeout(70)
    check(page.locator('.ag-evidence-reveal').is_visible(),'evidence reveals beside the decision surface')
    approval_opacity=float(page.locator('.ag-approval').evaluate("e=>getComputedStyle(e).opacity"))
    check(approval_opacity>0.92,'evidence disclosure does not restart approval entrance animation')
    check(page.locator('.ag-approval').evaluate("e=>e.getAnimations().length")==0,'approval entrance animation runs only on actual surface entry')
    page.wait_for_timeout(380)
    page.screenshot(path=str(ROOT/'screenshot-approval-v4.png'),full_page=True)
    page.get_by_role('button',name='Close approval').click();page.wait_for_timeout(60)

    page.locator('[data-action="takeover"]').first.click();page.wait_for_timeout(90)
    check(page.locator('.ag-takeover-ribbon').is_visible(),'human takeover has explicit ownership state')
    page.get_by_role('button',name='Hand back').first.click();page.wait_for_timeout(90)
    check(page.locator('.ag-takeover-ribbon').count()==0,'handback restores agent-owned workspace')
    page.screenshot(path=str(ROOT/'screenshot-desktop-v4.png'),full_page=True)
    check(len(errors)==0,'desktop runtime has no uncaught page errors')
    page.close()

    mobile=boot(browser,'chat',{'width':390,'height':844})
    merrors=[];mobile.on('pageerror',lambda e:merrors.append(str(e)))
    check(mobile.locator('.ag-sidebar').is_hidden(),'mobile removes desktop sidebar chrome')
    check(mobile.locator('.ag-mode-switch button').count()==3,'V5 mobile preserves Chat/Work flows while adding Space')
    dims=mobile.evaluate('()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth})')
    check(dims['s']<=dims['c']+1,'390px layout has no page-level horizontal overflow')
    mobile.locator('[data-action="open-artifact"]').first.click();mobile.wait_for_timeout(160)
    check(mobile.locator('.ag-artifact-surface.fullscreen').is_visible(),'mobile artifact becomes fullscreen work surface')
    mobile.keyboard.press('Escape');mobile.wait_for_timeout(60)
    check(mobile.locator('.ag-artifact-surface.fullscreen').count()==0,'mobile Escape collapses artifact')
    mobile.locator('.ag-topbar [data-action="show-control"]').click();mobile.wait_for_timeout(90)
    check(mobile.locator('.ag-approval-shell').is_visible(),'mobile approval becomes native-like bottom focus sheet')
    mobile.get_by_role('button',name='Close approval').click();mobile.wait_for_timeout(50)
    mobile.screenshot(path=str(ROOT/'screenshot-mobile-v4.png'),full_page=True)
    check(len(merrors)==0,'mobile runtime has no uncaught page errors')
    mobile.close()

    canonical={'now':'need-you','agents':'agent-card','brain':'context-summary','output':'artifact-row','control':'need-you','connect':'connection-row','system':'telemetry-strip'}
    for domain,component in canonical.items():
        surface=boot(browser,domain)
        domain_errors=[];surface.on('pageerror',lambda e, bucket=domain_errors:bucket.append(str(e)))
        check(surface.locator(f'[data-domain-surface=\"{domain}\"]') .count()==1,f'{domain.upper()} resolves to a real canonical surface')
        check(surface.locator(f'[data-ag-component=\"{component}\"]') .count()>=1,f'{domain.upper()} uses first-party semantic components')
        if domain=='agents':
            surface.locator('[data-agent]').first.click();surface.wait_for_timeout(40)
            check(surface.locator('.ag-inspector[aria-label=\"Agent inspector\"]') .is_visible(),'AGENTS inspect action opens agent-specific inspector')
        if domain=='connect':
            surface.locator('[data-connection]').first.click();surface.wait_for_timeout(40)
            check(surface.locator('.ag-inspector[aria-label=\"Connection inspector\"]') .is_visible(),'CONNECT inspect action exposes scoped permissions')
        if domain=='output':
            surface.locator('[data-artifact]').first.click();surface.wait_for_timeout(40)
            check(surface.locator('.ag-domain-artifact-pane .ag-artifact-surface').is_visible(),'OUTPUT artifact opens a durable desktop work surface')
        if domain=='control':
            rows=surface.locator('[data-domain-surface=\"control\"] [data-action=\"show-control\"]')
            check(rows.count()>=2,'CONTROL exposes each pending decision independently')
            rows.nth(1).click();surface.wait_for_timeout(40)
            check('Rotate expired provider credential' in surface.locator('.ag-approval h2').inner_text(),'CONTROL targeted approval opens the selected decision')
        check(len(domain_errors)==0,f'{domain.upper()} has no uncaught page errors')
        surface.close()

    browser.close()

print('ALL WORKSPACE V4 BROWSER SMOKE CHECKS PASS')
