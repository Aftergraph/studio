from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, re, socket, subprocess, tempfile, time, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parents[1]
MODULES=[
    'src/domain.mjs','src/router.mjs','src/state.mjs','src/search.mjs','src/ui-helpers.mjs','src/workspace-shell.mjs','src/icons.mjs',
    'packages/tokens/index.mjs','packages/icons/index.mjs','packages/motion/index.mjs','packages/runtime-ui/index.mjs',
    'packages/ui/shared.mjs','packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs','packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs','packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs','packages/ui/trust/approval.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs','packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs','packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs','packages/ui/index.mjs',
    'src/live-runtime.mjs','src/api-client.mjs','src/surface-lifecycle.mjs','src/backend-reconciliation.mjs','src/main.mjs'
]

def free_port():
    s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close();return port

def request(base,path,method='GET',body=None):
    data=None if body in (None,'') else (body.encode() if isinstance(body,str) else json.dumps(body).encode())
    headers={'content-type':'application/json'} if data is not None else {}
    req=urllib.request.Request(base+path,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=5) as r:
            return {'status':r.status,'headers':dict(r.headers),'body':r.read().decode()}
    except urllib.error.HTTPError as e:
        return {'status':e.code,'headers':dict(e.headers),'body':e.read().decode()}

def wait_health(base,deadline=5):
    end=time.time()+deadline
    while time.time()<end:
        try:
            if json.loads(request(base,'/healthz')['body']).get('status')=='ok':return
        except Exception:pass
        time.sleep(.05)
    raise RuntimeError('server health timeout')

def bundle_for(domain='chat'):
    parts=[]
    for name in MODULES:
        source=(ROOT/name).read_text()
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
    css='\n'.join((ROOT/'styles'/name).read_text() for name in ['tokens.css','reset.css','shell.css','components.css','views.css','motion.css','responsive.css'])
    return f'''<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><a class="skip-link" href="#main-content">Skip</a><div id="app"></div><div id="toast-region" class="toast-region" aria-live="polite"></div></body></html>'''

BRIDGE_JS=r'''
window.__AFTERGRAPH_BRIDGE__=true;
window.fetch=async(url,options={})=>{
  const parsed=new URL(String(url),'http://aftergraph.bridge');
  const result=await window.__bridgeRequest({path:parsed.pathname+parsed.search,method:options.method||'GET',body:options.body||null});
  return new Response(result.body,{status:result.status,headers:result.headers});
};
class BridgeEventSource{
  constructor(url){this.url=url;this.listeners=new Map();this.closed=false;this.onerror=null;this.lastData='';this.poll();this.timer=setInterval(()=>this.poll(),70)}
  addEventListener(name,handler){const list=this.listeners.get(name)||[];list.push(handler);this.listeners.set(name,list)}
  removeEventListener(name,handler){this.listeners.set(name,(this.listeners.get(name)||[]).filter(x=>x!==handler))}
  async poll(){if(this.closed)return;try{const r=await fetch('/api/v1/state');if(!r.ok)throw new Error('bridge_poll_failed');const data=await r.text();if(data===this.lastData)return;this.lastData=data;for(const h of this.listeners.get('workspace')||[])h({data})}catch(e){this.onerror?.(e)}}
  close(){this.closed=true;clearInterval(this.timer)}
}
window.EventSource=BridgeEventSource;
'''

def boot(browser,base,domain='chat'):
    page=browser.new_page(viewport={'width':1440,'height':960},reduced_motion='no-preference')
    page.expose_function('__bridgeRequest',lambda payload:request(base,payload['path'],payload.get('method','GET'),payload.get('body')))
    page.set_content(html(),wait_until='load')
    page.add_script_tag(content=BRIDGE_JS)
    page.add_script_tag(type='module',content=bundle_for(domain))
    page.locator('.ag-app[data-backend-state="connected"]').wait_for(state='visible',timeout=5000)
    return page

def api_json(base,path,method='GET',body=None):
    return json.loads(request(base,path,method,json.dumps(body) if body is not None else None)['body'])

def check(value,label):
    if not value:raise AssertionError(label)
    print('PASS',label)

port=free_port();base=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='aftergraph-fullstack-bridge-') as td:
    env=os.environ.copy();env.update({'PORT':str(port),'HOST':'127.0.0.1','AFTERGRAPH_STATE_FILE':str(Path(td)/'state.json'),'AFTERGRAPH_RUNTIME_INTERVAL_MS':'250','AFTERGRAPH_DEMO_FIXTURES':'true'})
    proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        wait_health(base)
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            page=boot(browser,base)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            check(page.locator('.ag-app').get_attribute('data-backend-state')=='connected','browser UI connects to real durable backend through sandbox bridge')

            unique='Bridge persisted '+str(int(time.time()*1000))
            page.locator('.ag-composer textarea').fill(unique);page.locator('.ag-composer .ag-send').click();page.wait_for_timeout(220)
            snapshot=api_json(base,'/api/v1/state')['state']
            check(any(m.get('text')==unique for m in snapshot['conversations'][0]['messages']),'composer persists user message to real HTTP server')

            before=next(m for m in snapshot['missions'] if m['id']=='mission_q4')['progress']
            page.get_by_role('button',name='Run live').click();page.wait_for_timeout(330)
            after_payload=api_json(base,'/api/v1/state')
            after=next(m for m in after_payload['state']['missions'] if m['id']=='mission_q4')['progress']
            check(after>before,'server runtime advances mission through browser control')
            page.wait_for_function("before=>parseInt(document.querySelector('.ag-live-strip>b')?.textContent||'0',10)>before",arg=before,timeout=2500)
            check(int(page.locator('.ag-live-strip>b').inner_text().replace('%',''))>before,'bridged live state returns to rendered UI')
            page.get_by_role('button',name='Pause').click();page.wait_for_timeout(120)
            check(api_json(base,'/api/v1/state')['runtimes']['mission_q4']['status']=='paused','browser pause controls server-owned runtime')

            page.get_by_role('button',name='Take over').first.click();page.wait_for_timeout(120)
            taken=api_json(base,'/api/v1/state')['state']
            check(next(m for m in taken['missions'] if m['id']=='mission_q4')['controlMode']=='takeover','takeover persists through authority API')
            page.get_by_role('button',name='Hand back').first.click();page.wait_for_timeout(120)

            page.locator('.ag-topbar [data-action="show-control"]').click();page.wait_for_timeout(100);page.get_by_role('button',name='Approve').click();page.wait_for_timeout(140)
            approved=api_json(base,'/api/v1/state')['state']
            check(next(a for a in approved['approvals'] if a['id']=='apr_prod_1')['state']=='approved','approval persists through browser-to-server contract')

            page.locator('.ag-topbar [data-action="context-preview"]').click();page.wait_for_timeout(80)
            memory=page.locator('.ag-memory-item[data-id="mem2"]');check(memory.count()==1,'server-backed memory is inspectable in browser')
            memory.click();page.wait_for_timeout(120)
            check(not any(m['id']=='mem2' for m in api_json(base,'/api/v1/state')['state']['memory']),'memory revocation persists server-side')
            page.close()

            restored=boot(browser,base);restored.wait_for_timeout(160)
            check(restored.get_by_text(unique,exact=True).count()>=1,'fresh browser surface restores durable conversation from backend')
            check(len(errors)==0,'bridged full-stack browser flow has no uncaught page errors')
            restored.screenshot(path=str(ROOT/'screenshot-fullstack-v4.png'),full_page=True)
            restored.close();browser.close()

        reset=api_json(base,'/api/v1/reset','POST',{'actor':'demo-user','confirmationToken':'RESET_WORKSPACE','idempotencyKey':'reset-smoke'})
        check(any(m['id']=='mem2' for m in reset['state']['memory']),'full-stack test resets deterministic seed state')
    finally:
        proc.terminate()
        try:proc.wait(timeout=3)
        except subprocess.TimeoutExpired:proc.kill()

print('ALL WORKSPACE V4 BRIDGED FULLSTACK BROWSER CHECKS PASS')
