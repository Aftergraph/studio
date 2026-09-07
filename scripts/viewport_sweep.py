from pathlib import Path
import subprocess
from playwright.sync_api import sync_playwright
from v5_2_browser_qa import boot

WIDTHS = [320, 390, 768, 1024, 1440, 1920]

def check(value, label):
    if not value: raise AssertionError(label)
    print('PASS', label)

def revision():
    try:
        return subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=Path(__file__).resolve().parents[1]).stdout.strip()
    except Exception:
        return 'unknown'

def run_all():
    rev = revision()
    with sync_playwright() as p:
        chromium_bin = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser = p.chromium.launch(executable_path=chromium_bin, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        for width in WIDTHS:
            page, errors = boot(browser, 'chat', {'width': width, 'height': 900})
            page.wait_for_timeout(60)
            dims = page.evaluate('()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})')
            check(dims['scrollWidth'] <= dims['clientWidth'] + 1, f'{width}px rev={rev} no horizontal overflow')
            if width < 768:
                check(page.locator('[data-mobile-primary-nav="true"] button').count() == 3, f'{width}px rev={rev} mobile primary nav is Chat Work Space only')
            else:
                check(page.locator('.ag-mode-nav [data-human-nav]').count() == 3, f'{width}px rev={rev} desktop primary navigation is exactly three modes')
            check(page.locator('[data-ag-component="composer"] [aria-label="Send"]').count() == 1, f'{width}px rev={rev} primary send action visible')
            check(not errors, f'{width}px rev={rev} no page errors')
            page.close()
        browser.close()
    print(f'ALL VIEWPORT SWEEP CHECKS PASS rev={rev}')

if __name__ == '__main__':
    run_all()
