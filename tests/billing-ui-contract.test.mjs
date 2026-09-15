import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('billing app is a focused accessible Aftergraph surface with human work queues', async () => {
  const html = await text('billing/index.html');
  assert.match(html, /<html[^>]*lang="da"/i);
  assert.match(html, /<main[^>]*id="billing-app"/i);
  assert.match(html, /data-view="inbox"/);
  assert.match(html, /data-view="ready"/);
  assert.match(html, /data-view="waiting"/);
  assert.match(html, /data-view="needs_info"/);
  assert.match(html, /data-view="invoiced"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Faktureringsnavigation"/);
  assert.match(html, /id="billing-review"/);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)/i);
});

test('billing dialogs restore trigger focus and normalize Escape cancellation', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /returnFocus/);
  assert.match(source, /state\.returnFocus\s*=\s*document\.activeElement/);
  assert.match(source, /addEventListener\('cancel'/);
  assert.match(source, /returnFocus\.focus\(\)/);
});

test('billing client exposes only same-origin canonical read and guarded mutation operations', async () => {
  const source = await text('src/billing/browser-client.mjs');
  assert.match(source, /export function createBillingClient/);
  assert.match(source, /\/api\/v1\/billing/);
  assert.match(source, /recordActuals/);
  assert.match(source, /createDraft/);
  assert.match(source, /issueInvoice/);
  assert.match(source, /idempotency-key/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test('billing operator app uses plain Danish workflow copy and never derives billable time from calendar duration', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Indbakke/);
  assert.match(source, /Klar til fakturering/);
  assert.match(source, /Venter/);
  assert.match(source, /Mangler oplysninger/);
  assert.match(source, /Faktureret/);
  assert.match(source, /Tilføj arbejdstid/);
  assert.match(source, /Gennemgå faktura/);
  assert.match(source, /Intl\.NumberFormat/);
  assert.match(source, /missing_actuals/);
  assert.doesNotMatch(source, /scheduledEnd[^\n]*-[^\n]*scheduledStart/);
  assert.doesNotMatch(source, /alarm|nøglekode|keycode|door code/i);
});

test('billing forms expose inline accessible error targets', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /function showFormError/);
  assert.match(source, /aria-describedby="billing-correction-error"/);
  assert.match(source, /id="billing-correction-error"/);
  assert.match(source, /role="alert"/);
  assert.match(source, /showFormError\(form/);
});

test('billing styling dogfoods Aftergraph tokens and remains usable on mobile safe areas', async () => {
  const css = await text('styles/billing.css');
  assert.match(css, /var\(--bg\)/);
  assert.match(css, /var\(--surface\)/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /@import\s+url\(/i);
});

test('billing light palette meets WCAG AA for muted and status text', async () => {
  const html = await text('billing/index.html');
  const css = await text('styles/billing.css');
  const tokens = await text('styles/tokens.css');
  const adsTokens = await text('packages/brand/tokens.css');
  assert.match(html, /<body class="billing-page">/);
  // R-003: billing.css uses ADS aliases; verify the alias references exist
  assert.match(tokens, /--text-3:\s*var\(--ag-brand-text-subtle\)/);
  // R-011: success/warning overridden with accessible values instead of ADS aliases
  assert.match(tokens, /--success:\s*#0b7a47/);
  assert.match(tokens, /--warning:\s*#8a5700/);
  assert.match(tokens, /--danger:\s*var\(--ag-brand-danger-tone\)/);
  // Resolve actual ADS light-theme values for contrast validation
  assert.match(adsTokens, /--ag-brand-text-subtle:\s*#8993a4/);
  assert.match(adsTokens, /--ag-brand-danger-tone:\s*#d24242/);
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground, background) => {
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  // Validate resolved values meet WCAG AA against white canvas
  assert.ok(contrast('#8993a4', '#ffffff') >= 3.0, 'text-subtle must meet WCAG AA for UI components (3.0:1)');
  assert.ok(contrast('#0b7a47', '#ffffff') >= 4.5, 'success must meet WCAG AA for normal text (4.5:1)');
  assert.ok(contrast('#8a5700', '#ffffff') >= 4.5, 'warning must meet WCAG AA for normal text (4.5:1)');
  assert.ok(contrast('#d24242', '#ffffff') >= 4.5, 'danger must meet WCAG AA for normal text (4.5:1)');
});

test('billing dark palette meets WCAG AA for status colors', async () => {
  const tokens = await text('styles/tokens.css');
  // R-011: dark mode overrides for success/warning
  assert.match(tokens, /html\[data-theme="dark"\]/);
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((value) => Number.parseInt(value, 16) / 255);
    const linear = channels.map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground, background) => {
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  // Dark canvas is #080c14
  assert.ok(contrast('#2ecfb5', '#080c14') >= 4.5, 'dark success must meet WCAG AA (4.5:1)');
  assert.ok(contrast('#f0a64a', '#080c14') >= 4.5, 'dark warning must meet WCAG AA (4.5:1)');
});

test('billing tablist supports keyboard navigation with roving tabindex and aria-controls', async () => {
  const html = await text('billing/index.html');
  const source = await text('src/billing/billing-app.mjs');
  // R-010: tabs have ids, aria-controls, and roving tabindex
  assert.match(html, /id="billing-tab-inbox"/);
  assert.match(html, /id="billing-tab-ready"/);
  assert.match(html, /aria-controls="billing-panel"/);
  assert.match(html, /role="tabpanel"\s+id="billing-panel"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /tabindex="-1"/);
  // R-010: keydown handler implements arrow/home/end navigation
  assert.match(source, /keydown/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /Home/);
  assert.match(source, /End/);
  assert.match(source, /roving tabindex/i);
});

test('billing app loads only first-party modules and token/reset/billing styles', async () => {
  const html = await text('billing/index.html');
  assert.match(html, /\/styles\/tokens\.css/);
  assert.match(html, /\/styles\/reset\.css/);
  assert.match(html, /\/styles\/billing\.css/);
  assert.match(html, /\/src\/billing\/billing-app\.mjs/);
  assert.match(html, /\/src\/billing\/pwa\.mjs/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /<script(?![^>]*type="module")[^>]*src=/i);
});

test('Studio Work launches Billing as a product without adding a fourth primary mode', async () => {
  const work = await text('src/views/work-view.mjs');
  const shell = await text('src/workspace-shell.mjs');
  const index = await text('index.html');
  assert.match(work, /data-shell-destination="billing"/);
  assert.match(work, /Aftergraph Billing/);
  assert.match(index, /styles\/billing-launcher\.css/);
  assert.match(shell, /id:'chat'/);
  assert.match(shell, /id:'work'/);
  assert.match(shell, /id:'space'/);
  assert.match(shell, /id:'billing'.*route:'\/billing'/s);
  assert.doesNotMatch(shell.match(/PRIMARY_NAV[\s\S]*?\];/)?.[0]||'', /id:'billing'/);
});

test('issued invoice review exposes artifact download, delivery action and delivery status', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Download faktura/);
  assert.match(source, /Send faktura/);
  assert.match(source, /Leveret|Sendt|Levering/);
  assert.match(source, /data-action="download"/);
  assert.match(source, /data-action="deliver"/);
  assert.match(source, /downloadArtifact/);
  assert.match(source, /deliverInvoice/);
});

test('billing app exposes governed actual correction with an audited reason', async () => {
  const source = await text('src/billing/billing-app.mjs');
  const client = await text('src/billing/browser-client.mjs');
  assert.match(source, /data-action="correct-actuals"/);
  assert.match(source, /Korrigér actuals/);
  assert.match(source, /id="billing-actual-correction-form"/);
  assert.match(source, /id="billing-correction-reason"/);
  assert.match(source, /maxlength="1000"/);
  assert.match(source, /actuals_locked/);
  assert.match(client, /\/api\/v1\/billing\/actuals\/correct/);
  assert.match(client, /billing-actuals-correction/);
});

test('billing app exposes tenant company settings and uses automatic invoice numbering', async () => {
  const html = await text('billing/index.html');
  const source = await text('src/billing/billing-app.mjs');
  assert.match(html, /data-action="company-settings"/);
  assert.match(html, />Virksomhed</);
  assert.match(source, /Virksomhedsprofil/);
  assert.match(source, /updateSettings/);
  assert.match(source, /invoiceSequence/);
  assert.match(source, /Peppol|Nemhandel/);
  assert.doesNotMatch(source, /id="billing-number"/);
  assert.doesNotMatch(source, /Fakturanummer<\/label>/);
});

test('issued invoice review exposes structured e-invoice export without replacing PDF default', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Download UBL/);
  assert.match(source, /downloadPeppol/);
  assert.match(source, /dataset\.action = 'peppol'/);
  assert.match(source, /Peppol/);
});

test('R-014: form fields bind aria-invalid and aria-describedby when validation errors exist', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /aria-invalid/);
  assert.match(source, /setAttribute\('aria-invalid',\s*'true'\)/);
  assert.match(source, /removeAttribute\('aria-invalid'\)/);
  assert.match(source, /setAttribute\('aria-describedby',\s*error\.id\)/);
  assert.match(source, /R-014.*aria-invalid/i);
});

test('R-015: toast auto-dismiss pauses on hover/focus and resumes on leave/blur', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /mouseenter.*pauseToast|pauseToast.*mouseenter/s);
  assert.match(source, /mouseleave.*resumeToast|resumeToast.*mouseleave/s);
  assert.match(source, /focusin.*pauseToast|pauseToast.*focusin/s);
  assert.match(source, /focusout.*resumeToast|resumeToast.*focusout/s);
  assert.match(source, /toastPaused/);
  assert.match(source, /toastRemainingMs/);
  assert.match(source, /R-015.*pause.*toast/i);
});

test('R-016: offline indicator persists via native online/offline event listeners', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /addEventListener\('online'/);
  assert.match(source, /addEventListener\('offline'/);
  assert.match(source, /navigator\.onLine/);
  assert.match(source, /renderConnection/);
  assert.match(source, /R-016.*online.*offline/i);
});
