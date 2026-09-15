from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, re, socket, subprocess, sys, tempfile, time, urllib.request, urllib.error

sys.stdout.reconfigure(encoding='utf-8')

ROOT=Path(__file__).resolve().parents[1]
MODULES=[
 'src/domain.mjs','src/router.mjs','src/billing/fixtures.mjs','src/state.mjs','src/search.mjs','src/economy/currency.mjs','src/auth/ui-actions.mjs','src/ui-helpers.mjs','src/workspace-shell.mjs','src/icons.mjs',
 'packages/tokens/index.mjs','packages/icons/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs',
    'packages/ui/shared.mjs','packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs','packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs','packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs','packages/ui/trust/approval.mjs','packages/ui/trust/auth-panel.mjs','packages/ui/trust/user-invite.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs','packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs','packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs','packages/ui/index.mjs',
 'src/live-runtime.mjs','src/api-routes.mjs','src/storage-adapter.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/backend-reconciliation.mjs',
 'packages/spatial/index.mjs','packages/presence/index.mjs','packages/interaction/index.mjs','packages/visualization/index.mjs','packages/composer/index.mjs',
 'src/replay.mjs','src/spatial-lifecycle.mjs','src/app/ui-state.mjs','src/app/render-scheduler.mjs','src/runtime/backend-session.mjs','src/runtime/background-reconciliation.mjs','src/federation/browser-client.mjs','src/runtime/federation-session.mjs','src/views/chat-view.mjs','src/views/work-view.mjs','src/views/space-view.mjs','src/views/system-view.mjs','src/views/control-view.mjs','src/views/research-view.mjs','src/views/capabilities-view.mjs','src/app/bootstrap.mjs','src/main.mjs'
]

def free_port():
    s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close();return port

def request(base,path,method='GET',body=None):
    data=None if body in (None,'') else (body.encode() if isinstance(body,str) else json.dumps(body).encode())
    headers={'content-type':'application/json'} if data is not None else {}
    req=urllib.request.Request(base+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=5) as r:return {'status':r.status,'headers':dict(r.headers),'body':r.read().decode()}
    except urllib.error.HTTPError as e:return {'status':e.code,'headers':dict(e.headers),'body':e.read().decode()}

def wait_health(base,deadline=5):
    end=time.time()+deadline
    while time.time()<end:
        try:
            if json.loads(request(base,'/healthz')['body']).get('status')=='ok':return
        except Exception:pass
        time.sleep(.05)
    raise RuntimeError('server health timeout')

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
    bundle=bundle.replace("if(!location.protocol.startsWith('http'))return false;","if(!globalThis.__AFTERGRAPH_BRIDGE__)return false;")
    bundle=bundle.replace("if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('/sw.js').catch(()=>{});",'')
    return bundle

def html():
    css='\n'.join((ROOT/'styles'/name).read_text(encoding='utf-8') for name in ['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css'])
    return f'''<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><a class="skip-link" href="#main-content">Skip</a><div id="app"></div><div id="toast-region" class="toast-region" aria-live="polite"></div></body></html>'''

BRIDGE_JS=r'''
window.__AFTERGRAPH_BRIDGE__=true;
window.fetch=async(url,options={})=>{
  const parsed=new URL(String(url),'http://aftergraph.bridge');
  const result=await window.__bridgeRequest({path:parsed.pathname+parsed.search,method:options.method||'GET',body:options.body||null});
  return new Response(result.body,{status:result.status,headers:result.headers});
};
class BridgeEventSource{
  constructor(url){this.url=url;this.listeners=new Map();this.closed=false;this.onerror=null;this.onopen=null;this.lastData='';setTimeout(()=>{if(!this.closed)this.onopen?.({type:'open'})},10);this.poll();this.timer=setInterval(()=>this.poll(),80)}
  addEventListener(name,handler){const list=this.listeners.get(name)||[];list.push(handler);this.listeners.set(name,list)}
  removeEventListener(name,handler){this.listeners.set(name,(this.listeners.get(name)||[]).filter(x=>x!==handler))}
  async poll(){if(this.closed)return;try{const r=await fetch('/api/v1/state');if(!r.ok)throw new Error('bridge_poll_failed');const data=await r.text();if(data===this.lastData)return;this.lastData=data;for(const h of this.listeners.get('workspace')||[])h({data})}catch(e){this.onerror?.(e)}}
  close(){this.closed=true;clearInterval(this.timer)}
}
window.EventSource=BridgeEventSource;
'''

def boot(browser,base):
    page=browser.new_page(viewport={'width':1536,'height':1024},reduced_motion='no-preference')
    page.expose_function('__bridgeRequest',lambda payload:request(base,payload['path'],payload.get('method','GET'),payload.get('body')))
    page.set_content(html(),wait_until='load');page.add_script_tag(content=BRIDGE_JS);page.add_script_tag(type='module',content=bundle_for('chat'))
    page.locator('.ag-app[data-backend-state="connected"]').wait_for(state='visible',timeout=5000)
    return page

def api(base,path,method='GET',body=None):return json.loads(request(base,path,method,json.dumps(body) if body is not None else None)['body'])
def check(v,label):
    if not v:raise AssertionError(label)
    print('PASS',label)

port=free_port();base=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='aftergraph-v5-bridge-') as td:
    env=os.environ.copy();env.update({'PORT':str(port),'HOST':'127.0.0.1','AFTERGRAPH_STATE_FILE':str(Path(td)/'state.json'),'AFTERGRAPH_RUNTIME_INTERVAL_MS':'180','AFTERGRAPH_DEMO_FIXTURES':'true'})
    proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        wait_health(base)
        with sync_playwright() as p:
            chromium_bin = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
            browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            page=boot(browser,base);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            check(page.locator('.ag-app').get_attribute('data-backend-state')=='connected','browser connects to real V5 durable backend through sandbox bridge')

            unique='V5 bridge '+str(int(time.time()*1000))
            page.locator('.ag-composer textarea').fill(unique);page.locator('.ag-composer .ag-send').click();page.wait_for_timeout(180)
            snap=api(base,'/api/v1/state')['state']
            check(any(m.get('text')==unique for c in snap['conversations'] for m in c.get('messages',[])),'Chat write persists to real V5 backend')

            page.get_by_role('tab',name='Space',exact=True).click();page.wait_for_timeout(130)
            check(page.locator('.ag-space-stage').is_visible(),'connected browser enters V5 Space')
            page.locator('[data-space-action="zoom"][data-zoom-level="agent"]').click();page.wait_for_timeout(180)
            snap=api(base,'/api/v1/state')['state'];space=next(x for x in snap['spaces'] if x['id']=='space_primary')
            check(space['zoom']['level']=='agent' and space['zoom']['objectId']=='agent_data','semantic zoom persists server-side')

            page.locator('[data-space-add="evidence"]').first.click();page.wait_for_timeout(180)
            space=next(x for x in api(base,'/api/v1/state')['state']['spaces'] if x['id']=='space_primary')
            check(any(s.get('kind')=='evidence' for r in space['regions'] for s in r['surfaces']),'spatial evidence docking persists server-side')

            files=page.locator('[data-intent-files]')
            files.set_input_files([{'name':'brief.pdf','mimeType':'application/pdf','buffer':b'local reference brief'}])
            page.wait_for_timeout(80)
            check('brief.pdf' in page.locator('.ag-intent-attachments').inner_text(),'local file metadata appears in multimodal composer')
            page.locator('.ag-intent-composer textarea').fill('Analyze this attached brief')
            page.locator('.ag-intent-composer .ag-intent-send').click();page.wait_for_timeout(220)
            snap=api(base,'/api/v1/state')['state']
            messages=[m for c in snap['conversations'] for m in c.get('messages',[])]
            attached=[m for m in messages if m.get('text')=='Analyze this attached brief']
            check(attached and attached[-1].get('attachments',[{}])[0].get('name')=='brief.pdf','multimodal attachment metadata persists through browser -> API -> store')

            # Return to Space and verify replay is server-owned.
            page.get_by_role('tab',name='Space',exact=True).click();page.wait_for_timeout(100)
            replay_button=page.locator('[data-replay-index]').last
            target=int(replay_button.get_attribute('data-replay-index'));replay_button.click();page.wait_for_timeout(160)
            check(api(base,'/api/v1/state')['state']['replay']['cursor']==target,'replay cursor persists through V5 backend')

            page.screenshot(path=str(ROOT/'screenshot-fullstack-v5.png'),full_page=True)
            check(len(errors)==0,'V5 full-stack browser flow has no uncaught page errors')
            page.close();browser.close()

        reset=api(base,'/api/v1/reset','POST',{'actor':'demo-user','confirmationToken':'RESET_WORKSPACE','idempotencyKey':'reset-smoke-v5'})
        check(reset['state']['spaces'][0]['id']=='space_primary','full-stack test resets deterministic V5 spatial seed')
    finally:
        proc.terminate()
        try:proc.wait(timeout=3)
        except subprocess.TimeoutExpired:proc.kill()

print('ALL WORKSPACE V5 BRIDGED FULLSTACK BROWSER CHECKS PASS')
