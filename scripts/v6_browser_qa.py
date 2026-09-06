from pathlib import Path
from playwright.sync_api import sync_playwright
from v5_2_browser_qa import boot

def check(value,label):
    if not value: raise AssertionError(label)
    print('PASS',label)

def run_all():
    with sync_playwright() as p:
        chromium_bin='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser=p.chromium.launch(executable_path=chromium_bin,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page,errors=boot(browser,'chat',{'width':1440,'height':1000})
        methods=page.evaluate('Object.keys(window.__aftergraphQA)')
        check('setFederationSnapshot' in methods,'QA exposes isolated federation projection seam')
        page.evaluate('''window.__aftergraphQA.setFederationSnapshot({
          phase:'current',complete:true,
          integrations:[{manifest:{id:'isr'},state:'current',freshness:'current'}],
          objects:[{graphId:'isr:claim:C-017',type:'claim',canonicalId:'C-017',canonicalOwner:'isr',sourceIntegration:'isr',freshness:'current',payload:{title:'Evidence gated runtime',evidenceMethod:'deterministic',limitations:['research only']}}],
          capabilities:[{id:'research.inspect',sourceIntegration:'isr',granted:false,description:'Inspect research evidence'}],
          now:{coverage:{complete:true,unavailable:[]}},errors:[]
        })''')
        page.evaluate("window.__aftergraphQA.openDomain('research')")
        page.wait_for_timeout(30)
        check(page.locator('[data-domain-surface="research"]').count()==1,'Research contextual surface renders')
        check(page.get_by_text('Evidence gated runtime').count()==1,'Research surface renders federated claim')
        check(page.get_by_text('Runtime authority: none').count()==1,'Research surface exposes no runtime authority')
        check(page.locator('.ag-mode-nav [data-human-nav]').count()==3,'desktop primary navigation remains exactly three modes')
        check(page.locator('.ag-mode-nav [data-human-nav="research"]').count()==0,'Research is contextual, not primary navigation')

        page.evaluate("window.__aftergraphQA.openDomain('capabilities')")
        page.wait_for_timeout(30)
        check(page.locator('[data-domain-surface="capabilities"]').count()==1,'Capabilities contextual surface renders')
        check(page.get_by_text('research.inspect').count()==1,'Capabilities surface renders discovered capability')
        check(page.get_by_text('Not granted').count()==1,'Capability discovery remains distinct from grant')
        check(not errors,'V6 contextual surfaces have no page errors')
        page.close()

        mobile,errors=boot(browser,'chat',{'width':390,'height':844})
        mobile.evaluate('''window.__aftergraphQA.setFederationSnapshot({phase:'current',complete:true,integrations:[],objects:[],capabilities:[],now:{coverage:{complete:true,unavailable:[]}},errors:[]})''')
        mobile.evaluate("window.__aftergraphQA.openDomain('research')")
        mobile.wait_for_timeout(30)
        dims=mobile.evaluate('()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})')
        check(dims['scrollWidth']<=dims['clientWidth']+1,'390px Research surface has no horizontal overflow')
        check(mobile.locator('[data-mobile-primary-nav="true"] button').count()==3,'mobile primary nav remains Chat Work Space only')
        check(not errors,'V6 mobile contextual surface has no page errors')
        mobile.close()
        browser.close()
    print('ALL V6 BROWSER QA CHECKS PASS')

if __name__=='__main__': run_all()
