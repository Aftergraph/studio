from pathlib import Path
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json, os, re, socket, subprocess, sys, tempfile, threading, time, urllib.request, urllib.error

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

class UpstreamHandler(BaseHTTPRequestHandler):
    calls=[]; approval='pending'
    def log_message(self,*args):pass
    def sendj(self,status,body):
        data=json.dumps(body).encode();self.send_response(status);self.send_header('content-type','application/json');self.send_header('content-length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self):
        self.__class__.calls.append('GET '+self.path)
        p=self.path
        if p in ['/tg/healthz','/works/healthz','/wi/healthz']:return self.sendj(200,{'status':'ok'})
        if p=='/tg/v2/whoami':return self.sendj(200,{'name':'Atlas Operator','role':'operator','capabilities':['approval.decide']})
        if p=='/tg/v1/approvals':return self.sendj(200,{'approvals':[] if self.__class__.approval!='pending' else [{'id':'apr_remote','status':'pending','tool':'deploy.production','title':'Deploy canonical release'}]})
        if p=='/tg/v2/need-you/now':return self.sendj(200,{'items':[] if self.__class__.approval!='pending' else [{'id':'need_remote','type':'approval','subject':'Deploy canonical release'}]})
        if p=='/tg/v1/audit/verify':return self.sendj(200,{'ok':True,'head':'audit-head'})
        if p=='/works/v1/works':return self.sendj(200,{'works':[{'id':'wrk_0123456789abcdef0123456789abcdef','state':'RUNNING','objective':'Execute canonical Q4 analysis'}]})
        if p=='/works/v1/brain/objects?prefix=%2Forg%2Facme%2F':return self.sendj(200,{'objects':[{'path':'/org/acme/notes/canonical','class':'mutable_with_revision'}]})
        if p=='/aie/tasks':return self.sendj(200,{'tasks':[{'id':'aie_task_1','state':'working'}]})
        if p=='/wi/v1/work-items':return self.sendj(200,{'items':[{'id':'wi_1','status':'APPROVED','source':'github','title':'Investigate release blocker'}]})
        return self.sendj(404,{'error':'not_found'})
    def do_POST(self):
        self.__class__.calls.append('POST '+self.path)
        if self.path=='/tg/v1/approvals/apr_remote/approve':
            self.__class__.approval='approved';return self.sendj(200,{'status':'approved'})
        return self.sendj(404,{'error':'not_found'})

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

def bundle_for(domain='system'):
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
window.fetch=async(url,options={})=>{const parsed=new URL(String(url),'http://aftergraph.bridge');const result=await window.__bridgeRequest({path:parsed.pathname+parsed.search,method:options.method||'GET',body:options.body||null});return new Response(result.body,{status:result.status,headers:result.headers});};
class BridgeEventSource{constructor(url){this.url=url;this.listeners=new Map();this.closed=false;this.onerror=null;this.onopen=null;this.lastData='';setTimeout(()=>{if(!this.closed)this.onopen?.({type:'open'})},10);this.poll();this.timer=setInterval(()=>this.poll(),100)}addEventListener(name,handler){const list=this.listeners.get(name)||[];list.push(handler);this.listeners.set(name,list)}removeEventListener(name,handler){this.listeners.set(name,(this.listeners.get(name)||[]).filter(x=>x!==handler))}async poll(){if(this.closed)return;try{const r=await fetch('/api/v1/state');if(!r.ok)throw new Error('bridge_poll_failed');const data=await r.text();if(data===this.lastData)return;this.lastData=data;for(const h of this.listeners.get('workspace')||[])h({data})}catch(e){this.onerror?.(e)}}close(){this.closed=true;clearInterval(this.timer)}}
window.EventSource=BridgeEventSource;
'''

def boot(browser,base,domain):
    page=browser.new_page(viewport={'width':1536,'height':1024},reduced_motion='no-preference');errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.expose_function('__bridgeRequest',lambda payload:request(base,payload['path'],payload.get('method','GET'),payload.get('body')))
    page.set_content(html(),wait_until='load');page.add_script_tag(content=BRIDGE_JS);page.add_script_tag(type='module',content=bundle_for(domain))
    page.locator('.ag-app[data-backend-state="connected"]').wait_for(state='visible',timeout=5000)
    return page,errors

def check(v,label):
    if not v:raise AssertionError(label)
    print('PASS',label)

upstream=ThreadingHTTPServer(('127.0.0.1',0),UpstreamHandler);thread=threading.Thread(target=upstream.serve_forever,daemon=True);thread.start();upbase=f'http://127.0.0.1:{upstream.server_address[1]}'
port=free_port();base=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='aftergraph-polyrepo-browser-') as td:
    env=os.environ.copy();env.update({'PORT':str(port),'HOST':'127.0.0.1','AFTERGRAPH_STATE_FILE':str(Path(td)/'state.json'),'AFTERGRAPH_TG_URL':upbase+'/tg','AFTERGRAPH_TG_TOKEN':'TG_BROWSER_SECRET','AFTERGRAPH_WORKS_URL':upbase+'/works','AFTERGRAPH_WORKS_TOKEN':'WORKS_BROWSER_SECRET','AFTERGRAPH_WORKS_BRAIN_PREFIX':'/org/acme/','AFTERGRAPH_AIE_URL':upbase+'/aie','AFTERGRAPH_WI_URL':upbase+'/wi','AFTERGRAPH_WI_TOKEN':'WI_BROWSER_SECRET','AFTERGRAPH_DEMO_FIXTURES':'true'})
    proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        wait_health(base)
        with sync_playwright() as p:
            chromium_bin = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
            browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            system,serrs=boot(browser,base,'system')
            system.locator('.ag-upstream-service-row[data-upstream="trustGateway"][data-state="online"]').wait_for(state='attached',timeout=5000)
            check(system.locator('.ag-upstream-service-row').count()==6,'System renders six exact-head upstream/source-truth rows')
            check(system.locator('.ag-upstream-service-row[data-upstream="works"][data-state="online"]').count()==1,'WORKS runtime is shown online')
            body=system.locator('body').inner_text();check('BROWSER_SECRET' not in body,'upstream credentials never render into UI')
            system.screenshot(path=str(ROOT/'screenshot-polyrepo-system-v5.png'),full_page=True);check(len(serrs)==0,'System upstream surface has no uncaught page errors');system.close()

            work,werrs=boot(browser,base,'work');work.locator('.ag-external-work-row').first.wait_for(timeout=5000)
            check('Execution authority' in work.locator('.ag-external-work-row').first.inner_text(),'Work surface preserves WORKS execution authority')
            check('Explicit promotion required' in work.locator('.ag-detection-proposal-row').first.inner_text(),'WI projection is visibly proposal-only')
            check(len(werrs)==0,'Work polyrepo surface has no uncaught errors');work.close()

            brain,berrs=boot(browser,base,'brain');brain.locator('.ag-upstream-brain-row').first.wait_for(timeout=5000)
            check('/org/acme/notes/canonical' in brain.locator('.ag-upstream-brain-row').first.inner_text(),'Brain surface reads canonical WORKS brain projection')
            check(len(berrs)==0,'Brain polyrepo surface has no uncaught errors');brain.close()

            control,cerrs=boot(browser,base,'control');control.locator('[data-upstream-approval="apr_remote"]').first.wait_for(timeout=5000)
            control.locator('[data-upstream-approval="apr_remote"][data-upstream-decision="approve"]').click();control.wait_for_timeout(400)
            check(UpstreamHandler.approval=='approved','Control delegates explicit approval write to Trust Gateway')
            check('POST /tg/v1/approvals/apr_remote/approve' in UpstreamHandler.calls,'Trust Gateway received the consequential approval operation')
            control.screenshot(path=str(ROOT/'screenshot-polyrepo-control-v5.png'),full_page=True);check(len(cerrs)==0,'Control polyrepo surface has no uncaught errors');control.close()
            browser.close()
    finally:
        proc.terminate()
        try:proc.wait(timeout=3)
        except subprocess.TimeoutExpired:proc.kill()
        upstream.shutdown();upstream.server_close();thread.join(timeout=2)

print('ALL WORKSPACE V5 POLYREPO BROWSER CHECKS PASS')
