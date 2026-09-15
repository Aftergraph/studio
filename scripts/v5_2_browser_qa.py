from pathlib import Path
import re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
MODULES=[
 'src/domain.mjs','src/router.mjs','src/billing/fixtures.mjs','src/state.mjs','src/search.mjs','src/economy/currency.mjs','src/auth/ui-actions.mjs','src/ui-helpers.mjs','src/workspace-shell.mjs','src/workspace/active-context.mjs','src/icons.mjs',
 'packages/tokens/index.mjs','packages/icons/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs',
 'packages/ui/shared.mjs','packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs','packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs','packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs','packages/ui/trust/approval.mjs','packages/ui/trust/auth-panel.mjs','packages/ui/trust/user-invite.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs','packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs','packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs','packages/ui/system/active-context-bar.mjs','packages/ui/index.mjs',
 'src/live-runtime.mjs','src/api-routes.mjs','src/storage-adapter.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/backend-reconciliation.mjs','src/action-guard.mjs',
 'packages/spatial/index.mjs','packages/presence/index.mjs','packages/interaction/index.mjs','packages/visualization/index.mjs','packages/composer/index.mjs',
 'src/replay.mjs','src/spatial-lifecycle.mjs','src/genui/component-registry.mjs','src/genui/action-catalog.mjs','src/genui/interaction-envelope.mjs','src/genui/aftergraph-registry.mjs','src/genui/chat-surface.mjs','src/app/ui-state.mjs','src/app/render-scheduler.mjs','src/runtime/backend-session.mjs','src/runtime/background-reconciliation.mjs','src/federation/browser-client.mjs','src/runtime/federation-session.mjs','src/views/chat-view.mjs','src/views/work-view.mjs','src/views/space-view.mjs','src/views/system-view.mjs','src/views/control-view.mjs','src/views/research-view.mjs','src/views/capabilities-view.mjs','src/app/bootstrap.mjs','src/main.mjs'
]

def rewrite_locals(name,source):
    maps={
      'packages/spatial/index.mjs':{'esc':'spatialEsc','attr':'spatialAttr','clone':'spatialClone','AGSurface':'AGSpatialSurface'},
      'packages/presence/index.mjs':{'esc':'presenceEsc','attr':'presenceAttr','AGAgentPresence':'AGSpatialAgentPresence'},
      'packages/visualization/index.mjs':{'esc':'vizEsc','attr':'vizAttr','nodeStateClass':'vizNodeStateClass'},
      'packages/composer/index.mjs':{'esc':'composerEsc','attr':'composerAttr','MODES':'COMPOSER_MODES'},
      'src/replay.mjs':{'clone':'replayClone'},
      'src/runtime/background-reconciliation.mjs':{'CLIENT_VIEW_KEYS':'RUNTIME_CLIENT_VIEW_KEYS'},
      'src/workspace/active-context.mjs':{'conversationMissionId':'activeContextConversationMissionId'},
      'src/genui/component-registry.mjs':{'fail':'genuiRegistryFail'},
      'src/genui/interaction-envelope.mjs':{'fail':'genuiInteractionFail','unique':'genuiInteractionUnique','safeValues':'genuiInteractionSafeValues','createdAt':'genuiInteractionCreatedAt','blocked':'genuiInteractionBlocked'},
      'src/genui/chat-surface.mjs':{'fallback':'genuiChatFallback'},
    }
    for old,new in maps.get(name,{}).items():
        source=re.sub(rf'\b{re.escape(old)}\b',new,source)
    return source

def bundle_for(mode='chat',use_location=False):
    parts=[]
    for name in MODULES:
        source=rewrite_locals(name,(ROOT/name).read_text(encoding='utf-8'))
        source=re.sub(r'^import .*?;\n','',source,flags=re.M)
        source=re.sub(r'\bexport\s+(?=(const|let|var|function|class)\b)','',source)
        source=re.sub(r"^export\s*\{[^}]+\}\s*(?:from\s*['\"][^'\"]+['\"])?;?\n?",'',source,flags=re.M)
        parts.append(source)
    bundle='\n'.join(parts)
    route="{kind:'mode',mode:'space',domain:'work'}" if mode=='space' else f"{{kind:'domain',domain:'{mode}'}}"
    if not use_location:
        bundle=bundle.replace("const initialRoute=routeFromLocation(window.location);",f"const initialRoute={route};")
    bundle=bundle.replace("if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});",'')
    return bundle

def html():
    css='\n'.join((ROOT/'styles'/name).read_text(encoding='utf-8') for name in ['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css','canonical-shell.css'])
    return f'''<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aftergraph V5.2 QA</title><style>{css}</style></head><body><a class="skip-link" href="#main-content">Skip</a><div id="app"></div><div id="toast-region" class="toast-region" aria-live="polite"></div></body></html>'''

def boot(browser,mode='chat',viewport=None):
    page=browser.new_page(viewport=viewport or {'width':1440,'height':1000},reduced_motion='no-preference')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html(),wait_until='load')
    page.evaluate('window.__AFTERGRAPH_QA=true')
    page.add_script_tag(type='module',content=bundle_for(mode))
    page.wait_for_function('window.__aftergraphQA && window.__aftergraphQA.snapshot')
    page.wait_for_timeout(100)
    return page,errors

def boot_deployed(browser,mode):
    page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='no-preference')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('http://studio.test/**',lambda route: route.fulfill(status=200,content_type='text/html',body=html()) if route.request.resource_type=='document' else route.fulfill(status=404,body=''))
    page.goto(f'http://studio.test/studio/{mode}',wait_until='domcontentloaded')
    page.evaluate('window.__AFTERGRAPH_QA=true')
    page.add_script_tag(type='module',content=bundle_for(mode,use_location=True))
    page.wait_for_function('window.__aftergraphQA && window.__aftergraphQA.snapshot')
    page.wait_for_timeout(50)
    return page,errors

def check(value,label):
    if not value: raise AssertionError(label)
    print('PASS',label)

def run_all():
    with sync_playwright() as p:
        chromium_bin=next((str(p) for p in (Path('/usr/bin/chromium'),Path('/usr/local/bin/chromium')) if p.exists()),None)
        browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])

        # Peer-review named concurrency gate: human edits composer while progress is patched.
        page,errors=boot(browser,'chat')
        composer=page.locator('[data-focus-key="composer-input"]')
        composer.fill('deploy production safely now')
        composer.focus()
        handle=composer.element_handle()
        page.evaluate('(el)=>el.setSelectionRange(7,17)',handle)
        before=page.evaluate('window.__aftergraphQA.snapshot()')
        check(page.evaluate('window.__aftergraphQA.progressTick(66)') is True,'QA progress tick accepted')
        page.wait_for_timeout(50)
        after=page.evaluate('window.__aftergraphQA.snapshot()')
        interaction=page.evaluate('(el)=>({same:document.querySelector(`[data-focus-key="composer-input"]`)===el,focused:document.activeElement===el,value:el.value,start:el.selectionStart,end:el.selectionEnd})',handle)
        check(interaction['same'],'concurrent progress tick preserves composer DOM identity')
        check(interaction['focused'],'concurrent progress tick preserves composer focus')
        check(interaction['value']=='deploy production safely now','concurrent progress tick preserves composer value')
        check((interaction['start'],interaction['end'])==(7,17),'concurrent progress tick preserves caret selection')
        check(after['metrics']['shellRenders']==before['metrics']['shellRenders'],'progress-only tick does not render shell')
        check(after['metrics'].get('patch:mission.progress',0)>before['metrics'].get('patch:mission.progress',0),'progress-only tick increments mission.progress patch counter')
        check(not errors,'concurrent composer/progress test has no page errors')
        page.close()

        # Control failure contract: authority-owned decision cannot be optimistic.
        control,errors=boot(browser,'chat')
        qa_methods=control.evaluate('Object.keys(window.__aftergraphQA)')
        check('openDomain' in qa_methods and 'injectRemoteApproval' in qa_methods,'QA exposes isolated control-failure seam')
        control.evaluate("window.__aftergraphQA.injectRemoteApproval({id:'ap_qa_fail',title:'Rotate production credential',status:'pending',risk:'high',authority:'Trust Gateway'})")
        control.evaluate("window.__aftergraphQA.openDomain('control')")
        control.wait_for_timeout(50)
        row=control.locator('article.ag-upstream-approval:has([data-upstream-approval="ap_qa_fail"])')
        check(row.count()==1,'remote approval fixture is visible in Control')
        row.locator('[data-upstream-decision="approve"]').click()
        control.wait_for_timeout(80)
        check(control.locator('article.ag-upstream-approval:has([data-upstream-approval="ap_qa_fail"])').count()==1,'failed TG decision remains pending locally')
        check(control.locator('.ag-control-error,[role="alert"]').count()>=1,'failed TG decision is visibly reported')
        check(not errors,'Control failure test has no uncaught page errors')
        control.close()

        # Canonical mobile shell: Chat/Work stay primary; contextual products live in one drawer.
        mobile,errors=boot(browser,'chat',{'width':390,'height':844})
        check(mobile.locator('.ag-sidebar').is_hidden(),'390px hides desktop sidebar until requested')
        nav=mobile.locator('[data-mobile-primary-nav="true"]')
        check(nav.is_visible(),'390px exposes mobile primary navigation')
        labels=[text.strip() for text in nav.locator('[data-human-nav]').all_text_contents()]
        check(labels==['Chat','Work'],'mobile primary navigation is exactly Chat and Work')
        menu=mobile.locator('[data-action="toggle-sidebar"]')
        check(menu.is_visible(),'mobile workspace menu trigger is visible')
        menu.click();mobile.wait_for_selector('.ag-sidebar.is-mobile-open')
        check(mobile.locator('.ag-mobile-backdrop').count()==1,'mobile drawer overlays the canonical shell')
        for destination in ['space','plugins','settings']:
            target=mobile.locator(f'.ag-sidebar.is-mobile-open [data-shell-destination="{destination}"]')
            box=target.bounding_box();check(bool(box and box['height']>=44),f'{destination} drawer target is at least 44 CSS px high')
        backdrop=mobile.locator('.ag-mobile-backdrop');backdrop_box=backdrop.bounding_box()
        check(bool(backdrop_box and backdrop_box['width']>340),'mobile backdrop exposes dismiss area outside drawer')
        backdrop.click(position={'x':backdrop_box['width']-12,'y':backdrop_box['height']/2});mobile.wait_for_timeout(20)
        check(mobile.locator('.ag-sidebar.is-mobile-open').count()==0,'mobile drawer closes without changing shell')
        boxes=[nav.locator('button').nth(i).bounding_box() for i in range(nav.locator('button').count())]
        check(all(box and (box['width']>=44 or box['height']>=44) for box in boxes),'mobile primary mode targets are at least 44 CSS px in one dimension')
        dims=mobile.evaluate('()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})')
        check(dims['scrollWidth']<=dims['clientWidth']+1,'390px has no horizontal overflow')
        check(mobile.locator('[data-focus-key="composer-input"]').is_visible(),'mobile composer remains reachable')
        check(not errors,'mobile shell QA has no page errors')
        mobile.close()

        # Governed generated UI: prepare only through semantic authority handoff.
        genui,errors=boot(browser,'chat')
        genui.evaluate("window.__aftergraphQA.setBackendStatus('current')")
        genui.evaluate("window.__aftergraphQA.injectGeneratedUI({componentId:'ActionProposal',version:'1.0.0',instanceId:'qa_release_prepare',props:{title:'Prepare release',detail:'Prepare the verified candidate without executing it.',action:'release.prepare',targetType:'mission',targetId:'mission_q4'}})")
        action=genui.locator('[data-genui-instance="qa_release_prepare"] [data-generated-action="release.prepare"]')
        check(action.count()==1 and action.is_enabled(),'generated action is preparable only in current context')
        action.click();genui.wait_for_timeout(30)
        interaction=genui.evaluate("window.__aftergraphQA.generatedInteractions().qa_release_prepare")
        check(interaction['status']=='prepared' and interaction['authority']['status']=='pending','generated action stops at prepared authority-pending state')
        check(interaction['executionAllowed'] is False,'generated action cannot self-execute')
        check(not errors,'generated action desktop QA has no page errors')
        genui.close()

        gated,errors=boot(browser,'chat',{'width':390,'height':844})
        gated.evaluate("window.__aftergraphQA.setBackendStatus('current')")
        gated.evaluate("window.__aftergraphQA.injectGeneratedUI({componentId:'ActionProposal',version:'1.0.0',instanceId:'qa_mobile_action',props:{title:'Run mission',detail:'Prepare the governed mission command.',action:'mission.run',targetType:'mission',targetId:'mission_q4'}})")
        gated.evaluate("window.__aftergraphQA.setBackendStatus('degraded')")
        gated.wait_for_timeout(30)
        blocked=gated.locator('[data-genui-instance="qa_mobile_action"] [data-generated-action="mission.run"]')
        check(blocked.is_disabled(),'degraded generated action fails closed')
        check('Requires current state' in blocked.inner_text(),'degraded generated action explains freshness requirement')
        check(not errors,'generated action mobile QA has no page errors')
        gated.close()

        # Cloudflare deployed-base simulation: browser URL keeps /studio while Studio resolves the same modes.
        for mode,expected in [('chat','chat'),('work','work'),('space','space')]:
            deployed,errors=boot_deployed(browser,mode)
            snapshot=deployed.evaluate('window.__aftergraphQA.snapshot()')
            check(deployed.url.endswith(f'/studio/{mode}'),f'/studio/{mode} retains deployed base path')
            check(snapshot['primaryMode']==expected,f'/studio/{mode} selects {expected} mode')
            check(not errors,f'/studio/{mode} deployed-base simulation has no page errors')
            deployed.close()

        browser.close()

    print('ALL V5.2 BROWSER QA CHECKS PASS')


if __name__=="__main__":
    run_all()
