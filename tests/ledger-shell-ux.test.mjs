import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const BILLING_DIR = '/root/workspace/aftergraph/studio-billing-audit/billing';
const SRC_DIR = '/root/workspace/aftergraph/studio-billing-audit/src/billing';

test('ledger-shell: index.html has exactly one header action group (no duplicates)', () => {
  const html = readFileSync(`${BILLING_DIR}/index.html`, 'utf8');
  const headerActionMatches = html.match(/class="billing-header-actions"/g);
  assert.equal(headerActionMatches?.length, 1, `Expected 1 .billing-header-actions, found ${headerActionMatches?.length}`);

  const refreshMatches = html.match(/id="billing-refresh"/g);
  assert.equal(refreshMatches?.length, 1, `Expected 1 #billing-refresh, found ${refreshMatches?.length}`);

  const settingsMatches = html.match(/data-action="company-settings"/g);
  assert.equal(settingsMatches?.length, 1, `Expected 1 company-settings button, found ${settingsMatches?.length}`);

  const newInvoiceMatches = html.match(/data-action="new-invoice"/g);
  assert.equal(newInvoiceMatches?.length, 1, `Expected 1 new-invoice button, found ${newInvoiceMatches?.length}`);
});

test('ledger-shell: login form has explicit label/input association via for/id', () => {
  const src = readFileSync(`${SRC_DIR}/billing-app.mjs`, 'utf8');
  // renderLoginScreen must produce a label with for="billing-login-token" and input with id="billing-login-token"
  assert.ok(
    src.includes('for="billing-login-token"') || src.includes("for='billing-login-token'"),
    'renderLoginScreen must include <label for="billing-login-token">'
  );
  assert.ok(
    src.includes('id="billing-login-token"') || src.includes("id='billing-login-token'"),
    'renderLoginScreen must include <input id="billing-login-token">'
  );
});

test('ledger-shell: insecure context disables login with Danish recovery copy', () => {
  const src = readFileSync(`${SRC_DIR}/billing-app.mjs`, 'utf8');
  // Secure warning must: mention HTTPS, explain disabled state, provide admin contact path
  assert.ok(src.includes('HTTPS'), 'Warning must mention HTTPS requirement');
  assert.ok(src.includes('deaktiveret'), 'Warning must explain login is disabled');
  assert.ok(src.includes('administratoren'), 'Warning must provide recovery path (contact admin)');
  assert.ok(src.includes('role="alert"'), 'Warning must have role="alert" for accessibility');
});

test('ledger-shell: unauthenticated shell hides primary CTAs when login is shown', () => {
  const src = readFileSync(`${SRC_DIR}/billing-app.mjs`, 'utf8');
  // When renderLoginScreen replaces #billing-app content, the duplicate header buttons
  // are no longer visible because innerHTML replaces them. Verify renderLoginScreen
  // targets #billing-app and replaces its content.
  assert.ok(
    src.includes("$('#billing-app')") || src.includes('document.querySelector(\'#billing-app\')'),
    'renderLoginScreen must target #billing-app container'
  );
  assert.ok(
    src.includes('app.innerHTML'),
    'renderLoginScreen must replace app content via innerHTML'
  );
});

test('ledger-shell: manifest.webmanifest uses Ledger branding', () => {
  const manifestPath = `${BILLING_DIR}/manifest.webmanifest`;
  assert.ok(existsSync(manifestPath), 'manifest.webmanifest exists');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.ok(
    manifest.name?.includes('Ledger') || manifest.short_name?.includes('Ledger'),
    `Manifest name should include "Ledger", got: ${manifest.name}`
  );
});

test('ledger-shell: offline.html exists with Danish lang and doctype', () => {
  const offlinePath = `${BILLING_DIR}/offline.html`;
  assert.ok(existsSync(offlinePath), 'offline.html exists');
  const html = readFileSync(offlinePath, 'utf8');
  assert.ok(html.match(/<!doctype html>/i), 'offline.html has doctype');
  assert.ok(html.includes('lang="da"'), 'offline.html has Danish lang attribute');
});

test('ledger-shell: billing.html redirect exists at root', () => {
  const redirectPath = '/root/workspace/aftergraph/studio-billing-audit/billing.html';
  assert.ok(existsSync(redirectPath), 'billing.html redirect exists at repo root');
  const html = readFileSync(redirectPath, 'utf8');
  assert.ok(html.includes('legacy-redirect'), 'billing.html redirects via legacy-redirect module');
});

test('ledger-shell: page title references Aftergraph Billing or Ledger', () => {
  const html = readFileSync(`${BILLING_DIR}/index.html`, 'utf8');
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  assert.ok(titleMatch, 'Page has a <title> element');
  const title = titleMatch[1];
  assert.ok(
    title.includes('Aftergraph') || title.includes('Ledger') || title.includes('Fakturering'),
    `Title should reference brand, got: ${title}`
  );
});
