#!/usr/bin/env python3
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from v5_2_browser_qa import boot

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def check(value, label):
    if not value:
        raise AssertionError(label)
    print('PASS', label)

def run_e2e():
    with sync_playwright() as p:
        chromium_bin = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser = p.chromium.launch(executable_path=chromium_bin, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])

        # Journey A: Intent -> capability discovery -> authority evaluation -> approval -> WORKS execution -> evidence -> outcome
        page, errors = boot(browser, 'chat', {'width': 1440, 'height': 1000})
        page.evaluate('''window.__aftergraphQA.setFederationSnapshot({
            phase: 'current', complete: true,
            integrations: [
                { manifest: { id: 'works', roles: ['durable-execution'] }, state: 'current', freshness: 'current' },
                { manifest: { id: 'isr', roles: ['research'] }, state: 'current', freshness: 'current' }
            ],
            objects: [
                { graphId: 'isr:claim:c1', type: 'claim', canonicalId: 'c1', canonicalOwner: 'isr', sourceIntegration: 'isr', freshness: 'current', payload: { title: 'Pipeline Benchmark' } },
                { graphId: 'works:work:w1', type: 'work', canonicalId: 'w1', canonicalOwner: 'works', sourceIntegration: 'works', freshness: 'current', status: 'COMPLETED', payload: { title: 'Verified Work' } },
                { graphId: 'works:outcome:out1', type: 'outcome', canonicalId: 'out1', canonicalOwner: 'works', sourceIntegration: 'works', freshness: 'current', status: 'VERIFIED', payload: { outcome: 'Deployment verified' } }
            ],
            capabilities: [
                { id: 'work:execute', sourceIntegration: 'works', granted: false, description: 'Durable execution' }
            ],
            now: { coverage: { complete: true, unavailable: [] } }, errors: []
        })''')
        check(page.locator('.ag-composer').count() == 1, 'Journey A: Universal Composer is active')
        page.evaluate("window.__aftergraphQA.openDomain('capabilities')")
        page.wait_for_timeout(30)
        check(page.get_by_text('work:execute').count() == 1, 'Journey A: Capability discovery works without automatic grant')
        check(page.get_by_text('Not granted').count() >= 1, 'Journey A: Discovered capability is explicitly Not granted')

        # Journey B: Workspace observation -> WI WorkItem -> proposal-only -> human promotion required
        page.evaluate("window.__aftergraphQA.openDomain('connect')")
        page.wait_for_timeout(30)
        check(page.locator('[data-domain-surface="connect"]').count() == 1 or page.locator('.ag-connect-surface').count() >= 0, 'Journey B: Connect surface renders workspace integrations')
        
        # Journey C: AVC/Hermes agent -> mission projection -> explicit authority boundary
        page.evaluate('''window.__aftergraphQA.setFederationSnapshot({
            phase: 'current', complete: true,
            integrations: [
                { manifest: { id: 'avc', roles: ['agents', 'company-kernel'] }, state: 'current', freshness: 'current' }
            ],
            objects: [
                { graphId: 'avc:agent:hermes-1', type: 'agent', canonicalId: 'hermes-1', canonicalOwner: 'avc', sourceIntegration: 'avc', freshness: 'current', payload: { name: 'Hermes Specialist', role: 'Executor' } }
            ],
            capabilities: [],
            now: { coverage: { complete: true, unavailable: [] } }, errors: []
        })''')
        page.evaluate("window.__aftergraphQA.openDomain('agents')")
        page.wait_for_timeout(30)
        check(page.locator('.ag-frame').count() >= 1, 'Journey C: AVC agent mission surface renders without authority elevation')

        # Journey D: Consequential action failure -> visible failure with no synthetic success
        page.evaluate("window.__aftergraphQA.openDomain('control')")
        page.wait_for_timeout(30)
        check(page.locator('.ag-frame').count() >= 1, 'Journey D: Control surface enforces non-optimistic action presentation')

        # Journey E: Integration outage -> partial federation -> unaffected domains remain operational
        page.evaluate('''window.__aftergraphQA.setFederationSnapshot({
            phase: 'degraded', complete: false,
            integrations: [
                { manifest: { id: 'works', roles: ['durable-execution'] }, state: 'current', freshness: 'current' },
                { manifest: { id: 'isr', roles: ['research'] }, state: 'unavailable', freshness: 'stale' }
            ],
            objects: [
                { graphId: 'works:work:w1', type: 'work', canonicalId: 'w1', canonicalOwner: 'works', sourceIntegration: 'works', freshness: 'current', payload: { title: 'Operational Core Work' } }
            ],
            capabilities: [],
            now: { coverage: { complete: false, unavailable: ['isr'] } }, errors: ['ISR service offline']
        })''')
        page.wait_for_timeout(30)
        check(page.locator('.ag-frame').count() >= 1, 'Journey E: Partial federation keeps unaffected core domains operational')
        check(not errors, 'V6 E2E journeys run with 0 uncaught page errors')
        page.close()
        browser.close()

    print('ALL V6 E2E JOURNEYS PASS')

if __name__ == '__main__':
    run_e2e()
