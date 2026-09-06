from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, socket, subprocess, tempfile, time, urllib.request

ROOT=Path(__file__).resolve().parents[1]

def free_port():
    s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close();return port

def api(base,path,method='GET',body=None):
    data=None if body is None else json.dumps(body).encode()
    headers={'content-type':'application/json'} if body is not None else {}
    req=urllib.request.Request(base+path,data=data,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=4) as r:
        return json.loads(r.read().decode())

def wait_health(base,deadline=5):
    end=time.time()+deadline
    while time.time()<end:
        try:
            if api(base,'/healthz').get('status')=='ok': return
        except Exception: time.sleep(.05)
    raise RuntimeError('server health timeout')

def check(value,label):
    if not value: raise AssertionError(label)
    print('PASS',label)

port=free_port();base=f'http://127.0.0.1:{port}'
with tempfile.TemporaryDirectory(prefix='aftergraph-fullstack-') as td:
    env=os.environ.copy();env.update({'PORT':str(port),'HOST':'127.0.0.1','AFTERGRAPH_STATE_FILE':str(Path(td)/'state.json'),'AFTERGRAPH_RUNTIME_INTERVAL_MS':'80','AFTERGRAPH_DEMO_FIXTURES':'true'})
    proc=subprocess.Popen(['node','server.mjs'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        wait_health(base)
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            page=browser.new_page(viewport={'width':1440,'height':960},reduced_motion='no-preference')
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(base+'/chat',wait_until='networkidle')
            page.locator('.ag-app[data-backend-state="connected"]').wait_for(state='visible',timeout=4000)
            check(page.locator('.ag-app').get_attribute('data-backend-state')=='connected','real server mode connects automatically')
            check('live' in page.locator('.ag-workspace-switch small').evaluate("e=>getComputedStyle(e,'::after').content"),'backend presence stays peripheral but visible')

            unique='Full-stack persistence '+str(int(time.time()*1000))
            page.locator('.ag-composer textarea').fill(unique)
            page.locator('.ag-composer .ag-send').click()
            page.wait_for_timeout(180)
            snapshot=api(base,'/api/v1/state')['state']
            messages=snapshot['conversations'][0]['messages']
            check(any(m.get('text')==unique for m in messages),'composer write persists through HTTP API')
            check(any(m.get('author')=='Friday' and m.get('text','').startswith('I’m on it') for m in messages),'server preserves assistant response in durable conversation')

            before=next(m for m in snapshot['missions'] if m['id']=='mission_q4')['progress']
            page.get_by_role('button',name='Run live').click()
            page.wait_for_timeout(300)
            running=api(base,'/api/v1/state')
            after=next(m for m in running['state']['missions'] if m['id']=='mission_q4')['progress']
            check(after>before,'server-owned runtime advances mission state')
            check(running['runtimes']['mission_q4']['status']=='running','runtime status is exposed by backend')
            page.get_by_role('button',name='Pause').click();page.wait_for_timeout(120)
            paused=api(base,'/api/v1/state')
            check(paused['runtimes']['mission_q4']['status']=='paused','UI pause action controls server runtime')

            page.get_by_role('button',name='Take over').first.click();page.wait_for_timeout(120)
            taken=api(base,'/api/v1/state')['state']
            check(next(m for m in taken['missions'] if m['id']=='mission_q4')['controlMode']=='takeover','takeover persists through server authority contract')
            page.get_by_role('button',name='Hand back').first.click();page.wait_for_timeout(120)
            handed=api(base,'/api/v1/state')['state']
            check(next(m for m in handed['missions'] if m['id']=='mission_q4')['controlMode']=='observe','handback persists through server authority contract')

            page.locator('.ag-topbar [data-action="show-control"]').click();page.wait_for_timeout(120)
            page.get_by_role('button',name='Approve').click();page.wait_for_timeout(160)
            approved=api(base,'/api/v1/state')['state']
            check(next(a for a in approved['approvals'] if a['id']=='apr_prod_1')['state']=='approved','approval decision persists server-side')

            page.locator('.ag-topbar [data-action="context-preview"]').click();page.wait_for_timeout(100)
            row=page.locator('.ag-memory-row[data-id="mem2"]')
            check(row.count()==1,'context inspector exposes server-backed memory')
            row.click();page.wait_for_timeout(130)
            memory_state=api(base,'/api/v1/state')['state']
            check(not any(m['id']=='mem2' for m in memory_state['memory']),'memory revoke persists server-side')

            page.reload(wait_until='networkidle');page.locator('.ag-app[data-backend-state="connected"]').wait_for(state='visible',timeout=4000)
            check(page.get_by_text(unique,exact=True).count()>=1,'reload restores durable conversation from backend')
            check(len(errors)==0,'full-stack browser flow has no uncaught page errors')
            page.screenshot(path=str(ROOT/'screenshot-fullstack-v4.png'),full_page=True)
            browser.close()

        reset=api(base,'/api/v1/reset',method='POST',body={'actor':'demo-user','confirmationToken':'RESET_WORKSPACE','idempotencyKey':'reset-browser-smoke'})
        check(any(m['id']=='mem2' for m in reset['state']['memory']),'reset restores deterministic seed after full-stack test')
    finally:
        proc.terminate()
        try: proc.wait(timeout=3)
        except subprocess.TimeoutExpired: proc.kill()
        if proc.returncode not in (0,-15,None):
            print(proc.stdout.read());print(proc.stderr.read())

print('ALL WORKSPACE V4 FULLSTACK BROWSER CHECKS PASS')
