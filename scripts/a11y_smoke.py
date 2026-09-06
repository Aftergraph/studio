#!/usr/bin/env python3
"""Automated accessibility gate for Aftergraph with local axe-core injection."""
from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
from v5_2_browser_qa import boot

ROOT = Path(__file__).resolve().parents[1]
AXE_PATH = ROOT / 'scripts' / 'vendor' / 'axe.min.js'

MODES = ['chat', 'work', 'space', 'system', 'control']

def check(value, label):
    if not value:
        raise AssertionError(label)
    print('PASS', label)

def run_axe_for_page(page, label):
    page.add_script_tag(path=str(AXE_PATH))
    results = page.evaluate("""() => {
        return axe.run(document, {
            runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
            }
        });
    }""")
    violations = results.get('violations', [])
    serious_critical = [v for v in violations if v.get('impact') in ('serious', 'critical')]
    moderate_minor = [v for v in violations if v.get('impact') in ('moderate', 'minor')]

    if serious_critical:
        print(f"FAIL [{label}] Axe serious/critical violations found: {len(serious_critical)}")
        for v in serious_critical:
            print(f"  - {v.get('id')} ({v.get('impact')}): {v.get('description')}")
            for node in v.get('nodes', []):
                print(f"    Target: {node.get('target')}")
        raise AssertionError(f"Axe serious/critical violations in {label}")

    print(f"PASS [{label}] Axe scan: 0 critical/serious violations (moderate/minor: {len(moderate_minor)})")
    return results

def run_all():
    if not AXE_PATH.exists():
        raise FileNotFoundError(f"Local vendored axe bundle not found at {AXE_PATH}")

    with sync_playwright() as p:
        chromium_bin = '/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None
        browser = p.chromium.launch(executable_path=chromium_bin, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])

        # 1. Desktop views: Chat, Work, Space, System, Control
        for mode in MODES:
            page, errors = boot(browser, mode, {'width': 1440, 'height': 1000})
            run_axe_for_page(page, f"desktop-{mode}")
            check(not errors, f"desktop-{mode} has no console/page errors")

            # Project-specific checks: landmark & skip link
            check(page.locator('.skip-link').count() >= 1, f"desktop-{mode} has skip link")
            check(page.locator('#app').count() >= 1, f"desktop-{mode} has app landmark")

            # Focus visibility check: focus composer if present
            composer = page.locator('[data-focus-key="composer-input"]')
            if composer.count() > 0:
                composer.focus()
                is_focused = page.evaluate('(el) => document.activeElement === el', composer.element_handle())
                check(is_focused, f"desktop-{mode} focus management works on composer")

            page.close()

        # 2. Mobile views: Chat, Work, Space (390px viewport)
        for mode in ['chat', 'work', 'space']:
            mobile, errors = boot(browser, mode, {'width': 390, 'height': 844})
            run_axe_for_page(mobile, f"mobile-{mode}")
            check(not errors, f"mobile-{mode} has no console/page errors")

            # 390px overflow check
            dims = mobile.evaluate('() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })')
            check(dims['scrollWidth'] <= dims['clientWidth'] + 1, f"mobile-{mode} has no horizontal overflow at 390px")

            # Mobile touch targets >= 44px
            nav = mobile.locator('[data-mobile-primary-nav="true"]')
            if nav.count() > 0:
                buttons = nav.locator('button')
                for i in range(buttons.count()):
                    box = buttons.nth(i).bounding_box()
                    check(box and (box['width'] >= 44 or box['height'] >= 44), f"mobile-{mode} touch target {i} >= 44px")

            mobile.close()

        browser.close()

    print("ALL A11Y GATE CHECKS PASS")

if __name__ == '__main__':
    run_all()
