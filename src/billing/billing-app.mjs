import { createBillingClient } from './browser-client.mjs';
import { projectInvoice, projectManualInvoice } from './money.mjs';
import { canFinanciallyMutate, itemsForBillingView } from './app-state.mjs';
import { esc, today, formatDate, formatSyncTime, formatMoney, formatWorkMinutes } from './lib/format.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const AUTH_TOKEN_KEY = 'aftergraph.auth.token';
const IDENTITY_BINDING_PREFIX = 'aftergraph.billing.identity.v1';
const SECURE_CONTEXT_REQUIRED = typeof globalThis.isSecureContext !== 'undefined' ? !globalThis.isSecureContext : (typeof location !== 'undefined' && location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');

const VIEWS = Object.freeze({
  inbox: ['Indbakke', 'Mangler oplysninger først, derefter det der er klar til fakturering.'],
  ready: ['Klar til fakturering', 'Alt nødvendigt er registreret. Gennemgå beløb og opret fakturakladden.'],
  waiting: ['Venter', 'Arbejdet er registreret, men faktureringsperioden er ikke afsluttet endnu.'],
  needs_info: ['Mangler oplysninger', 'Ret den manglende oplysning her, så posten kan gå videre.'],
  invoiced: ['Faktureret', 'Arbejdet er allerede bundet til en faktura og kan ikke faktureres igen.'],
  products: ['Produkter & ydelser', 'Administrer produktkataloget. Varer og tjenesteydelser til fakturalinjer.'],
  recurring: ['Gentagende', 'Administrer gentagende fakturering. Opret, rediger, pause og genoptag automatiske fakturaer.'],
});

const REASONS = Object.freeze({
  billing_window_closed: 'Klar til gennemgang',
  future_visit_same_window: 'Samles med næste besøg',
  missing_actuals: 'Faktiske arbejdstimer mangler',
  missing_customer_address: 'Kundens adresse mangler',
  missing_issuer_profile: 'Virksomhedsprofilen mangler oplysninger',
  missing_customer_email: 'Kundens e-mail mangler',
  missing_rate: 'Timepris mangler',
  missing_currency: 'Valuta mangler',
  unknown_billing_mode: 'Faktureringsmetode skal vælges',
  already_invoiced: 'Allerede faktureret',
});



function itemKey(item) {
  return `${item.status}:${item.customerId}:${(item.visitIds || []).join(',')}`;
}


function readStoredToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || null; }
  catch { return null; }
}

function clearStoredToken() {
  try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
}

function storeToken(token) {
  if (!token) return false;
  try { localStorage.setItem(AUTH_TOKEN_KEY, token); return true; }
  catch { return false; }
}

async function tokenFingerprint(token) {
  if (!token || !globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(token);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function identityBindingKey(fingerprint) {
  return fingerprint ? `${IDENTITY_BINDING_PREFIX}:${fingerprint}` : null;
}

function rememberIdentity(actor, fingerprint) {
  const key = identityBindingKey(fingerprint);
  if (!actor || !key) return false;
  try { localStorage.setItem(key, actor); return true; }
  catch { return false; }
}

function actorForFingerprint(fingerprint) {
  const key = identityBindingKey(fingerprint);
  if (!key) return null;
  try { return localStorage.getItem(key) || null; }
  catch { return null; }
}

async function resolveBillingSession(client, { online = true } = {}) {
  const token = readStoredToken();
  if (!token) {
    client.setSession({ actor: null, token: null });
    return { actor: null, cacheIdentity: null, authenticated: false };
  }

  const fingerprint = await tokenFingerprint(token);
  if (!fingerprint) {
    const error = new Error('secure session identity unavailable');
    error.code = 'session_identity_unavailable';
    throw error;
  }

  const boundActor = actorForFingerprint(fingerprint);
  client.setSession({ actor: null, token });
  if (!online) {
    if (!boundActor) return { actor: null, cacheIdentity: null, authenticated: true };
    client.setSession({ actor: boundActor, token });
    return { actor: boundActor, cacheIdentity: `${boundActor}:${fingerprint}`, authenticated: true };
  }

  try {
    const me = await client.authMe();
    if (!me?.userId) {
      const error = new Error('authenticated subject missing');
      error.code = 'authentication_required';
      error.status = 401;
      throw error;
    }
    rememberIdentity(me.userId, fingerprint);
    client.setSession({ actor: me.userId, token });
    return { actor: me.userId, cacheIdentity: `${me.userId}:${fingerprint}`, authenticated: true };
  } catch (error) {
    if (error?.status === 401 || error?.status === 403) throw error;
    if (!boundActor) throw error;
    client.setSession({ actor: boundActor, token });
    return { actor: boundActor, cacheIdentity: `${boundActor}:${fingerprint}`, authenticated: true, degraded: true };
  }
}

function renderLoginScreen(els, { error = '', secureWarning = false, onLogin }) {
  const app = $('#billing-app');
  if (!app) return;
  const warningHtml = secureWarning
    ? '<div class="billing-login-warning" role="alert"><strong>⚠ Usikker forbindelse</strong><br>Denne side kører ikke over HTTPS. Login er deaktiveret for at beskytte dine oplysninger. Kontakt administratoren.</div>'
    : '';
  const errorHtml = error ? `<div class="billing-login-error" role="alert">${esc(error)}</div>` : '';
  app.innerHTML = `
    <section class="billing-login" aria-labelledby="billing-login-title">
      <div class="billing-login-card">
        <h1 id="billing-login-title">Log ind på Ledger</h1>
        <p class="billing-login-subtitle">Indtast den adgangstoken du har modtaget via e-mail.</p>
        ${warningHtml}
        <form id="billing-login-form" autocomplete="off">
          <label for="billing-login-token">Adgangstoken</label>
          <input id="billing-login-token" name="token" type="password" required
            placeholder="v1.…" inputmode="text" autocapitalize="off" spellcheck="false"
            ${secureWarning ? 'disabled' : ''}>
          <button type="submit" class="billing-primary-button" ${secureWarning ? 'disabled' : ''}>Log ind</button>
        </form>
        ${errorHtml}
      </div>
    </section>`;
  const form = $('#billing-login-form');
  if (form && !secureWarning) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('input[name="token"]', form);
      const token = String(input?.value || '').trim();
      if (!token) return;
      onLogin(token);
    });
    const input = $('input[name="token"]', form);
    input?.focus();
  }
}


function createApp() {
  const client = createBillingClient();
  const state = {
    billing: null,
    actor: null,
    cacheIdentity: null,
    view: 'dashboard',
    busy: false,
    refreshPending: false,
    retryTimer: null,
    cached: false,
    cachedAt: null,
    lastSyncedAt: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    activeItem: null,
    activeInvoice: null,
    dashboard: null,
    products: [],
    productsSearch: '',
    editingProduct: null,
    recurringInvoices: [],
    recurringSearch: '',
    toastTimer: null,
    returnFocus: null,
    loginRequired: false,
    searchQuery: { type: 'invoice', search: '', status: '', dateFrom: '', dateTo: '', customerId: '', sortBy: 'issuedAt', sortOrder: 'desc', limit: 25, offset: 0 },
    searchResults: null,
    searchLoading: false,
    savedViews: [],
  };

  const els = {
    summary: $('#billing-summary'), list: $('#billing-list'), title: $('#billing-list-title'),
    context: $('#billing-list-context'), connection: $('#billing-connection'), refresh: $('#billing-refresh'),
    review: $('#billing-review'), reviewTitle: $('#billing-review-title'), reviewKicker: $('#billing-review-kicker'),
    reviewBody: $('#billing-review-body'), toast: $('#billing-toast'),
    companySettings: $('[data-action="company-settings"]'),
  };

  function showSkeleton() {
    if (!els.list) return;
    els.list.innerHTML = `<div class="billing-skeleton" aria-busy="true" aria-label="Indlæser fakturering">
      ${Array.from({ length: 4 }, () => `<div class="billing-skeleton-card">
        <div class="billing-skeleton-line is-title"></div>
        <div class="billing-skeleton-line is-long"></div>
        <div class="billing-skeleton-line is-medium"></div>
        <div class="billing-skeleton-line is-short"></div>
      </div>`).join('')}
    </div>`;
  }


  const locale = () => state.billing?.settings?.locale || 'da-DK';
  const projection = () => state.billing?.projection || { items: [], summary: {} };
  const customer = (id) => state.billing?.customers?.find((entry) => entry.id === id) || null;
  const visit = (id) => state.billing?.visits?.find((entry) => entry.id === id) || null;
  const invoice = (id) => state.billing?.invoices?.find((entry) => entry.id === id) || null;
  const visitsFor = (item) => (item.visitIds || []).map(visit).filter(Boolean);
  const canMutate = () => canFinanciallyMutate(state);

  function preview(item) {
    const account = customer(item.customerId);
    const visits = visitsFor(item);
    if (!account || !visits.length || visits.some((entry) => !Number.isInteger(entry.actual?.workMinutes))) return null;
    try {
      return projectInvoice({ customer: account, visits, taxRateBps: state.billing?.settings?.taxRateBps ?? 0 });
    } catch {
      return null;
    }
  }

  function toast(message) {
    clearTimeout(state.toastTimer);
    toastPaused = false;
    toastRemainingMs = 2400;
    toastStartedAt = Date.now();
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    state.toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      toastRemainingMs = 2400;
    }, 2400);
  }

  // R-015: Pause toast auto-dismiss on hover/focus, resume on leave/blur
  let toastPaused = false;
  let toastRemainingMs = 2400;
  let toastStartedAt = 0;

  function pauseToast() {
    if (!els.toast.classList.contains('is-visible') || toastPaused) return;
    toastPaused = true;
    clearTimeout(state.toastTimer);
    toastRemainingMs = Math.max(0, toastRemainingMs - (Date.now() - toastStartedAt));
  }

  function resumeToast() {
    if (!toastPaused || !els.toast.classList.contains('is-visible')) return;
    toastPaused = false;
    toastStartedAt = Date.now();
    state.toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      toastRemainingMs = 2400;
    }, toastRemainingMs);
  }

  if (els.toast) {
    els.toast.addEventListener('mouseenter', pauseToast);
    els.toast.addEventListener('mouseleave', resumeToast);
    els.toast.addEventListener('focusin', pauseToast);
    els.toast.addEventListener('focusout', resumeToast);
  }

  function showFormError(form, message = '') {
    const error = $('.billing-form-error', form);
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
    // R-014: Bind aria-invalid and aria-describedby to form fields when errors exist
    const fields = form.querySelectorAll('input, textarea, select');
    fields.forEach((field) => {
      if (message) {
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', error.id);
      } else {
        field.removeAttribute('aria-invalid');
        // Only remove aria-describedby if it points to this error element
        if (field.getAttribute('aria-describedby') === error.id) {
          field.removeAttribute('aria-describedby');
        }
      }
    });
  }

  function connection(text, kind = '') {
    els.connection.textContent = text;
    els.connection.className = `billing-connection${kind ? ` is-${kind}` : ''}`;
  }

  function clearRetry() {
    if (!state.retryTimer) return;
    clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }

  function scheduleRetry(delay = 1500) {
    if (state.retryTimer) return;
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null;
      void refresh();
    }, delay);
  }

  function renderConnection() {
    if (state.cached) {
      connection(`Offline · senest synkroniseret ${formatSyncTime(state.cachedAt, locale())}`, 'degraded');
    } else if (!state.online) {
      connection('Offline · ingen lokal kopi', 'degraded');
    } else {
      connection('Aktuel', 'current');
    }
  }

  function amountFor(item) {
    const projected = preview(item);
    if (projected) return formatMoney(projected.totalGrossMinor, projected.currency, locale());
    const existing = item.invoiceId ? invoice(item.invoiceId) : null;
    return existing?.totalGrossMinor !== undefined
      ? formatMoney(existing.totalGrossMinor, existing.currency || 'DKK', locale()) : '—';
  }

  function subtitleFor(item) {
    const completed = visitsFor(item).filter((entry) => entry.status === 'completed');
    if (!completed.length) return 'Ingen afsluttede besøg';
    const minutes = completed.reduce((sum, entry) => sum + (Number.isInteger(entry.actual?.workMinutes) ? entry.actual.workMinutes : 0), 0);
    const last = completed.at(-1);
    return `${formatDate(last?.scheduledStart, locale())} · ${minutes ? formatWorkMinutes(minutes, locale()) : 'Arbejdstid mangler'}`;
  }

  function detailFor(item) {
    if (item.reasonCode === 'future_visit_same_window') return `Næste besøg er ${formatDate(item.nextVisitAt, locale())}.`;
    if (item.reasonCode === 'missing_actuals') return 'Registrér den samlede faktiske arbejdstid for besøget.';
    if (item.reasonCode === 'already_invoiced') return item.invoiceNumber ? `Faktura nr. ${item.invoiceNumber}.` : 'Besøget er allerede faktureret.';
    if (item.reasonCode === 'billing_window_closed') return 'Actuals, pris og kundeoplysninger er på plads.';
    return 'Ret den manglende oplysning i kundedata.';
  }

  function actionFor(item) {
    const disabled = canMutate() ? '' : ' disabled aria-disabled="true" title="Kræver online og aktuelle data"';
    if (item.status === 'ready') {
      return `<button type="button" class="billing-primary-button" data-action="review" data-key="${esc(itemKey(item))}"${disabled}>Gennemgå faktura</button>`;
    }
    if (item.status === 'needs_info' && item.reasonCode === 'missing_actuals' && item.visitId) {
      return `<button type="button" class="billing-secondary-button" data-action="actuals" data-key="${esc(itemKey(item))}"${disabled}>Tilføj arbejdstid</button>`;
    }
    return '';
  }

  async function fetchDashboard() {
    try {
      const body = await client.read('/api/v1/billing/dashboard');
      state.dashboard = body?.dashboard || null;
    } catch (err) {
      console.error('fetchDashboard failed', err);
      state.dashboard = null;
    }
  }

  async function fetchProducts() {
    try {
      const result = await client.listProducts();
      state.products = result.products || [];
    } catch (err) {
      console.error('fetchProducts failed', err);
      state.products = [];
    }
  }

  async function fetchRecurring() {
    try {
      const result = await client.listRecurring();
      state.recurringInvoices = result.recurringInvoices || [];
    } catch (err) {
      console.error('fetchRecurring failed', err);
      state.recurringInvoices = [];
    }
  }

  function renderRecurring() {
    els.title.textContent = 'Gentagende fakturering';
    els.context.textContent = 'Administrer gentagende fakturering. Opret, rediger, pause og genoptag automatiske fakturaer.';
    const search = state.recurringSearch.toLowerCase();
    const customers = state.billing?.customers || [];
    const filtered = state.recurringInvoices.filter((r) => {
      if (!search) return true;
      const customer = customers.find((c) => c.id === r.customerId);
      const customerName = customer?.name || '';
      return customerName.toLowerCase().includes(search)
        || r.productLines.some((l) => l.description.toLowerCase().includes(search));
    });
    const currency = state.billing?.settings?.currency || 'DKK';
    const loc = locale();
    const rows = filtered.length ? filtered.map((r) => {
      const customer = customers.find((c) => c.id === r.customerId);
      const totalMinor = r.productLines.reduce((sum, l) => sum + (l.quantity * l.unitPriceMinor), 0);
      const scheduleLabel = r.schedule.interval
        ? `Hver ${r.schedule.interval.value} ${r.schedule.interval.unit === 'day' ? 'dag' : r.schedule.interval.unit === 'week' ? 'uge' : r.schedule.interval.unit === 'month' ? 'måned' : r.schedule.interval.unit}`
        : (r.schedule.cron || 'Cron');
      const statusLabel = r.active ? '<span class="billing-status-dot is-active"></span>Aktiv' : '<span class="billing-status-dot"></span>Pause';
      const nextRun = r.nextRunAt ? formatDate(r.nextRunAt, loc) : '—';
      return `
      <article class="billing-row" data-recurring-id="${esc(r.id)}">
        <div class="billing-row-main">
          <h3 class="billing-row-name">${esc(customer?.name || 'Ukendt kunde')}</h3>
          <div class="billing-row-subtitle">${esc(r.productLines.map((l) => l.description).join(', '))}</div>
        </div>
        <div class="billing-row-meta">
          <strong>${esc(formatMoney(totalMinor, currency, loc))}</strong>
          <small>${esc(scheduleLabel)}</small>
        </div>
        <div class="billing-row-reason">${statusLabel}<br><small>Næste: ${esc(nextRun)}</small></div>
        <div class="billing-row-action">
          <button type="button" class="billing-secondary-button" data-action="edit-recurring" data-recurring-id="${esc(r.id)}">Rediger</button>
          <button type="button" class="billing-quiet-button" data-action="toggle-recurring" data-recurring-id="${esc(r.id)}" data-active="${r.active}">${r.active ? 'Pause' : 'Genoptag'}</button>
        </div>
      </article>`;
    }).join('') : '<div class="billing-empty">Ingen gentagende fakturaer fundet.</div>';
    els.list.innerHTML = `
      <div class="billing-form-row" style="margin-bottom:1rem">
        <div class="billing-field is-flex-grow"><input type="search" id="billing-recurring-search" placeholder="Søg efter kunde eller produkt…" value="${esc(state.recurringSearch)}"></div>
        <div class="billing-field is-align-end"><button type="button" class="billing-primary-button" data-action="create-recurring">Ny gentagende</button></div>
      </div>
      ${rows}`;
    const searchInput = $('#billing-recurring-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.recurringSearch = e.target.value;
        renderRecurring();
      });
    }
  }

  function renderProducts() {
    els.title.textContent = 'Produkter & ydelser';
    els.context.textContent = 'Administrer produktkataloget. Varer og tjenesteydelser til fakturalinjer.';
    const search = state.productsSearch.toLowerCase();
    const filtered = state.products.filter((p) => {
      if (!search) return true;
      return (p.name || '').toLowerCase().includes(search)
        || (p.sku || '').toLowerCase().includes(search)
        || (p.category || '').toLowerCase().includes(search);
    });
    const currency = state.billing?.settings?.currency || 'DKK';
    const loc = locale();
    const rows = filtered.length ? filtered.map((p) => `
      <article class="billing-row" data-product-id="${esc(p.id)}">
        <div class="billing-row-main">
          <h3 class="billing-row-name">${esc(p.name)}</h3>
          <div class="billing-row-subtitle">${esc(p.sku || '')}${p.category ? ' · ' + esc(p.category) : ''}</div>
        </div>
        <div class="billing-row-meta">
          <strong>${esc(formatMoney(p.unitPriceMinor, currency, loc))}</strong>
          <small>Moms ${esc(String((p.vatRateBps / 100).toFixed(1)))}%</small>
        </div>
        <div class="billing-row-reason">${p.active ? '<span class="billing-status-dot is-active"></span>Aktiv' : '<span class="billing-status-dot"></span>Inaktiv'}</div>
        <div class="billing-row-action"><button type="button" class="billing-secondary-button" data-action="edit-product" data-product-id="${esc(p.id)}">Rediger</button></div>
      </article>`).join('') : '<div class="billing-empty">Ingen produkter fundet.</div>';
    els.list.innerHTML = `
      <div class="billing-form-row" style="margin-bottom:1rem">
        <div class="billing-field is-flex-grow"><input type="search" id="billing-products-search" placeholder="Søg efter navn, SKU eller kategori…" value="${esc(state.productsSearch)}"></div>
        <div class="billing-field is-align-end"><button type="button" class="billing-primary-button" data-action="create-product">Nyt produkt</button></div>
      </div>
      ${rows}`;
    const searchInput = $('#billing-products-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.productsSearch = e.target.value;
        renderProducts();
      });
    }
  }

  function openProductForm(product = null) {
    state.editingProduct = product;
    const isEdit = !!product;
    const title = isEdit ? 'Rediger produkt' : 'Nyt produkt';
    els.reviewTitle.textContent = title;
    els.reviewKicker.textContent = 'Produktkatalog';
    const p = product || {};
    const priceDisplay = p.unitPriceMinor !== undefined ? String((p.unitPriceMinor / 100).toFixed(2)) : '';
    const vatDisplay = p.vatRateBps !== undefined ? String((p.vatRateBps / 100).toFixed(1)) : '25';
    els.reviewBody.innerHTML = `
      <form id="billing-product-form" class="billing-form">
        <div class="billing-form-row">
          <div class="billing-field is-flex-grow"><label for="pf-name">Navn *</label><input id="pf-name" name="name" required value="${esc(p.name || '')}"></div>
          <div class="billing-field"><label for="pf-sku">SKU</label><input id="pf-sku" name="sku" value="${esc(p.sku || '')}"></div>
        </div>
        <div class="billing-form-row">
          <div class="billing-field is-flex-grow"><label for="pf-desc">Beskrivelse</label><input id="pf-desc" name="description" value="${esc(p.description || '')}"></div>
          <div class="billing-field"><label for="pf-category">Kategori</label><input id="pf-category" name="category" value="${esc(p.category || '')}"></div>
        </div>
        <div class="billing-form-row">
          <div class="billing-field"><label for="pf-price">Enhedspris (ekskl. moms) *</label><input id="pf-price" name="unitPrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${esc(priceDisplay)}"></div>
          <div class="billing-field"><label for="pf-vat">Moms (%)</label><input id="pf-vat" name="vatRate" type="number" min="0" step="0.1" inputmode="decimal" value="${esc(vatDisplay)}"></div>
        </div>
        <div class="billing-form-row">
          <div class="billing-field"><label><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> Aktiv</label></div>
        </div>
        ${!isEdit ? '<div class="billing-form-row"><div class="billing-field is-flex-grow"><label for="pf-id">ID (unikt) *</label><input id="pf-id" name="id" required pattern="[\\w-]+" placeholder="f.eks. klipning-standard"></div></div>' : ''}
        <div class="billing-form-actions">
          <button type="submit" class="billing-primary-button">${isEdit ? 'Gem ændringer' : 'Opret produkt'}</button>
          <button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button>
        </div>
        <div id="billing-product-error" class="billing-field-error" hidden></div>
      </form>`;
    openDialog();
    setTimeout(() => $('#pf-name', els.review)?.focus(), 0);
  }

  async function submitProductForm(form) {
    if (state.busy || !canMutate()) return;
    const data = new FormData(form);
    const errorEl = $('#billing-product-error', form);
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    const name = String(data.get('name') || '').trim();
    const priceRaw = String(data.get('unitPrice') || '').replace(',', '.');
    const vatRaw = String(data.get('vatRate') || '').replace(',', '.');
    const unitPriceMinor = Math.round(Number(priceRaw) * 100);
    const vatRateBps = Math.round(Number(vatRaw) * 100);
    if (!name || !Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Udfyld navn og gyldig pris.'; }
      return;
    }
    state.busy = true;
    try {
      if (state.editingProduct) {
        await client.updateProduct(state.editingProduct.id, {
          name,
          description: String(data.get('description') || '').trim() || null,
          unitPriceMinor,
          vatRateBps,
          category: String(data.get('category') || '').trim() || null,
          sku: String(data.get('sku') || '').trim() || null,
          active: data.get('active') === 'on',
        });
        toast('Produkt opdateret');
      } else {
        const id = String(data.get('id') || '').trim();
        if (!id) { if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'ID er påkrævet.'; } state.busy = false; return; }
        await client.createProduct({
          id,
          name,
          description: String(data.get('description') || '').trim() || null,
          unitPriceMinor,
          vatRateBps,
          category: String(data.get('category') || '').trim() || null,
          sku: String(data.get('sku') || '').trim() || null,
          active: data.get('active') === 'on',
        });
        toast('Produkt oprettet');
      }
      closeDialog();
      await fetchProducts();
      renderProducts();
    } catch (err) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = err?.message || 'Kunne ikke gemme produkt.'; }
    } finally {
      state.busy = false;
    }
  }

  function openRecurringForm(recurring = null) {
    const isEdit = !!recurring;
    const title = isEdit ? 'Rediger gentagende faktura' : 'Ny gentagende faktura';
    els.reviewTitle.textContent = title;
    els.reviewKicker.textContent = 'Gentagende fakturering';
    const customers = state.billing?.customers || [];
    const customerOptions = customers.map((c) => `<option value="${esc(c.id)}" ${recurring?.customerId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    const lines = recurring?.productLines || [{ description: '', quantity: 1, unitPriceMinor: 0 }];
    const linesHtml = lines.map((l, i) => `
      <div class="billing-form-row billing-recurring-line" data-line-index="${i}">
        <div class="billing-field is-flex-grow"><label>Beskrivelse</label><input name="line_desc_${i}" value="${esc(l.description)}" required></div>
        <div class="billing-field"><label>Antal</label><input name="line_qty_${i}" type="number" min="1" value="${l.quantity}" required></div>
        <div class="billing-field"><label>Pris (øre)</label><input name="line_price_${i}" type="number" min="0" value="${l.unitPriceMinor}" required></div>
      </div>`).join('');
    const intervalValue = recurring?.schedule?.interval?.value || 1;
    const intervalUnit = recurring?.schedule?.interval?.unit || 'month';
    els.reviewBody.innerHTML = `
      <form id="billing-recurring-form" class="billing-form">
        <div class="billing-form-row">
          <div class="billing-field is-flex-grow"><label for="rf-customer">Kunde *</label><select id="rf-customer" name="customerId" required>${customerOptions}</select></div>
        </div>
        <fieldset><legend>Fakturalinjer</legend>${linesHtml}</fieldset>
        <div class="billing-form-row">
          <div class="billing-field"><label for="rf-interval-value">Interval</label><input id="rf-interval-value" name="intervalValue" type="number" min="1" value="${intervalValue}"></div>
          <div class="billing-field"><label for="rf-interval-unit">Enhed</label><select id="rf-interval-unit" name="intervalUnit">
            <option value="day" ${intervalUnit === 'day' ? 'selected' : ''}>Dag</option>
            <option value="week" ${intervalUnit === 'week' ? 'selected' : ''}>Uge</option>
            <option value="month" ${intervalUnit === 'month' ? 'selected' : ''}>Måned</option>
          </select></div>
        </div>
        <div class="billing-form-actions">
          <button type="submit" class="billing-primary-button">${isEdit ? 'Gem ændringer' : 'Opret'}</button>
          <button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button>
        </div>
        <div id="billing-recurring-error" class="billing-field-error" hidden></div>
      </form>`;
    openDialog();
    setTimeout(() => $('#rf-customer', els.review)?.focus(), 0);
    const form = $('#billing-recurring-form', els.review);
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitRecurringForm(form, recurring);
      });
    }
  }

  async function submitRecurringForm(form, existing) {
    if (state.busy || !canMutate()) return;
    const errorEl = $('#billing-recurring-error', form);
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    const customerId = form.customerId.value;
    const lineInputs = form.querySelectorAll('.billing-recurring-line');
    const productLines = [];
    for (let i = 0; i < lineInputs.length; i++) {
      const desc = form[`line_desc_${i}`]?.value?.trim();
      const qty = Number(form[`line_qty_${i}`]?.value);
      const price = Number(form[`line_price_${i}`]?.value);
      if (!desc || !Number.isInteger(qty) || qty <= 0 || !Number.isInteger(price) || price < 0) {
        if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Alle linjer skal have beskrivelse, antal og pris.'; }
        return;
      }
      productLines.push({ description: desc, quantity: qty, unitPriceMinor: price });
    }
    const intervalValue = Number(form.intervalValue.value);
    const intervalUnit = form.intervalUnit.value;
    if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Interval skal være et positivt heltal.'; }
      return;
    }
    const schedule = { interval: { value: intervalValue, unit: intervalUnit } };
    state.busy = true;
    try {
      if (existing) {
        await client.updateRecurring(existing.id, { productLines, schedule });
        toast('Gentagende faktura opdateret');
      } else {
        await client.createRecurring({ customerId, productLines, schedule });
        toast('Gentagende faktura oprettet');
      }
      closeDialog();
      await fetchRecurring();
      renderRecurring();
    } catch (err) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = err?.message || 'Kunne ikke gemme.'; }
    } finally {
      state.busy = false;
    }
  }

  async function toggleRecurring(recurringId, active) {
    if (state.busy || !canMutate()) return;
    state.busy = true;
    try {
      await client.updateRecurring(recurringId, { active });
      toast(active ? 'Genoptaget' : 'Sat på pause');
      await fetchRecurring();
      renderRecurring();
    } catch (err) {
      toast(err?.message || 'Kunne ikke opdatere status');
    } finally {
      state.busy = false;
    }
  }

  function renderDashboard() {
    const d = state.dashboard;
    if (!d) {
      els.list.innerHTML = '<div class="billing-skeleton" aria-busy="true" aria-label="Indlæser overblik"><div class="billing-skeleton-card"><div class="billing-skeleton-line is-title"></div><div class="billing-skeleton-line is-long"></div></div></div>';
      return;
    }
    const currency = d.currency || 'DKK';
    const loc = locale();
    const payments = (d.recentPayments || []).map((p) => `
      <li class="billing-dashboard-payment">
        <span class="billing-dashboard-payment-customer">${esc(p.customerName || 'Ukendt kunde')}</span>
        <span class="billing-dashboard-payment-amount">${esc(formatMoney(p.amountMinor, currency, loc))}</span>
        <time datetime="${esc(p.paidAt)}">${esc(formatDate(p.paidAt, loc))}</time>
      </li>`).join('') || '<li class="billing-empty">Ingen betalinger denne måned.</li>';
    els.summary.innerHTML = `
      <article class="billing-summary-item is-primary"><span class="billing-summary-label">Udestående</span><strong class="billing-summary-value">${esc(formatMoney(d.totalOutstandingMinor, currency, loc))}</strong><span class="billing-summary-detail">åbne fakturaer</span></article>
      <article class="billing-summary-item${d.overdueCount > 0 ? ' is-alert' : ''}"><span class="billing-summary-label">Forfaldne</span><strong class="billing-summary-value">${esc(d.overdueCount)}</strong><span class="billing-summary-detail">kræver opfølgning</span></article>
      <article class="billing-summary-item"><span class="billing-summary-label">Månedsomsætning</span><strong class="billing-summary-value">${esc(formatMoney(d.monthlyRevenueMinor, currency, loc))}</strong><span class="billing-summary-detail">indbetalinger i ${esc(new Date().toLocaleString(loc, { month: 'long' }))}</span></article>`;
    els.title.textContent = 'Økonomisk overblik';
    els.context.textContent = 'Udestående fordringer, forfaldne fakturaer og månedens indbetalinger.';
    els.list.innerHTML = `<section class="billing-dashboard-recent" aria-label="Seneste betalinger"><h3>Seneste betalinger</h3><ul class="billing-dashboard-payment-list">${payments}</ul></section>`;
  }

  function renderSummary() {
    if (state.view === 'dashboard') return;
    try {
      const summary = projection().summary || {};
      const readyItems = projection().items.filter((item) => item.status === 'ready');
      const readyTotal = readyItems.reduce((sum, item) => sum + (preview(item)?.totalGrossMinor || 0), 0);
      const currency = readyItems.length ? customer(readyItems[0].customerId)?.billing?.currency || 'DKK' : 'DKK';
      els.summary.innerHTML = `
        <article class="billing-summary-item is-primary"><span class="billing-summary-label">Klar nu</span><strong class="billing-summary-value">${esc(formatMoney(readyTotal, currency, locale()))}</strong><span class="billing-summary-detail">${summary.ready || 0} klar</span></article>
        <article class="billing-summary-item"><span class="billing-summary-label">Venter</span><strong class="billing-summary-value">${summary.waiting || 0}</strong><span class="billing-summary-detail">senere i perioden</span></article>
        <article class="billing-summary-item"><span class="billing-summary-label">Mangler</span><strong class="billing-summary-value">${summary.needsInfo || 0}</strong><span class="billing-summary-detail">kræver handling</span></article>
        <article class="billing-summary-item"><span class="billing-summary-label">Faktureret</span><strong class="billing-summary-value">${summary.invoiced || 0}</strong><span class="billing-summary-detail">dubletbeskyttet</span></article>`;
    } catch (err) {
      console.error('renderSummary failed', err);
      els.summary.innerHTML = '<div class="billing-error"><strong>Fejl i oversigt.</strong><br>Kunne ikke vise faktureringsoversigten.</div>';
    }
  }

  function renderList() {
    // Update tab active states for all views including dashboard
    $$('.billing-tab').forEach((tab) => {
      const selected = tab.dataset.view === state.view;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    if (state.view === 'dashboard') {
      renderDashboard();
      return;
    }
    if (state.view === 'products') {
      renderProducts();
      return;
    }
    if (state.view === 'recurring') {
      renderRecurring();
      return;
    }
    if (state.view === 'search-invoices' || state.view === 'search-customers') {
      renderSearchView();
      return;
    }
    try {
      const [label, contextText] = VIEWS[state.view];
      els.title.textContent = label;
      els.context.textContent = contextText;
      const summary = projection().summary || {};
      const counts = {
        inbox: (summary.needsInfo || 0) + (summary.ready || 0) + (summary.waiting || 0),
        ready: summary.ready || 0, waiting: summary.waiting || 0,
        needs_info: summary.needsInfo || 0, invoiced: summary.invoiced || 0,
      };
      Object.entries(counts).forEach(([key, value]) => {
        const node = $(`[data-count="${key}"]`);
        if (node) node.textContent = String(value);
      });
      const items = itemsForBillingView(projection().items || [], state.view);
      if (!items.length) {
        els.list.innerHTML = '<div class="billing-empty">Ingen poster i denne visning.</div>';
        return;
      }
      els.list.innerHTML = items.map((item) => `
        <article class="billing-row" data-status="${esc(item.status)}">
          <div class="billing-row-main"><h3 class="billing-row-name"><span class="billing-status-dot" aria-hidden="true"></span>${esc(item.customerName)}</h3><div class="billing-row-subtitle">${esc(subtitleFor(item))}</div></div>
          <div class="billing-row-meta"><strong>${esc(amountFor(item))}</strong><small>${item.visitIds?.length || 0} besøg</small></div>
          <div class="billing-row-reason"><strong>${esc(REASONS[item.reasonCode] || 'Kræver gennemgang')}</strong>${esc(detailFor(item))}</div>
          <div class="billing-row-action">${actionFor(item)}</div>
        </article>`).join('');
    } catch (err) {
      console.error('renderList failed', err);
      els.list.innerHTML = '<div class="billing-error"><strong>Fejl i listen.</strong><br>Kunne ikke vise faktureringsposterne.</div>';
    }
  }

  // --- Search, Filter, Sort, Pagination & Saved Views ---

  function getSavedViews() {
    return state.billing?.settings?.savedViews || [];
  }

  async function persistSavedViews(views) {
    const currentSettings = state.billing?.settings || {};
    const updated = { ...currentSettings, savedViews: views };
    try {
      await client.updateSettings(updated);
      if (state.billing) state.billing.settings = updated;
    } catch (err) {
      console.error('Failed to save views', err);
      toast('Kunne ikke gemme visning');
    }
  }

  async function saveCurrentView(name) {
    if (!name) return;
    const view = { name, ...state.searchQuery, savedAt: new Date().toISOString() };
    const views = [...getSavedViews()];
    const idx = views.findIndex((v) => v.name === name && v.type === state.searchQuery.type);
    if (idx >= 0) views[idx] = view; else views.push(view);
    state.savedViews = views;
    await persistSavedViews(views);
    toast(`Visning "${name}" gemt`);
    renderSearchView();
  }

  function loadSavedView(view) {
    if (!view) return;
    state.searchQuery = { type: view.type || 'invoice', search: view.search || '', status: view.status || '', dateFrom: view.dateFrom || '', dateTo: view.dateTo || '', customerId: view.customerId || '', sortBy: view.sortBy || 'issuedAt', sortOrder: view.sortOrder || 'desc', limit: view.limit || 25, offset: 0 };
    runSearch();
  }

  async function deleteSavedView(name, type) {
    const views = getSavedViews().filter((v) => !(v.name === name && v.type === type));
    state.savedViews = views;
    await persistSavedViews(views);
    toast(`Visning "${name}" slettet`);
    renderSearchView();
  }

  async function runSearch() {
    state.searchLoading = true;
    renderSearchView();
    try {
      const result = await client.queryBilling(state.searchQuery);
      state.searchResults = result;
    } catch (err) {
      console.error('runSearch failed', err);
      state.searchResults = { error: err?.message || 'Søgning mislykkedes' };
    } finally {
      state.searchLoading = false;
      renderSearchView();
    }
  }

  function searchControlsHtml(type) {
    const q = state.searchQuery;
    const isInvoice = type === 'invoice';
    const statusOptions = isInvoice
      ? [['', 'Alle statusser'], ['draft', 'Kladde'], ['issued', 'Udstedt'], ['overdue', 'Forfalden'], ['paid', 'Betalt']]
      : [['', 'Alle statusser'], ['active', 'Aktiv'], ['inactive', 'Inaktiv']];
    const sortOptions = isInvoice
      ? [['issuedAt', 'Dato'], ['customerName', 'Kunde'], ['totalGrossMinor', 'Beløb'], ['number', 'Nummer']]
      : [['name', 'Navn'], ['email', 'E-mail'], ['invoiceCount', 'Fakturaer'], ['totalBilledMinor', 'Omsætning']];
    const viewsForType = getSavedViews().filter((v) => v.type === type);
    const viewsHtml = viewsForType.length
      ? `<div class="billing-saved-views"><label>Gemte visninger</label><select data-search-action="load-view"><option value="">Vælg visning…</option>${viewsForType.map((v) => `<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('')}</select></div>`
      : '';
    return `<div class="billing-search-controls">
      <div class="billing-search-bar">
        <input type="search" data-search-field="search" placeholder="${isInvoice ? 'Søg fakturanummer, kunde…' : 'Søg navn, e-mail…'}" value="${esc(q.search)}" aria-label="Søgetekst">
        <button type="button" class="billing-primary-button" data-search-action="run">Søg</button>
      </div>
      <div class="billing-filter-chips">
        <select data-search-field="status" aria-label="Statusfilter">${statusOptions.map(([val, label]) => `<option value="${val}"${q.status === val ? ' selected' : ''}>${label}</option>`).join('')}</select>
        ${isInvoice ? `<input type="text" data-search-field="customerId" placeholder="Kunde-ID" value="${esc(q.customerId)}" aria-label="Kunde-ID filter" style="max-width:8rem">` : ''}
        <input type="date" data-search-field="dateFrom" value="${esc(q.dateFrom)}" aria-label="Fra dato" title="Fra dato">
        <input type="date" data-search-field="dateTo" value="${esc(q.dateTo)}" aria-label="Til dato" title="Til dato">
        <select data-search-field="sortBy" aria-label="Sortér efter">${sortOptions.map(([val, label]) => `<option value="${val}"${q.sortBy === val ? ' selected' : ''}>${label}</option>`).join('')}</select>
        <button type="button" class="billing-secondary-button" data-search-action="toggle-sort" aria-label="Skift sorteringsretning">${q.sortOrder === 'asc' ? '↑ Stigende' : '↓ Faldende'}</button>
      </div>
      <div class="billing-search-actions">
        ${viewsHtml}
        <input type="text" data-search-field="save-name" placeholder="Navn på visning" aria-label="Gem visningsnavn" style="max-width:10rem">
        <button type="button" class="billing-secondary-button" data-search-action="save-view">Gem visning</button>
      </div>
    </div>`;
  }

  function paginationHtml(result) {
    if (!result || !result.total) return '';
    const { total, limit, offset, hasMore } = result;
    const page = Math.floor(offset / limit) + 1;
    const pages = Math.ceil(total / limit);
    return `<nav class="billing-pagination" aria-label="Sideinddeling">
      <span class="billing-pagination-info">${offset + 1}–${Math.min(offset + limit, total)} af ${total}</span>
      <button type="button" class="billing-secondary-button" data-search-action="prev-page" ${offset <= 0 ? 'disabled' : ''}>← Forrige</button>
      <span class="billing-pagination-page">Side ${page} af ${pages}</span>
      <button type="button" class="billing-secondary-button" data-search-action="next-page" ${!hasMore ? 'disabled' : ''}>Næste →</button>
    </nav>`;
  }

  function invoiceTableHtml(items) {
    if (!items.length) return '<div class="billing-empty">Ingen fakturaer matcher søgningen.</div>';
    const loc = locale();
    return `<div class="billing-table-wrap"><table class="billing-table">
      <thead><tr><th>Nummer</th><th>Kunde</th><th>Status</th><th>Dato</th><th>Forfald</th><th class="is-numeric">Beløb</th><th class="is-numeric">Udestående</th></tr></thead>
      <tbody>${items.map((inv) => `<tr>
        <td>${esc(inv.number || inv.id.slice(0, 8))}</td>
        <td>${esc(inv.customerName)}</td>
        <td><span class="billing-status-badge is-${esc(inv.status)}">${esc({ draft: 'Kladde', issued: 'Udstedt', overdue: 'Forfalden', paid: 'Betalt' }[inv.status] || inv.status)}</span></td>
        <td>${esc(formatDate(inv.issuedAt, loc))}</td>
        <td>${inv.dueDate ? esc(formatDate(inv.dueDate, loc)) : '—'}</td>
        <td class="is-numeric">${esc(formatMoney(inv.totalGrossMinor, inv.currency, loc))}</td>
        <td class="is-numeric">${esc(formatMoney(inv.outstandingMinor, inv.currency, loc))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function customerTableHtml(items) {
    if (!items.length) return '<div class="billing-empty">Ingen kunder matcher søgningen.</div>';
    const loc = locale();
    return `<div class="billing-table-wrap"><table class="billing-table">
      <thead><tr><th>Navn</th><th>E-mail</th><th>Status</th><th>Faktureringsmetode</th><th class="is-numeric">Fakturaer</th><th class="is-numeric">Omsætning</th></tr></thead>
      <tbody>${items.map((cust) => `<tr>
        <td>${esc(cust.name)}</td>
        <td>${esc(cust.email)}</td>
        <td><span class="billing-status-badge is-${esc(cust.status)}">${esc(cust.status === 'active' ? 'Aktiv' : 'Inaktiv')}</span></td>
        <td>${esc({ per_visit: 'Per besøg', monthly_batch: 'Månedlig samling' }[cust.billingMode] || cust.billingMode || '—')}</td>
        <td class="is-numeric">${cust.invoiceCount}</td>
        <td class="is-numeric">${esc(formatMoney(cust.totalBilledMinor, cust.currency, loc))}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  function renderSearchView() {
    const type = state.view === 'search-customers' ? 'customer' : 'invoice';
    const title = type === 'invoice' ? 'Søg fakturaer' : 'Søg kunder';
    const contextText = type === 'invoice' ? 'Find og filtrér fakturaer på tværs af status, dato og kunde.' : 'Find og filtrér kunder på navn, e-mail og status.';
    els.title.textContent = title;
    els.context.textContent = contextText;
    els.summary.innerHTML = '';

    const controls = searchControlsHtml(type);
    let results = '';
    if (state.searchLoading) {
      results = '<div class="billing-skeleton" aria-busy="true" aria-label="Søger"><div class="billing-skeleton-card"><div class="billing-skeleton-line is-title"></div><div class="billing-skeleton-line is-long"></div></div></div>';
    } else if (state.searchResults?.error) {
      results = `<div class="billing-error"><strong>Søgefejl.</strong><br>${esc(state.searchResults.error)}</div>`;
    } else if (state.searchResults) {
      const table = type === 'invoice' ? invoiceTableHtml(state.searchResults.items || []) : customerTableHtml(state.searchResults.items || []);
      results = table + paginationHtml(state.searchResults);
    } else {
      results = '<div class="billing-empty">Brug søgefeltet og filtrene ovenfor for at finde resultater.</div>';
    }

    // Save/delete buttons for saved views rendered inline
    const viewsForType = getSavedViews().filter((v) => v.type === type);
    const savedListHtml = viewsForType.length
      ? `<div class="billing-saved-list"><h4>Gemte visninger</h4><ul>${viewsForType.map((v) => `<li><button type="button" class="billing-quiet-button" data-search-action="load-view" data-view-name="${esc(v.name)}">${esc(v.name)}</button><button type="button" class="billing-icon-button" data-search-action="delete-view" data-view-name="${esc(v.name)}" aria-label="Slet visning">×</button></li>`).join('')}</ul></div>`
      : '';

    els.list.innerHTML = `${controls}${savedListHtml}${results}`;
  }

  function handleSearchEvent(event) {
    const target = event.target;
    const action = target?.dataset?.searchAction;
    const field = target?.dataset?.searchField;

    if (field) {
      state.searchQuery[field] = target.value;
      if (field === 'search' && event.type === 'keydown' && event.key === 'Enter') {
        event.preventDefault();
        state.searchQuery.offset = 0;
        runSearch();
      }
      return;
    }

    if (action === 'run') {
      state.searchQuery.offset = 0;
      runSearch();
    } else if (action === 'toggle-sort') {
      state.searchQuery.sortOrder = state.searchQuery.sortOrder === 'asc' ? 'desc' : 'asc';
      state.searchQuery.offset = 0;
      runSearch();
    } else if (action === 'next-page') {
      state.searchQuery.offset += state.searchQuery.limit;
      runSearch();
    } else if (action === 'prev-page') {
      state.searchQuery.offset = Math.max(0, state.searchQuery.offset - state.searchQuery.limit);
      runSearch();
    } else if (action === 'save-view') {
      const nameInput = $('[data-search-field="save-name"]');
      const name = String(nameInput?.value || '').trim();
      if (!name) return toast('Angiv et navn for visningen');
      saveCurrentView(name);
    } else if (action === 'load-view') {
      const name = target.dataset.viewName || target.value;
      if (!name) return;
      const view = getSavedViews().find((v) => v.name === name && v.type === (state.view === 'search-customers' ? 'customer' : 'invoice'));
      if (view) loadSavedView(view);
    } else if (action === 'delete-view') {
      const name = target.dataset.viewName;
      if (name) deleteSavedView(name, state.view === 'search-customers' ? 'customer' : 'invoice');
    }
  }

  function render() {
    if (!state.billing) return;
    renderSummary();
    renderList();
    renderConnection();
    if (els.companySettings) {
      els.companySettings.disabled = !canMutate();
      els.companySettings.setAttribute('aria-disabled', String(!canMutate()));
      els.companySettings.title = canMutate() ? '' : 'Kræver online og aktuelle data';
    }
    const financialActions = $$('[data-action="review"],[data-action="actuals"],[data-action="issue"],[data-action="deliver"],[data-action="peppol"]');
    financialActions.forEach((button) => {
      button.disabled = !canMutate();
      button.setAttribute('aria-disabled', String(!canMutate()));
    });
  }

  function clearSensitiveState() {
    state.billing = null;
    state.cached = false;
    state.cachedAt = null;
    state.lastSyncedAt = null;
    state.activeItem = null;
    state.activeInvoice = null;
  }

  function applyIdentity(session) {
    const nextIdentity = session?.cacheIdentity || null;
    if (state.cacheIdentity && state.cacheIdentity !== nextIdentity) clearSensitiveState();
    state.actor = session?.actor || null;
    state.cacheIdentity = nextIdentity;
  }

  function adoptMemorySnapshot() {
    if (!state.billing) return false;
    state.cached = true;
    state.cachedAt = state.lastSyncedAt;
    render();
    return true;
  }

  async function refresh() {
    if (state.busy) { state.refreshPending = true; return; }
    state.busy = true;
    els.refresh.disabled = true;
    showSkeleton();
    state.online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    try {
      const session = await resolveBillingSession(client, { online: state.online });
      applyIdentity(session);

      if (!state.actor || !state.cacheIdentity) {
        clearSensitiveState();
        els.summary.innerHTML = '';
        els.list.innerHTML = '<div class="billing-error"><strong>Fakturering er låst offline.</strong><br>Der findes ingen verificeret session til denne lokale kopi.</div>';
        connection('Ingen verificeret session', 'degraded');
        return;
      }

      if (!state.online || session.degraded) {
        if (!adoptMemorySnapshot() && !state.billing) {
          els.summary.innerHTML = '';
          els.list.innerHTML = '<div class="billing-error"><strong>Fakturering er offline.</strong><br>Der findes ingen tidligere synkroniseret visning for denne session.</div>';
        } else if (!state.cached && state.billing) {
          state.cached = true;
          state.cachedAt = state.lastSyncedAt;
        }
        renderConnection();
        return;
      }

      connection('Synkroniserer…');
      const body = await client.load();
      const syncedAt = new Date().toISOString();
      state.billing = body.billing;
      state.cached = false;
      state.cachedAt = null;
      state.lastSyncedAt = syncedAt;
      clearRetry();
      if (state.view === 'dashboard') await fetchDashboard();
      render();
    } catch (error) {
      const authenticationFailed = error?.status === 401 || error?.status === 403 || error?.code === 'authentication_required';
      if (authenticationFailed) {
        clearSensitiveState();
        state.actor = null;
        state.cacheIdentity = null;
      }
      const usedCache = authenticationFailed ? false : adoptMemorySnapshot();
      if (!usedCache && !state.billing) {
        els.summary.innerHTML = '';
        els.list.innerHTML = authenticationFailed
          ? '<div class="billing-error"><strong>Sessionen er udløbet.</strong><br>Log ind i Aftergraph igen for at åbne fakturering.</div>'
          : '<div class="billing-error"><strong>Fakturering er utilgængelig.</strong><br>Der findes ingen verificeret lokal kopi.</div>';
        connection(authenticationFailed ? 'Session udløbet' : 'Kan ikke hente data', 'degraded');
      }
      if (usedCache && state.online) scheduleRetry();
      if (!usedCache) console.error('billing load failed', error);
      toast(usedCache ? 'Viser senest synkroniserede data' : authenticationFailed ? 'Log ind igen' : 'Kunne ikke opdatere fakturering');
    } finally {
      state.busy = false;
      els.refresh.disabled = false;
      if (state.refreshPending) {
        state.refreshPending = false;
        queueMicrotask(() => void refresh());
      }
    }
  }

  function findItem(key) {
    return projection().items.find((item) => itemKey(item) === key) || null;
  }

  function openDialog() {
    state.returnFocus = document.activeElement;
    if (typeof els.review.showModal === 'function') els.review.showModal();
    else els.review.setAttribute('open', '');
  }

  function closeDialog() {
    if (typeof els.review.close === 'function') els.review.close();
    else els.review.removeAttribute('open');
    state.activeItem = null;
    state.activeInvoice = null;
    const returnFocus = state.returnFocus;
    state.returnFocus = null;
    if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
  }

  function showConfirmDialog(message) {
    return new Promise((resolve) => {
      let dialog = document.getElementById('billing-confirm-dialog');
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'billing-confirm-dialog';
        dialog.className = 'billing-confirm-dialog';
        dialog.innerHTML = '<p class="billing-confirm-message"></p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-confirm="cancel">Annuller</button><button type="button" class="billing-primary-button" data-confirm="ok">Bekræft</button></div>';
        document.body.appendChild(dialog);
      }
      const msgEl = dialog.querySelector('.billing-confirm-message');
      msgEl.textContent = message;
      const cleanup = () => {
        dialog.removeEventListener('click', onClick);
        dialog.removeEventListener('cancel', onCancel);
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      };
      const onClick = (event) => {
        const btn = event.target.closest('[data-confirm]');
        if (!btn) return;
        cleanup();
        resolve(btn.dataset.confirm === 'ok');
      };
      const onCancel = (event) => {
        event.preventDefault();
        cleanup();
        resolve(false);
      };
      dialog.addEventListener('click', onClick);
      dialog.addEventListener('cancel', onCancel);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  }

  function lineHtml(item, projected) {
    const visits = visitsFor(item);
    return projected.lines.map((line) => {
      const sourceVisit = visits.find((entry) => entry.id === line.visitId);
      const discount = line.discountMinor
        ? `<small>${line.discountPercent}% rabat · −${esc(formatMoney(line.discountMinor, projected.currency, locale()))}</small>` : '';
      return `<div class="billing-review-line"><div><strong>${esc(formatDate(sourceVisit?.scheduledStart, locale()))}</strong><small>${esc(formatWorkMinutes(line.workMinutes, locale()))} · ${esc(formatMoney(line.rateMinor, projected.currency, locale()))}/time</small>${discount}</div><div class="billing-review-line-amount">${esc(formatMoney(line.totalGrossMinor, projected.currency, locale()))}</div></div>`;
    }).join('');
  }

  function outstandingFor(inv) {
    if (!inv || !Number.isInteger(inv.totalGrossMinor)) return 0;
    const paid = (inv.payments || []).reduce((sum, p) => sum + (Number.isInteger(p.amountMinor) ? p.amountMinor : 0), 0);
    return Math.max(0, inv.totalGrossMinor - paid);
  }

  function paymentFormHtml(inv) {
    const outstanding = outstandingFor(inv);
    if (outstanding <= 0) return '';
    const disabled = canMutate() ? '' : ' disabled aria-disabled="true"';
    const currency = inv.currency || 'DKK';
    return `<section class="billing-payment-section" aria-label="Registrér betaling">
      <h4>Registrér betaling</h4>
      <p class="billing-form-help">Udestående: <strong>${esc(formatMoney(outstanding, currency, locale()))}</strong></p>
      <form id="billing-payment-form" class="billing-form" aria-describedby="billing-payment-error">
        <input type="hidden" name="invoiceId" value="${esc(inv.id)}">
        <div class="billing-field"><label for="payment-amount">Beløb (${esc(currency)})</label><input id="payment-amount" name="amount" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="${esc(String((outstanding / 100).toFixed(2)))}" required${disabled}></div>
        <div class="billing-field"><label for="payment-method">Betalingsmetode</label><select id="payment-method" name="method" required${disabled}><option value="">Vælg metode</option><option value="bank_transfer">Bankoverførsel</option><option value="mobilepay">MobilePay</option><option value="card">Kort</option><option value="cash">Kontant</option><option value="other">Andet</option></select></div>
        <div class="billing-field"><label for="payment-reference">Reference</label><input id="payment-reference" name="reference" placeholder="Transaktionsnr. eller note"${disabled}></div>
        <div class="billing-field"><label for="payment-date">Betalingsdato</label><input id="payment-date" name="paidAt" type="date" value="${today()}" required${disabled}></div>
        <p id="billing-payment-error" class="billing-form-error" role="alert" hidden></p>
        <div class="billing-form-actions"><button type="submit" class="billing-primary-button"${disabled}>Registrér betaling</button></div>
      </form>
    </section>`;
  }

  function creditNoteFormHtml(inv) {
    const disabled = canMutate() ? '' : ' disabled aria-disabled="true"';
    return `<section class="billing-credit-section" aria-label="Opret kreditnota">
      <h4>Kreditnota</h4>
      <form id="billing-credit-form" class="billing-form" aria-describedby="billing-credit-error">
        <input type="hidden" name="invoiceId" value="${esc(inv.id)}">
        <div class="billing-field"><label for="credit-reason">Årsag til kreditnota</label><textarea id="credit-reason" name="reason" maxlength="1000" required placeholder="Begrundelse for annullering"${disabled}></textarea></div>
        <p class="billing-form-help">Annullerer fakturaen og opretter en kreditnota. Denne handling kan ikke fortrydes.</p>
        <p id="billing-credit-error" class="billing-form-error" role="alert" hidden></p>
        <div class="billing-form-actions"><button type="submit" class="billing-secondary-button" style="color:#b91c1c;border-color:#b91c1c"${disabled}>Opret kreditnota</button></div>
      </form>
    </section>`;
  }

  function controlsHtml() {
    const disabled = canMutate() ? '' : ' disabled aria-disabled="true" title="Kræver online og aktuelle data"';
    if (state.activeInvoice) {
      const issued = ['issued', 'emailed'].includes(state.activeInvoice.status);
      const emailed = state.activeInvoice.status === 'emailed';
      const deliveryFailed = state.activeInvoice.delivery?.state === 'failed';
      const voided = state.activeInvoice.status === 'void';
      const pendingApproval = state.activeInvoice.status === 'pending_approval';
      const approvalPolicy = state.billing?.settings?.approvalPolicy || {};
      const status = voided ? 'Kreditnota oprettet' : emailed ? 'Sendt til kunde' : deliveryFailed ? 'Levering fejlede' : pendingApproval ? 'Afventer godkendelse' : issued ? 'Faktura udstedt' : 'Kladde oprettet';
      const deliveryDetail = emailed
        ? `<p>Leveret ${esc(formatDate(state.activeInvoice.delivery?.deliveredAt, locale()))} via ${esc(state.activeInvoice.delivery?.provider || 'provider')}.</p>`
        : deliveryFailed ? '<p>Fakturaen er stadig udstedt. Du kan prøve leveringen igen.</p>' : '';
      const voidDetail = voided ? `<p>Annulleret ${esc(formatDate(state.activeInvoice.voidedAt, locale()))}. Årsag: ${esc(state.activeInvoice.voidReason || '—')}</p>` : '';
      const approvalEvents = [];
      if (state.activeInvoice.approval?.requestedAt) {
        approvalEvents.push(`<div class="billing-approval-event is-pending"><strong>Anmodet om godkendelse</strong><time>${esc(state.activeInvoice.approval.requestedBy || 'ukendt')} · ${esc(formatDate(state.activeInvoice.approval.requestedAt, locale()))}</time></div>`);
      }
      if (state.activeInvoice.approval?.approvedBy) {
        approvalEvents.push(`<div class="billing-approval-event is-approved"><strong>Godkendt</strong><time>${esc(state.activeInvoice.approval.approvedBy)} · ${esc(formatDate(state.activeInvoice.approval.approvedAt, locale()))}</time></div>`);
      }
      if (state.activeInvoice.approval?.rejectedBy) {
        approvalEvents.push(`<div class="billing-approval-event is-rejected"><strong>Afvist</strong><time>${esc(state.activeInvoice.approval.rejectedBy)} · ${esc(formatDate(state.activeInvoice.approval.rejectedAt, locale()))}</time><small>${esc(state.activeInvoice.approval.rejectionReason || 'Ingen begrundelse')}</small></div>`);
      }
      const approvalTimeline = approvalEvents.length
        ? `<div class="billing-approval-timeline" aria-label="Godkendelseshistorik">${approvalEvents.join('')}</div>`
        : '';
      const artifact = issued && !voided ? `<button type="button" class="billing-secondary-button" data-action="download" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Download faktura</button>` : '';
      const deliver = issued && !emailed && !voided ? `<button type="button" class="billing-primary-button" data-action="deliver" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>${deliveryFailed ? 'Prøv levering igen' : 'Send faktura'}</button>` : '';
      const issue = issued || voided || pendingApproval ? '' : (approvalPolicy.required
        ? `<button type="button" class="billing-secondary-button" data-action="request-approval" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Anmod om godkendelse</button>`
        : `<button type="button" class="billing-primary-button" data-action="issue" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Udsted faktura</button>`);
      const approveBtn = pendingApproval ? `<button type="button" class="billing-primary-button" data-action="approve-invoice" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Godkend faktura</button>` : '';
      const rejectBtn = pendingApproval ? `<button type="button" class="billing-secondary-button" data-action="reject-approval" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Afvis</button>` : '';
      const editManual = !issued && !voided && !pendingApproval && state.activeInvoice.source === 'manual' ? `<button type="button" class="billing-secondary-button" data-action="edit-manual-draft" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Redigér kladde</button>` : '';
      const isOverdue = issued && !voided && state.activeInvoice.dueDate && new Date() > new Date(`${state.activeInvoice.dueDate}T23:59:59.999Z`);
      const overdueBadge = isOverdue ? '<span class="billing-overdue-badge" aria-label="Fakturaen er forfalden">⚠ Forfalden</span>' : '';
      const remind = issued && !voided ? `<button type="button" class="billing-secondary-button" data-action="send-reminder" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Send rykker</button>` : '';
      const paymentSection = issued && !voided ? paymentFormHtml(state.activeInvoice) : '';
      const creditSection = issued && !voided ? creditNoteFormHtml(state.activeInvoice) : '';
      return `<div class="billing-draft-status"><strong>${status}</strong>${overdueBadge}<p>Nr. ${esc(state.activeInvoice.number)} · forfalder ${esc(formatDate(state.activeInvoice.dueDate, locale()))}</p>${deliveryDetail}${voidDetail}${approvalTimeline}</div><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Luk</button>${artifact}${editManual}${issue}${approveBtn}${rejectBtn}${deliver}${remind}</div>${paymentSection}${creditSection}`;
    }
    const nextNumber = state.billing?.settings?.invoiceSequence?.nextNumber ?? '—';
    const correctionVisit = state.activeItem?.visitIds?.length === 1 ? visit(state.activeItem.visitIds[0]) : null;
    const correction = correctionVisit?.actual
      ? `<div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="correct-actuals"${disabled}>Korrigér actuals</button></div>`
      : '';
    return `${correction}<form id="billing-draft-form" class="billing-form" aria-describedby="billing-draft-error"><div class="billing-field"><label for="billing-issue-date">Fakturadato</label><input id="billing-issue-date" name="issueDate" type="date" value="${today()}" required${disabled}></div><p class="billing-form-help">Næste fakturanummer: <strong>${esc(nextNumber)}</strong>. Nummeret reserveres automatisk og atomisk, når kladden oprettes.</p><p id="billing-draft-error" class="billing-form-error" role="alert" hidden></p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button"${disabled}>Opret kladde</button></div></form>`;
  }

  function renderReview() {
    try {
      const item = state.activeItem;
      const projected = item ? preview(item) : null;
      const account = item ? customer(item.customerId) : null;
      if (!item || !projected || !account) {
        els.reviewBody.innerHTML = '<div class="billing-error"><strong>Kan ikke danne fakturakladde.</strong><br>Nødvendige actuals eller prisoplysninger mangler.</div>';
        return;
      }
      els.reviewKicker.textContent = state.activeInvoice ? 'Faktura' : 'Fakturakladde';
      els.reviewTitle.textContent = state.activeInvoice?.status === 'emailed' ? 'Faktura sendt' : state.activeInvoice?.status === 'issued' ? 'Faktura udstedt' : 'Gennemgå faktura';
      els.reviewBody.innerHTML = `<section class="billing-review-customer"><h3>${esc(account.name)}</h3><p>${item.visitIds.length} besøg</p></section><section class="billing-review-lines" aria-label="Fakturalinjer">${lineHtml(item, projected)}</section><section class="billing-totals" aria-label="Fakturatotaler">${projected.discountMinor ? `<div class="billing-total-row"><span>Rabat</span><span>−${esc(formatMoney(projected.discountMinor, projected.currency, locale()))}</span></div>` : ''}<div class="billing-total-row"><span>Ekskl. moms</span><span>${esc(formatMoney(projected.totalNetMinor, projected.currency, locale()))}</span></div><div class="billing-total-row"><span>Moms</span><span>${esc(formatMoney(projected.taxMinor, projected.currency, locale()))}</span></div><div class="billing-total-row is-total"><span>I alt</span><span>${esc(formatMoney(projected.totalGrossMinor, projected.currency, locale()))}</span></div></section>${controlsHtml()}`;
      appendPeppolControl();
    } catch (err) {
      console.error('renderReview failed', err);
      els.reviewBody.innerHTML = '<div class="billing-error"><strong>Fejl i fakturagennemgang.</strong><br>Kunne ikke vise fakturadetaljerne.</div>';
    }
  }

  function appendPeppolControl() {
    if (!state.activeInvoice || !['issued', 'emailed'].includes(state.activeInvoice.status)) return;
    const actions = $('.billing-form-actions', els.reviewBody);
    if (!actions) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'billing-secondary-button';
    button.dataset.action = 'peppol';
    button.dataset.invoiceId = state.activeInvoice.id;
    button.textContent = 'Download UBL';
    button.disabled = !canMutate();
    button.title = 'Peppol BIS Billing 3.0 / UBL';
    const primary = $('.billing-primary-button', actions);
    actions.insertBefore(button, primary || null);
  }

  function openReview(item) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    state.activeItem = structuredClone(item);
    state.activeInvoice = null;
    renderReview();
    openDialog();
    setTimeout(() => $('#billing-issue-date', els.review)?.focus(), 0);
  }

  function manualLineHtml(index, line = {}) {
    const desc = esc(line.description || '');
    const qty = esc(String(line.quantity ?? ''));
    const price = line.unitPriceMinor !== undefined ? esc(String(line.unitPriceMinor / 100)) : '';
    const disc = esc(String(line.discountPercent ?? ''));
    const activeProducts = (state.products || []).filter((p) => p.active !== false);
    const productOptions = activeProducts.length
      ? `<option value="">— Vælg produkt —</option>` + activeProducts.map((p) => `<option value="${esc(p.id)}" data-price="${p.unitPriceMinor}" data-vat="${p.vatRateBps}" data-desc="${esc(p.description || '')}">${esc(p.name)}${p.sku ? ' (' + esc(p.sku) + ')' : ''}</option>`).join('')
      : '';
    return `<div class="billing-manual-line" data-line-index="${index}">
      <div class="billing-form-row">
        <div class="billing-field is-flex-grow"><label for="manual-product-${index}">Produkt</label><select id="manual-product-${index}" name="productId" data-action="select-product">${productOptions}</select></div>
      </div>
      <div class="billing-form-row">
        <div class="billing-field is-flex-grow"><label for="manual-desc-${index}">Beskrivelse</label><input id="manual-desc-${index}" name="description" value="${desc}" required placeholder="Ydelse eller vare"></div>
        <div class="billing-field"><label for="manual-qty-${index}">Antal</label><input id="manual-qty-${index}" name="quantity" type="number" min="1" step="1" inputmode="numeric" value="${qty}" required></div>
      </div>
      <div class="billing-form-row">
        <div class="billing-field"><label for="manual-price-${index}">Enhedspris (ekskl. moms)</label><input id="manual-price-${index}" name="unitPrice" type="number" min="0" step="0.01" inputmode="decimal" value="${price}" required></div>
        <div class="billing-field"><label for="manual-disc-${index}">Rabat (%)</label><input id="manual-disc-${index}" name="discountPercent" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${disc}" placeholder="0"></div>
        <div class="billing-field is-align-end"><button type="button" class="billing-secondary-button" data-action="remove-manual-line" data-line-index="${index}" aria-label="Fjern linje ${index + 1}">Fjern</button></div>
      </div>
    </div>`;
  }

  function collectManualLines(form) {
    const containers = $$('.billing-manual-line', form);
    if (!containers.length) return [];
    return containers.map((row) => {
      const description = String($('input[name="description"]', row)?.value || '').trim();
      const quantityRaw = String($('input[name="quantity"]', row)?.value || '').replace(',', '.');
      const priceRaw = String($('input[name="unitPrice"]', row)?.value || '').replace(',', '.');
      const discRaw = String($('input[name="discountPercent"]', row)?.value || '').replace(',', '.');
      const quantity = Number(quantityRaw);
      const unitPriceMinor = Math.round(Number(priceRaw) * 100);
      const discountPercent = Number(discRaw) || 0;
      return { description, quantity, unitPriceMinor, discountPercent };
    });
  }

  function renderManualTotals(form) {
    const customerId = $('select[name="customerId"]', form)?.value;
    const account = customerId ? customer(customerId) : null;
    const currency = account?.billing?.currency || 'DKK';
    const taxRateBps = state.billing?.settings?.taxRateBps ?? account?.billing?.taxRateBps ?? 0;
    const lines = collectManualLines(form).filter((l) => l.description && Number.isInteger(l.quantity) && l.quantity > 0 && Number.isInteger(l.unitPriceMinor) && l.unitPriceMinor >= 0);
    let proj = null;
    try {
      if (lines.length) proj = projectManualInvoice({ currency, lines, taxRateBps });
    } catch { proj = null; }
    const sub = $('#billing-manual-subtotal', form);
    const tax = $('#billing-manual-tax', form);
    const tot = $('#billing-manual-total', form);
    if (sub) sub.textContent = proj ? formatMoney(proj.subtotalGrossMinor - proj.discountMinor, currency, locale()) : '—';
    if (tax) tax.textContent = proj ? formatMoney(proj.taxMinor, currency, locale()) : '—';
    if (tot) tot.textContent = proj ? formatMoney(proj.totalGrossMinor, currency, locale()) : '—';
  }

  function wireManualLiveTotals(form) {
    const handler = () => renderManualTotals(form);
    form.addEventListener('input', handler);
    form.addEventListener('change', handler);
    renderManualTotals(form);
  }

  async function openNewInvoice() {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    await fetchProducts();
    state.activeItem = null;
    state.activeInvoice = null;
    const customers = (state.billing?.customers || []).filter((c) => c.status === 'active');
    if (!customers.length) return toast('Opret en kunde før du laver en manuel faktura');
    const options = customers.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    els.reviewKicker.textContent = 'Ny faktura';
    els.reviewTitle.textContent = 'Manuel faktura';
    els.reviewBody.innerHTML = `<form id="billing-manual-form" class="billing-form" aria-describedby="billing-manual-error">
      <div class="billing-field"><label for="billing-manual-customer">Kunde</label><select id="billing-manual-customer" name="customerId" required>${options}</select></div>
      <div class="billing-field"><label for="billing-manual-issue-date">Fakturadato</label><input id="billing-manual-issue-date" name="issueDate" type="date" value="${today()}" required></div>
      <fieldset class="billing-manual-lines"><legend>Fakturalinjer</legend><div id="billing-manual-lines-container">${manualLineHtml(0)}</div><button type="button" class="billing-secondary-button" data-action="add-manual-line">Tilføj linje</button></fieldset>
      <section class="billing-totals" aria-label="Fakturatotaler">
        <div class="billing-total-row"><span>Ekskl. moms</span><span id="billing-manual-subtotal">—</span></div>
        <div class="billing-total-row"><span>Moms</span><span id="billing-manual-tax">—</span></div>
        <div class="billing-total-row is-total"><span>I alt</span><span id="billing-manual-total">—</span></div>
      </section>
      <p id="billing-manual-error" class="billing-form-error" role="alert" hidden></p>
      <div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">Opret kladde</button></div>
    </form>`;
    openDialog();
    const form = $('#billing-manual-form', els.review);
    wireManualLiveTotals(form);
    setTimeout(() => $('#billing-manual-customer', els.review)?.focus(), 0);
  }

  async function openManualDraftEdit(invoiceId) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    await fetchProducts();
    const inv = invoice(invoiceId);
    if (!inv || inv.status !== 'draft' || inv.source !== 'manual') return toast('Kun manuelle kladder kan redigeres');
    const account = customer(inv.customerId);
    if (!account) return toast('Kunden findes ikke');
    state.activeItem = null;
    state.activeInvoice = structuredClone(inv);
    const customers = (state.billing?.customers || []).filter((c) => c.status === 'active');
    const options = customers.map((c) => `<option value="${esc(c.id)}"${c.id === inv.customerId ? ' selected disabled' : ''}>${esc(c.name)}</option>`).join('');
    const lines = (inv.manualLines || []).map((l, i) => manualLineHtml(i, l)).join('') || manualLineHtml(0);
    els.reviewKicker.textContent = 'Redigér kladde';
    els.reviewTitle.textContent = `Redigér faktura ${esc(inv.number)}`;
    els.reviewBody.innerHTML = `<form id="billing-manual-form" class="billing-form" aria-describedby="billing-manual-error">
      <input type="hidden" name="invoiceId" value="${esc(inv.id)}">
      <div class="billing-field"><label for="billing-manual-customer">Kunde</label><select id="billing-manual-customer" name="customerId" required>${options}</select></div>
      <div class="billing-field"><label for="billing-manual-issue-date">Fakturadato</label><input id="billing-manual-issue-date" name="issueDate" type="date" value="${esc(inv.issueDate || today())}" required></div>
      <fieldset class="billing-manual-lines"><legend>Fakturalinjer</legend><div id="billing-manual-lines-container">${lines}</div><button type="button" class="billing-secondary-button" data-action="add-manual-line">Tilføj linje</button></fieldset>
      <section class="billing-totals" aria-label="Fakturatotaler">
        <div class="billing-total-row"><span>Ekskl. moms</span><span id="billing-manual-subtotal">—</span></div>
        <div class="billing-total-row"><span>Moms</span><span id="billing-manual-tax">—</span></div>
        <div class="billing-total-row is-total"><span>I alt</span><span id="billing-manual-total">—</span></div>
      </section>
      <p id="billing-manual-error" class="billing-form-error" role="alert" hidden></p>
      <div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">Gem ændringer</button></div>
    </form>`;
    openDialog();
    const form = $('#billing-manual-form', els.review);
    wireManualLiveTotals(form);
    setTimeout(() => $('input[name="description"]', form)?.focus(), 0);
  }

  function handleManualFormSubmit(form) {
    const invoiceId = $('input[name="invoiceId"]', form)?.value || null;
    const customerId = String($('select[name="customerId"]', form)?.value || '').trim();
    const issueDate = String($('input[name="issueDate"]', form)?.value || '').trim();
    if (!customerId) return showFormError(form, 'Vælg en kunde');
    if (!issueDate) return showFormError(form, 'Angiv fakturadato');
    const lines = collectManualLines(form);
    const validLines = lines.filter((l) => l.description);
    if (!validLines.length) return showFormError(form, 'Tilføj mindst én fakturalinje');
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.description) return showFormError(form, `Beskrivelse er påkrævet (linje ${i + 1})`);
      if (!Number.isInteger(l.quantity) || l.quantity < 1) return showFormError(form, `Antal skal være et positivt heltal (linje ${i + 1})`);
      if (!Number.isInteger(l.unitPriceMinor) || l.unitPriceMinor < 0) return showFormError(form, `Enhedspris skal være et ikke-negativt tal (linje ${i + 1})`);
    }
    showFormError(form);
    const payload = { customerId, issueDate, lines: validLines };
    if (invoiceId) {
      updateManualDraft(invoiceId, payload, form);
    } else {
      saveManualDraft(payload, form);
    }
  }

  async function saveManualDraft(payload, form) {
    state.busy = true;
    render();
    try {
      await client.createManualDraft(payload);
      toast('Fakturakladde oprettet');
      closeDialog();
      await refresh();
    } catch (err) {
      showFormError(form, `Kunne ikke oprette fakturakladde: ${err?.message || err}`);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function updateManualDraft(invoiceId, payload, form) {
    state.busy = true;
    render();
    try {
      await client.updateDraft({ invoiceId, ...payload });
      toast('Fakturakladde opdateret');
      closeDialog();
      await refresh();
    } catch (err) {
      showFormError(form, `Kunne ikke opdatere fakturakladde: ${err?.message || err}`);
    } finally {
      state.busy = false;
      render();
    }
  }

  function openCustomerManager() {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    state.activeItem = null;
    state.activeInvoice = null;
    const customers = state.billing?.customers || [];
    els.reviewKicker.textContent = 'Kundestyring';
    els.reviewTitle.textContent = 'Kunder';
    const listHtml = customers.length
      ? `<ul class="billing-customer-list">${customers.map((c) => `<li class="billing-customer-row"><div><strong>${esc(c.name)}</strong><small>${esc(c.email || '')}${c.countryCode ? ` · ${esc(c.countryCode)}` : ''}</small></div><button type="button" class="billing-secondary-button" data-action="edit-customer" data-customer-id="${esc(c.id)}">Redigér</button></li>`).join('')}</ul>`
      : '<p class="billing-form-help">Ingen kunder registreret endnu.</p>';
    els.reviewBody.innerHTML = `${listHtml}<div class="billing-form-actions" style="margin-top:1rem"><button type="button" class="billing-secondary-button" data-action="close-review">Luk</button><button type="button" class="billing-primary-button" data-action="create-customer">Opret kunde</button></div>`;
    openDialog();
  }

  function customerFormHtml(mode, customer = null) {
    const isEdit = mode === 'edit';
    const title = isEdit ? 'Redigér kunde' : 'Opret kunde';
    const kicker = isEdit ? 'Kundestyring' : 'Ny kunde';
    const c = customer || {};
    const billingCurrency = c.billing?.currency || 'DKK';
    const billingTaxRateBps = c.billing?.taxRateBps ?? 0;
    const taxPercent = (billingTaxRateBps / 100).toFixed(2).replace(/\.00$/, '');
    return { title, kicker, html: `<form id="billing-customer-form" class="billing-form" aria-describedby="billing-customer-error">
      <input type="hidden" name="mode" value="${esc(mode)}">
      <input type="hidden" name="customerId" value="${esc(c.id || '')}">
      <div class="billing-field"><label for="customer-name">Navn</label><input id="customer-name" name="name" value="${esc(c.name || '')}" required></div>
      <div class="billing-field"><label for="customer-email">E-mail</label><input id="customer-email" name="email" type="email" value="${esc(c.email || '')}" required></div>
      <div class="billing-field"><label for="customer-address">Adresse</label><input id="customer-address" name="address" value="${esc(c.address || '')}" required></div>
      <div class="billing-form-row"><div class="billing-field"><label for="customer-country">Landekode</label><input id="customer-country" name="countryCode" value="${esc(c.countryCode || '')}" maxlength="2" placeholder="DK" required></div><div class="billing-field"><label for="customer-registration">CVR / Registrerings-ID</label><input id="customer-registration" name="registrationId" value="${esc(c.registrationId || '')}"></div></div>
      <div class="billing-field"><label for="customer-registration-scheme">ID-scheme</label><input id="customer-registration-scheme" name="registrationScheme" value="${esc(c.registrationScheme || '')}" placeholder="0184"></div>
      <details class="billing-advanced"><summary>Faktureringsindstillinger</summary>
        <div class="billing-form-row"><div class="billing-field"><label for="customer-currency">Valuta</label><input id="customer-currency" name="currency" value="${esc(billingCurrency)}" maxlength="3" placeholder="DKK" required></div><div class="billing-field"><label for="customer-tax">Moms (%)</label><input id="customer-tax" name="taxPercent" type="number" min="0" max="100" step="0.01" value="${esc(taxPercent)}"></div></div>
      </details>
      <p id="billing-customer-error" class="billing-form-error" role="alert" hidden></p>
      <div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">${isEdit ? 'Gem ændringer' : 'Opret kunde'}</button></div>
    </form>` };
  }

  function openCreateCustomer() {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    const { title, kicker, html } = customerFormHtml('create');
    els.reviewKicker.textContent = kicker;
    els.reviewTitle.textContent = title;
    els.reviewBody.innerHTML = html;
    openDialog();
    setTimeout(() => $('#customer-name', els.review)?.focus(), 0);
  }

  function openEditCustomer(customerId) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    const account = customer(customerId);
    if (!account) return toast('Kunden findes ikke');
    const { title, kicker, html } = customerFormHtml('edit', account);
    els.reviewKicker.textContent = kicker;
    els.reviewTitle.textContent = title;
    els.reviewBody.innerHTML = html;
    openDialog();
    setTimeout(() => $('#customer-name', els.review)?.focus(), 0);
  }

  async function saveCustomer(form) {
    if (state.busy || !canMutate()) return;
    const data = new FormData(form);
    const mode = String(data.get('mode') || '').trim();
    const customerId = String(data.get('customerId') || '').trim();
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const address = String(data.get('address') || '').trim();
    const countryCode = String(data.get('countryCode') || '').trim().toUpperCase();
    const registrationId = String(data.get('registrationId') || '').trim() || null;
    const registrationScheme = String(data.get('registrationScheme') || '').trim() || null;
    const currency = String(data.get('currency') || '').trim().toUpperCase() || 'DKK';
    const taxPercent = Number(String(data.get('taxPercent') || '0').replace(',', '.'));
    const taxRateBps = Number.isFinite(taxPercent) && taxPercent >= 0 ? Math.round(taxPercent * 100) : 0;

    if (!name || !email || !address || !countryCode) {
      showFormError(form, 'Udfyld navn, e-mail, adresse og landekode.');
      return;
    }
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      showFormError(form, 'Landekode skal være to bogstaver (fx DK).');
      return;
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      showFormError(form, 'Valuta skal være tre bogstaver (fx DKK).');
      return;
    }

    showFormError(form);
    state.busy = true;
    form.querySelectorAll('button,input,select,textarea').forEach((node) => { node.disabled = true; });
    try {
      const payload = { name, email, address, countryCode, registrationId, registrationScheme, billing: { currency, taxRateBps } };
      let body;
      if (mode === 'edit' && customerId) {
        body = await client.updateCustomer(customerId, payload);
      } else {
        const id = globalThis.crypto?.randomUUID?.() ?? `cust-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        body = await client.createCustomer({ id, ...payload });
      }
      state.billing = body.billing;
      state.cached = false;
      state.lastSyncedAt = new Date().toISOString();
      closeDialog();
      render();
      toast(mode === 'edit' ? 'Kunden er opdateret' : 'Kunden er oprettet');
    } catch (error) {
      const message = error?.code === 'customer_not_found'
        ? 'Kunden findes ikke længere'
        : error?.code === 'duplicate_customer_id'
          ? 'En kunde med dette ID findes allerede'
          : mode === 'edit' ? 'Kunne ikke opdatere kunden' : 'Kunne ikke oprette kunden';
      showFormError(form, message);
      form.querySelectorAll('button,input,select,textarea').forEach((node) => { node.disabled = false; });
      toast(message);
    } finally {
      state.busy = false;
    }
  }

  function openCompanySettings() {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    const settings = state.billing?.settings || {};
    const issuer = settings.issuer || {};
    const endpoint = issuer.endpoint || {};
    state.activeItem = null;
    state.activeInvoice = null;
    els.reviewKicker.textContent = 'Indstillinger';
    els.reviewTitle.textContent = 'Virksomhedsprofil';
    els.reviewBody.innerHTML = `<form id="billing-company-form" class="billing-form billing-company-form" aria-describedby="billing-company-error">
      <div class="billing-form-row"><div class="billing-field"><label for="company-name">Virksomhedsnavn</label><input id="company-name" name="name" value="${esc(issuer.name || '')}" required></div><div class="billing-field"><label for="company-country">Landekode</label><input id="company-country" name="countryCode" value="${esc(issuer.countryCode || '')}" maxlength="2" placeholder="DK" required></div></div>
      <div class="billing-field"><label for="company-address">Adresse</label><input id="company-address" name="address" value="${esc(issuer.address || '')}" required></div>
      <div class="billing-form-row"><div class="billing-field"><label for="company-registration">Registrerings-ID / CVR</label><input id="company-registration" name="registrationId" value="${esc(issuer.registrationId || issuer.cvr || '')}" required></div><div class="billing-field"><label for="company-registration-scheme">ID-scheme</label><input id="company-registration-scheme" name="registrationScheme" value="${esc(issuer.registrationScheme || '')}" placeholder="0184"></div></div>
      <div class="billing-form-row"><div class="billing-field"><label for="company-email">E-mail</label><input id="company-email" name="email" type="email" value="${esc(issuer.email || '')}"></div><div class="billing-field"><label for="company-phone">Telefon</label><input id="company-phone" name="phone" value="${esc(issuer.phone || '')}"></div></div>
      <div class="billing-field"><label for="company-payment">Betalingsoplysninger</label><input id="company-payment" name="paymentText" value="${esc(issuer.paymentText || '')}" placeholder="Bank, MobilePay eller anden digital betaling"></div>
      <div class="billing-form-row"><div class="billing-field"><label for="company-service">Standardydelse</label><input id="company-service" name="defaultServiceLabel" value="${esc(settings.defaultServiceLabel || 'Service')}" required></div><div class="billing-field"><label for="company-sequence">Næste fakturanummer</label><input id="company-sequence" name="nextNumber" type="number" min="1" step="1" value="${esc(settings.invoiceSequence?.nextNumber || 1)}" required></div></div>
      <div class="billing-field"><label><input type="checkbox" name="approvalRequired" ${settings.approvalPolicy?.required ? 'checked' : ''}> Kræv godkendelse før fakturering</label><p class="billing-form-help">Når aktiveret, skal fakturaer godkendes af en bruger med godkendelsesrettigheder, før de kan udstedes.</p></div>
      <div class="billing-field"><label><input type="checkbox" name="allowSelfApproval" ${settings.approvalPolicy?.allowSelfApproval !== false ? 'checked' : ''}> Tillad selv-godkendelse</label><p class="billing-form-help">Når deaktiveret, kan den der anmoder om godkendelse ikke selv godkende fakturaen.</p></div>
      <details class="billing-advanced"><summary>Peppol / Nemhandel</summary>
        <div class="billing-form-row"><div class="billing-field"><label for="company-endpoint-scheme">Endpoint scheme</label><input id="company-endpoint-scheme" name="endpointScheme" value="${esc(endpoint.schemeId || '')}" placeholder="0184"></div><div class="billing-field"><label for="company-endpoint-value">Elektronisk endpoint</label><input id="company-endpoint-value" name="endpointValue" value="${esc(endpoint.value || '')}"></div></div>
        <p class="billing-form-help">Kun nødvendigt for struktureret e-faktura. PDF og e-mail kræver ikke Peppol.</p>
      </details>
      <p id="billing-company-error" class="billing-form-error" role="alert" hidden></p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">Gem virksomhed</button></div>
    </form>`;
    openDialog();
    setTimeout(() => $('#company-name', els.review)?.focus(), 0);
  }

  function openActuals(item) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    state.activeItem = structuredClone(item);
    state.activeInvoice = null;
    els.reviewKicker.textContent = 'Manglende oplysninger';
    els.reviewTitle.textContent = 'Tilføj arbejdstid';
    els.reviewBody.innerHTML = `<section class="billing-review-customer"><h3>${esc(item.customerName)}</h3><p>${esc(formatDate(visit(item.visitId)?.scheduledStart, locale()))}</p></section><form id="billing-actuals-form" class="billing-form" aria-describedby="billing-actuals-error"><div class="billing-field"><label for="billing-work-hours">Samlede faktiske arbejdstimer</label><input id="billing-work-hours" name="workHours" type="number" min="0" step="0.25" inputmode="decimal" placeholder="fx 2" required aria-describedby="billing-actuals-error"></div><p class="billing-form-help">Skriv den samlede arbejdstid på tværs af medarbejdere. Kalenderens planlagte varighed bruges ikke som fakturagrundlag.</p><p id="billing-actuals-error" class="billing-form-error" role="alert" hidden></p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">Gem actuals</button></div></form>`;
    openDialog();
    setTimeout(() => $('#billing-work-hours', els.review)?.focus(), 0);
  }

  function openActualCorrection(item) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    const visitId = item?.visitIds?.length === 1 ? item.visitIds[0] : null;
    const current = visit(visitId);
    if (!current?.actual) return toast('Der findes ingen actuals at korrigere');
    state.activeItem = structuredClone(item);
    state.activeInvoice = null;
    els.reviewKicker.textContent = 'Korrigering';
    els.reviewTitle.textContent = 'Korrigér actuals';
    els.reviewBody.innerHTML = `<section class="billing-review-customer"><h3>${esc(item.customerName)}</h3><p>${esc(formatDate(current.scheduledStart, locale()))}</p></section><form id="billing-actual-correction-form" class="billing-form" aria-describedby="billing-correction-error"><div class="billing-field"><label for="billing-correction-hours">Samlede faktiske arbejdstimer</label><input id="billing-correction-hours" name="workHours" type="number" min="0" step="0.25" inputmode="decimal" value="${esc(String(current.actual.workMinutes / 60))}" required aria-describedby="billing-correction-error"></div><div class="billing-field"><label for="billing-correction-reason">Årsag til korrektion</label><textarea id="billing-correction-reason" name="reason" maxlength="1000" required aria-describedby="billing-correction-error"></textarea></div><p class="billing-form-help">Korrigeringer kræver en begrundelse og er ikke mulige, når besøget allerede er bundet til en faktura.</p><p id="billing-correction-error" class="billing-form-error" role="alert" hidden></p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">Gem korrektion</button></div></form>`;
    openDialog();
    setTimeout(() => $('#billing-correction-hours', els.review)?.focus(), 0);
  }

  async function createDraft(form) {
    if (!state.activeItem || state.busy || !canMutate()) return;
    const data = new FormData(form);
    const issueDate = String(data.get('issueDate') || '').trim();
    if (!issueDate) {
      showFormError(form, 'Vælg en fakturadato.');
      return;
    }
    showFormError(form);
    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.createDraft({ customerId: state.activeItem.customerId, visitIds: state.activeItem.visitIds, issueDate });
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast(`Fakturakladde ${body.invoice.number} oprettet`);
    } catch (error) {
      const message = error.code === 'invoice_number_conflict' ? 'Fakturanummeret er allerede i brug' : 'Kunne ikke oprette fakturakladde';
      showFormError(form, message);
      toast(message);
      form.querySelectorAll('button,input').forEach((node) => { node.disabled = false; });
    } finally {
      state.busy = false;
    }
  }

  async function logAudit(action, details = {}) {
    try {
      await client.logAudit({ action, ...details });
    } catch (err) {
      console.warn('billing audit log failed', action, err);
    }
  }

  async function issueInvoice(id, button) {
    if (!id || state.busy || !canMutate()) return;
    const confirmed = await showConfirmDialog('Udsted faktura? Denne handling kan ikke fortrydes.');
    if (!confirmed) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.issueInvoice(id);
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast(`Faktura ${body.invoice.number} er udstedt`);
      void logAudit('issue_invoice', { invoiceId: id, invoiceNumber: body.invoice.number });
    } catch {
      button.disabled = false;
      toast('Kunne ikke udstede faktura');
    } finally {
      state.busy = false;
    }
  }

  async function requestApproval(id, button) {
    if (!id || state.busy || !canMutate()) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.requestApproval(id);
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast('Godkendelse anmodet');
      void logAudit('request_approval', { invoiceId: id });
    } catch {
      button.disabled = false;
      toast('Kunne ikke anmode om godkendelse');
    } finally {
      state.busy = false;
    }
  }

  async function approveInvoice(id, button) {
    if (!id || state.busy || !canMutate()) return;
    const confirmed = await showConfirmDialog('Godkend og udsted faktura?');
    if (!confirmed) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.approveInvoice(id);
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast(`Faktura ${body.invoice.number} er godkendt og udstedt`);
      void logAudit('approve_invoice', { invoiceId: id });
    } catch (error) {
      button.disabled = false;
      const msg = error?.code === 'self_approval_forbidden' ? 'Selv-godkendelse er ikke tilladt' : error?.code === 'permission_denied' ? 'Du har ikke tilladelse til at godkende' : 'Kunne ikke godkende faktura';
      toast(msg);
    } finally {
      state.busy = false;
    }
  }

  async function rejectApproval(id, button) {
    if (!id || state.busy || !canMutate()) return;
    const reason = prompt('Angiv årsag til afvisning (valgfrit):');
    if (reason === null) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.rejectApproval(id, reason || '');
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast('Godkendelse afvist');
      void logAudit('reject_approval', { invoiceId: id, reason });
    } catch (error) {
      button.disabled = false;
      const msg = error?.code === 'permission_denied' ? 'Du har ikke tilladelse til at afvise' : 'Kunne ikke afvise godkendelse';
      toast(msg);
    } finally {
      state.busy = false;
    }
  }

  async function downloadInvoice(id, button) {
    if (!id || state.busy || !canMutate()) return;
    state.busy = true;
    button.disabled = true;
    try {
      const artifact = await client.downloadArtifact(id);
      const url = URL.createObjectURL(artifact.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = artifact.filename;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast('Fakturaen er klar til download');
    } catch {
      toast('Kunne ikke hente fakturaen');
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  }

  async function downloadPeppolInvoice(id, button) {
    if (!id || state.busy || !canMutate()) return;
    state.busy = true;
    button.disabled = true;
    try {
      const artifact = await client.downloadPeppol(id);
      const url = URL.createObjectURL(artifact.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = artifact.filename || `invoice-${id}.xml`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      toast('UBL-fakturaen er klar til download');
    } catch (error) {
      const profileError = error?.code === 'document_profile_validation_failed'
        || error?.code === 'document_external_validation_failed';
      toast(profileError
        ? 'Peppol-oplysninger mangler eller kunne ikke valideres'
        : 'Kunne ikke hente UBL-fakturaen');
    } finally {
      state.busy = false;
      button.disabled = false;
    }
  }

  async function deliverInvoice(id, button) {
    if (!id || state.busy || !canMutate()) return;
    const confirmed = await showConfirmDialog('Send faktura til kunden? Denne handling kan ikke fortrydes.');
    if (!confirmed) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.deliverInvoice(id);
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast(`Faktura ${body.invoice.number} er sendt`);
      void logAudit('deliver_invoice', { invoiceId: id, invoiceNumber: body.invoice.number });
    } catch (error) {
      toast(error.code === 'delivery_provider_unavailable' ? 'Ingen leveringsprovider er konfigureret' : 'Levering fejlede. Fakturaen er ikke markeret som sendt.');
      await refresh();
      const latest = invoice(id);
      if (latest) state.activeInvoice = structuredClone(latest);
      renderReview();
    } finally {
      state.busy = false;
    }
  }

  async function sendReminder(id, button) {
    if (!id || state.busy || !canMutate()) return;
    const confirmed = await showConfirmDialog('Generér rykker til kunden?');
    if (!confirmed) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.remindInvoice(id);
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = new Date().toISOString();
      render();
      renderReview();
      toast(`Rykker genereret for faktura ${body.invoice.number}`);
      void logAudit('generate_reminder', { invoiceId: id, reminderId: body.reminder.id, overdue: body.reminder.overdue });
    } catch (error) {
      toast(error.code === 'invoice_not_remindable' ? 'Fakturaen kan ikke modtage rykkere' : 'Kunne ikke generere rykker.');
      await refresh();
      const latest = invoice(id);
      if (latest) state.activeInvoice = structuredClone(latest);
      renderReview();
    } finally {
      state.busy = false;
    }
  }

  async function saveCompanySettings(form) {
    if (state.busy || !canMutate()) return;
    const data = new FormData(form);
    const endpointScheme = String(data.get('endpointScheme') || '').trim();
    const endpointValue = String(data.get('endpointValue') || '').trim();
    const issuer = {
      name: String(data.get('name') || '').trim(),
      address: String(data.get('address') || '').trim(),
      countryCode: String(data.get('countryCode') || '').trim().toUpperCase(),
      registrationId: String(data.get('registrationId') || '').trim(),
      registrationScheme: String(data.get('registrationScheme') || '').trim() || null,
      email: String(data.get('email') || '').trim() || null,
      phone: String(data.get('phone') || '').trim() || null,
      paymentText: String(data.get('paymentText') || '').trim() || null,
      endpoint: endpointScheme || endpointValue ? { schemeId: endpointScheme, value: endpointValue } : null,
    };
    const nextNumber = Number(data.get('nextNumber'));
    const defaultServiceLabel = String(data.get('defaultServiceLabel') || '').trim();
    const approvalPolicy = {
      required: data.get('approvalRequired') === 'on',
      allowSelfApproval: data.get('allowSelfApproval') === 'on',
    };
    showFormError(form);
    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.updateSettings({ issuer, defaultServiceLabel, invoiceSequence: { nextNumber }, approvalPolicy });
      state.billing = body.billing;
      state.cached = false;
      state.lastSyncedAt = new Date().toISOString();
      closeDialog();
      render();
      toast('Virksomhedsprofilen er gemt');
    } catch (error) {
      const message = error.code === 'invoice_sequence_conflict' ? 'Næste fakturanummer kolliderer med en eksisterende faktura' : 'Kunne ikke gemme virksomhedsprofilen';
      showFormError(form, message);
      form.querySelectorAll('button,input').forEach((node) => { node.disabled = false; });
      toast(message);
    } finally {
      state.busy = false;
    }
  }

  async function saveActuals(form) {
    if (!state.activeItem?.visitId || state.busy || !canMutate()) return;
    const hours = Number(String(new FormData(form).get('workHours') || '').replace(',', '.'));
    if (!Number.isFinite(hours) || hours < 0) {
      showFormError(form, 'Angiv et gyldigt antal arbejdstimer.');
      return;
    }
    showFormError(form);
    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.recordActuals({ visitId: state.activeItem.visitId, actual: { workMinutes: Math.round(hours * 60) } });
      state.billing = body.billing;
      state.cached = false;
      state.lastSyncedAt = new Date().toISOString();
      closeDialog();
      state.view = 'inbox';
      render();
      toast('Arbejdstiden er gemt');
    } catch {
      showFormError(form, 'Kunne ikke gemme arbejdstiden.');
      form.querySelectorAll('button,input').forEach((node) => { node.disabled = false; });
      toast('Kunne ikke gemme arbejdstiden');
    } finally {
      state.busy = false;
    }
  }

  async function saveActualCorrection(form) {
    const visitId = state.activeItem?.visitIds?.length === 1 ? state.activeItem.visitIds[0] : null;
    if (!visitId || state.busy || !canMutate()) return;
    const data = new FormData(form);
    const hours = Number(String(data.get('workHours') || '').replace(',', '.'));
    const reason = String(data.get('reason') || '').trim();
    if (!Number.isFinite(hours) || hours < 0 || !reason) {
      showFormError(form, 'Angiv timer og en begrundelse.');
      return;
    }
    showFormError(form);
    state.busy = true;
    form.querySelectorAll('button,input,textarea').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.correctActuals({
        visitId,
        actual: { workMinutes: Math.round(hours * 60) },
        reason,
      });
      state.billing = body.billing;
      state.cached = false;
      state.lastSyncedAt = new Date().toISOString();
      closeDialog();
      render();
      toast('Actuals er korrigeret');
    } catch (error) {
      const message = error.code === 'actuals_locked'
        ? 'Actuals er låst, fordi besøget allerede er faktureret'
        : 'Kunne ikke korrigere actuals';
      showFormError(form, message);
      form.querySelectorAll('button,input,textarea').forEach((node) => { node.disabled = false; });
      toast(message);
    } finally {
      state.busy = false;
    }
  }

  // R-010: Keyboard navigation for tablist (ArrowLeft/Right/Home/End + roving tabindex)
  const tablist = $('.billing-tabs[role="tablist"]');
  if (tablist) {
    tablist.addEventListener('keydown', (event) => {
      const tabs = $$('.billing-tab[role="tab"]', tablist);
      if (!tabs.length) return;
      const current = event.target.closest('[role="tab"]');
      if (!current || !tablist.contains(current)) return;
      const idx = tabs.indexOf(current);
      let next = -1;
      switch (event.key) {
        case 'ArrowRight': next = (idx + 1) % tabs.length; break;
        case 'ArrowLeft': next = (idx - 1 + tabs.length) % tabs.length; break;
        case 'Home': next = 0; break;
        case 'End': next = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      tabs.forEach((tab, i) => tab.setAttribute('tabindex', i === next ? '0' : '-1'));
      tabs[next].focus();
      tabs[next].click();
    });
  }

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-view]');
    if (tab) {
      state.view = tab.dataset.view;
      // R-010: Update roving tabindex on click
      const tabs = $$('.billing-tab[role="tab"]');
      tabs.forEach((t) => t.setAttribute('tabindex', t === tab ? '0' : '-1'));
      if (state.view === 'dashboard') {
        fetchDashboard().then(() => renderList());
      } else if (state.view === 'products') {
        fetchProducts().then(() => renderList());
      } else if (state.view === 'recurring') {
        fetchRecurring().then(() => renderList());
      } else if (state.view === 'search-invoices' || state.view === 'search-customers') {
        state.searchQuery.type = state.view === 'search-customers' ? 'customer' : 'invoice';
        state.searchResults = null;
        renderList();
      } else {
        renderList();
      }
      return;
    }
    // Search control event delegation
    if (event.target.closest('[data-search-action]')) {
      handleSearchEvent(event);
      return;
    }
    // Search field input/change delegation
    if (event.target.closest('[data-search-field]')) {
      handleSearchEvent(event);
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'close-review') return closeDialog();
    if (action.dataset.action === 'new-invoice') return openNewInvoice();
    if (action.dataset.action === 'manage-customers') return openCustomerManager();
    if (action.dataset.action === 'create-product') return openProductForm();
    if (action.dataset.action === 'edit-product') {
      const productId = action.dataset.productId;
      const product = state.products.find((p) => p.id === productId);
      if (product) return openProductForm(product);
      return;
    }
    if (action.dataset.action === 'create-recurring') return openRecurringForm();
    if (action.dataset.action === 'edit-recurring') {
      const recurringId = action.dataset.recurringId;
      const recurring = state.recurringInvoices.find((r) => r.id === recurringId);
      if (recurring) return openRecurringForm(recurring);
      return;
    }
    if (action.dataset.action === 'toggle-recurring') {
      const recurringId = action.dataset.recurringId;
      const currentActive = action.dataset.active === 'true';
      return toggleRecurring(recurringId, !currentActive);
    }
    if (action.dataset.action === 'create-customer') return openCreateCustomer();
    if (action.dataset.action === 'edit-customer') return openEditCustomer(action.dataset.customerId);
    if (action.dataset.action === 'company-settings') return openCompanySettings();
    if (action.dataset.action === 'review') {
      const item = findItem(action.dataset.key);
      if (item) openReview(item);
      return;
    }
    if (action.dataset.action === 'actuals') {
      const item = findItem(action.dataset.key);
      if (item) openActuals(item);
      return;
    }
    if (action.dataset.action === 'correct-actuals') {
      if (state.activeItem) openActualCorrection(state.activeItem);
      return;
    }
    if (action.dataset.action === 'issue') return issueInvoice(action.dataset.invoiceId, action);
    if (action.dataset.action === 'request-approval') return requestApproval(action.dataset.invoiceId, action);
    if (action.dataset.action === 'approve-invoice') return approveInvoice(action.dataset.invoiceId, action);
    if (action.dataset.action === 'reject-approval') return rejectApproval(action.dataset.invoiceId, action);
    if (action.dataset.action === 'download') return downloadInvoice(action.dataset.invoiceId, action);
    if (action.dataset.action === 'peppol') return downloadPeppolInvoice(action.dataset.invoiceId, action);
    if (action.dataset.action === 'deliver') return deliverInvoice(action.dataset.invoiceId, action);
    if (action.dataset.action === 'send-reminder') return sendReminder(action.dataset.invoiceId, action);
    if (action.dataset.action === 'edit-manual-draft') return openManualDraftEdit(action.dataset.invoiceId);
    if (action.dataset.action === 'add-manual-line') {
      const container = $('#billing-manual-lines-container', els.review);
      if (!container) return;
      const existing = $$('.billing-manual-line', container);
      const nextIndex = existing.length;
      container.insertAdjacentHTML('beforeend', manualLineHtml(nextIndex));
      renderManualTotals($('#billing-manual-form', els.review));
      $(`#manual-desc-${nextIndex}`, container)?.focus();
      return;
    }
    if (action.dataset.action === 'remove-manual-line') {
      const line = action.closest('.billing-manual-line');
      if (!line) return;
      const container = $('#billing-manual-lines-container', els.review);
      const remaining = $$('.billing-manual-line', container);
      if (remaining.length <= 1) return toast('Mindst én linje er påkrævet');
      line.remove();
      // Re-index remaining lines
      $$('.billing-manual-line', container).forEach((el, i) => {
        el.dataset.lineIndex = String(i);
        const descInput = $('input[name="description"]', el);
        const qtyInput = $('input[name="quantity"]', el);
        const priceInput = $('input[name="unitPrice"]', el);
        const discInput = $('input[name="discountPercent"]', el);
        const removeBtn = $('[data-action="remove-manual-line"]', el);
        if (descInput) { descInput.id = `manual-desc-${i}`; $('label[for]', el.closest('.billing-form-row'))?.setAttribute('for', `manual-desc-${i}`); }
        if (qtyInput) qtyInput.id = `manual-qty-${i}`;
        if (priceInput) priceInput.id = `manual-price-${i}`;
        if (discInput) discInput.id = `manual-disc-${i}`;
        if (removeBtn) { removeBtn.dataset.lineIndex = String(i); removeBtn.setAttribute('aria-label', `Fjern linje ${i + 1}`); }
      });
      renderManualTotals($('#billing-manual-form', els.review));
      return;
    }
    if (action.dataset.action === 'select-product') {
      const select = action.tagName === 'SELECT' ? action : action.closest('select');
      if (!select) return;
      const line = select.closest('.billing-manual-line');
      if (!line) return;
      const option = select.options[select.selectedIndex];
      if (!option || !option.value) return;
      const priceMinor = Number(option.dataset.price) || 0;
      const desc = option.dataset.desc || '';
      const descInput = $('input[name="description"]', line);
      const priceInput = $('input[name="unitPrice"]', line);
      if (descInput && !descInput.value.trim()) descInput.value = desc || option.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (priceInput) priceInput.value = String((priceMinor / 100).toFixed(2));
      renderManualTotals($('#billing-manual-form', els.review));
      return;
    }
  });

  // Product selector in manual invoice lines (change event, not click)
  document.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-action="select-product"]');
    if (!select) return;
    const line = select.closest('.billing-manual-line');
    if (!line) return;
    const option = select.options[select.selectedIndex];
    if (!option || !option.value) return;
    const priceMinor = Number(option.dataset.price) || 0;
    const desc = option.dataset.desc || '';
    const descInput = $('input[name="description"]', line);
    const priceInput = $('input[name="unitPrice"]', line);
    if (descInput && !descInput.value.trim()) descInput.value = desc || option.textContent.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (priceInput) priceInput.value = String((priceMinor / 100).toFixed(2));
    renderManualTotals($('#billing-manual-form', els.review));
  });

  async function submitPayment(form) {
    if (!state.activeInvoice || state.busy || !canMutate()) return;
    const data = new FormData(form);
    const invoiceId = String(data.get('invoiceId') || '').trim();
    const amountRaw = String(data.get('amount') || '').trim();
    const method = String(data.get('method') || '').trim();
    const reference = String(data.get('reference') || '').trim();
    const paidAt = String(data.get('paidAt') || '').trim();
    const errorEl = $('#billing-payment-error', form);
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    if (!invoiceId || !amountRaw || !method || !paidAt) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Udfyld alle påkrævede felter.'; }
      return;
    }
    const parsed = Number(amountRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Beløb skal være et positivt tal.'; }
      return;
    }
    const amountMinor = Math.round(parsed * 100);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Ugyldigt beløb.'; }
      return;
    }
    state.busy = true;
    render();
    try {
      await client.recordPayment(invoiceId, { amountMinor, method, reference: reference || undefined, paidAt });
      await refresh();
    } catch (err) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = err?.message || 'Kunne ikke registrere betaling.'; }
    } finally {
      state.busy = false;
      render();
    }
  }

  async function submitCreditNote(form) {
    if (!state.activeInvoice || state.busy || !canMutate()) return;
    const data = new FormData(form);
    const invoiceId = String(data.get('invoiceId') || '').trim();
    const reason = String(data.get('reason') || '').trim();
    const errorEl = $('#billing-credit-error', form);
    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
    if (!invoiceId || !reason) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Angiv en årsag til kreditnotaen.'; }
      return;
    }
    if (reason.length > 1000) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = 'Årsag må højest være 1000 tegn.'; }
      return;
    }
    state.busy = true;
    render();
    try {
      await client.voidInvoice(invoiceId, reason);
      await refresh();
    } catch (err) {
      if (errorEl) { errorEl.hidden = false; errorEl.textContent = err?.message || 'Kunne ikke oprette kreditnota.'; }
    } finally {
      state.busy = false;
      render();
    }
  }

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'billing-draft-form') {
      event.preventDefault();
      createDraft(event.target);
    } else if (event.target.id === 'billing-actuals-form') {
      event.preventDefault();
      saveActuals(event.target);
    } else if (event.target.id === 'billing-actual-correction-form') {
      event.preventDefault();
      saveActualCorrection(event.target);
    } else if (event.target.id === 'billing-company-form') {
      event.preventDefault();
      saveCompanySettings(event.target);
    } else if (event.target.id === 'billing-manual-form') {
      event.preventDefault();
      handleManualFormSubmit(event.target);
    } else if (event.target.id === 'billing-customer-form') {
      event.preventDefault();
      saveCustomer(event.target);
    } else if (event.target.id === 'billing-payment-form') {
      event.preventDefault();
      submitPayment(event.target);
    } else if (event.target.id === 'billing-credit-form') {
      event.preventDefault();
      submitCreditNote(event.target);
    } else if (event.target.id === 'billing-product-form') {
      event.preventDefault();
      submitProductForm(event.target);
    }
  });

  window.addEventListener('billing-connectivity', (event) => {
    const wasOnline = state.online;
    state.online = event.detail?.online !== false;
    render();
    if (state.online !== wasOnline) void refresh();
  });

  // R-016: Native online/offline event listeners for persistent offline indicator
  if (typeof navigator !== 'undefined') {
    const handleConnectivityChange = () => {
      const wasOnline = state.online;
      state.online = navigator.onLine !== false;
      renderConnection();
      if (state.online !== wasOnline) void refresh();
    };
    window.addEventListener('online', handleConnectivityChange);
    window.addEventListener('offline', handleConnectivityChange);
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_TOKEN_KEY) return;
    clearSensitiveState();
    state.actor = null;
    state.cacheIdentity = null;
    client.setSession({ actor: null, token: event.newValue || null });
    void refresh();
  });

  async function attemptLogin(token) {
    storeToken(token);
    try {
      const session = await resolveBillingSession(client, { online: true });
      if (session.authenticated && session.actor) {
        applyIdentity(session);
        location.reload();
        return;
      }
      clearStoredToken();
      renderLoginScreen(els, { error: 'Ugyldig eller udløbet token.', secureWarning: SECURE_CONTEXT_REQUIRED, onLogin: attemptLogin });
    } catch (err) {
      clearStoredToken();
      const msg = err?.status === 401 || err?.status === 403
        ? 'Token blev afvist.'
        : 'Kunne ikke verificere token. Prøv igen.';
      renderLoginScreen(els, { error: msg, secureWarning: SECURE_CONTEXT_REQUIRED, onLogin: attemptLogin });
    }
  }

  function handleLogout() {
    clearStoredToken();
    client.setSession({ actor: null, token: null });
    clearSensitiveState();
    state.actor = null;
    state.cacheIdentity = null;
    renderLoginScreen(els, { secureWarning: SECURE_CONTEXT_REQUIRED, onLogin: attemptLogin });
  }

  // Secure-context gate: block login on non-HTTPS non-localhost
  if (SECURE_CONTEXT_REQUIRED) {
    renderLoginScreen(els, { secureWarning: true, onLogin: attemptLogin });
    return Object.freeze({ refresh: () => {}, render: () => {} });
  }

  // Check existing session before showing UI
  const existingToken = readStoredToken();
  if (!existingToken) {
    state.loginRequired = true;
    renderLoginScreen(els, { secureWarning: false, onLogin: attemptLogin });
    return Object.freeze({ refresh: () => {}, render: () => {} });
  }

  els.refresh.addEventListener('click', refresh);
  els.review.addEventListener('click', (event) => { if (event.target === els.review) closeDialog(); });
  els.review.addEventListener('cancel', (event) => { event.preventDefault(); closeDialog(); });

  // Add logout handler to header if button exists or inject one
  const headerActions = $('.billing-header-actions');
  if (headerActions && !$('[data-action="logout"]')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'billing-quiet-button';
    logoutBtn.type = 'button';
    logoutBtn.dataset.action = 'logout';
    logoutBtn.textContent = 'Log ud';
    logoutBtn.addEventListener('click', handleLogout);
    headerActions.prepend(logoutBtn);
  }
  document.addEventListener('click', (event) => {
    if (event.target?.dataset?.action === 'logout') handleLogout();
  });

  // Search field input/change/keydown delegation
  document.addEventListener('input', (event) => {
    if (event.target?.dataset?.searchField) handleSearchEvent(event);
  });
  document.addEventListener('change', (event) => {
    if (event.target?.dataset?.searchField) handleSearchEvent(event);
  });
  document.addEventListener('keydown', (event) => {
    if (event.target?.dataset?.searchField === 'search' && event.key === 'Enter') {
      handleSearchEvent(event);
    }
  });

  // ── Theme Toggle (persisted in settings API + localStorage fallback) ──
  const THEME_STORAGE_KEY = 'aftergraph.billing.theme';
  const themeToggle = $('#billing-theme-toggle');

  function applyTheme(theme) {
    const normalized = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', normalized);
    try { localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch {}
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', normalized === 'dark' ? 'Skift til lyst tema' : 'Skift til mørkt tema');
    }
  }

  async function loadPersistedTheme() {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') { applyTheme(stored); return; }
    } catch {}
    // Fallback: check system preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      applyTheme('dark');
    } else {
      applyTheme('light');
    }
  }

  async function persistThemeToSettings(theme) {
    try {
      await client.updateSettings({ theme });
    } catch {
      // Settings API may not support theme yet; localStorage is the primary store
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      void persistThemeToSettings(next);
      toast(next === 'dark' ? 'Mørkt tema aktiveret' : 'Lyst tema aktiveret');
    });
  }

  void loadPersistedTheme();

  // ── Command Palette (⌘K / Ctrl+K) with fuzzy search ──
  const cmdOverlay = $('#billing-cmd-overlay');
  const cmdInput = $('#billing-cmd-input');
  const cmdListbox = $('#billing-cmd-listbox');
  let cmdOpen = false;
  let cmdSelectedIndex = -1;
  let cmdItems = [];
  let cmdReturnFocus = null;

  function buildCommandItems() {
    const items = [];
    // Actions
    items.push({ id: 'new-invoice', label: 'Ny faktura', category: 'Handling', action: () => openNewInvoice() });
    items.push({ id: 'new-customer', label: 'Ny kunde', category: 'Handling', action: () => toast('Opret kunde via kildesystemet') });
    items.push({ id: 'send-reminder', label: 'Send rykker', category: 'Handling', action: () => toast('Rykker-funktion ikke tilgængelig endnu') });
    items.push({ id: 'company-settings', label: 'Virksomhedsindstillinger', category: 'Handling', action: () => openCompanySettings() });
    items.push({ id: 'refresh', label: 'Opdater fakturaliste', category: 'Handling', action: () => void refresh() });
    items.push({ id: 'toggle-theme', label: 'Skift tema (lys/mørk)', category: 'Handling', action: () => themeToggle?.click() });
    // Views
    Object.entries(VIEWS).forEach(([key, [label]]) => {
      items.push({ id: `view-${key}`, label: `Visning: ${label}`, category: 'Visning', action: () => { state.view = key; renderList(); } });
    });
    // Customers from loaded data
    const customers = state.billing?.customers || [];
    customers.forEach((c) => {
      items.push({ id: `customer-${c.id}`, label: c.name || c.id, category: 'Kunde', action: () => { state.view = 'inbox'; renderList(); toast(`Valgte kunde: ${c.name || c.id}`); } });
    });
    // Invoices from loaded data
    const invoices = state.billing?.invoices || [];
    invoices.forEach((inv) => {
      const label = inv.number ? `Faktura ${inv.number}` : `Faktura ${inv.id}`;
      items.push({ id: `invoice-${inv.id}`, label, category: 'Faktura', action: () => toast(`${label} — åbner detaljer`) });
    });
    return items;
  }

  function fuzzyMatch(query, text) {
    if (!query) return true;
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    if (t.includes(q)) return true;
    // Simple subsequence match
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  function renderCmdResults(query) {
    if (!cmdListbox) return;
    const all = buildCommandItems();
    const filtered = query ? all.filter((item) => fuzzyMatch(query, item.label) || fuzzyMatch(query, item.category)) : all;
    cmdItems = filtered.slice(0, 20);
    cmdSelectedIndex = cmdItems.length > 0 ? 0 : -1;
    if (!cmdItems.length) {
      cmdListbox.innerHTML = '<li class="billing-cmd-empty" role="option">Ingen resultater</li>';
      return;
    }
    cmdListbox.innerHTML = cmdItems.map((item, i) => `
      <li class="billing-cmd-item${i === cmdSelectedIndex ? ' is-selected' : ''}" role="option" aria-selected="${i === cmdSelectedIndex}" data-cmd-index="${i}">
        <span class="billing-cmd-item-label">${esc(item.label)}</span>
        <span class="billing-cmd-item-category">${esc(item.category)}</span>
      </li>`).join('');
  }

  function updateCmdSelection() {
    if (!cmdListbox) return;
    const items = $$('.billing-cmd-item', cmdListbox);
    items.forEach((el, i) => {
      const selected = i === cmdSelectedIndex;
      el.classList.toggle('is-selected', selected);
      el.setAttribute('aria-selected', String(selected));
      if (selected) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function openCmdPalette() {
    if (!cmdOverlay || !cmdInput) return;
    cmdOpen = true;
    cmdReturnFocus = document.activeElement;
    cmdOverlay.hidden = false;
    // Force reflow before adding class for transition
    void cmdOverlay.offsetHeight;
    cmdOverlay.classList.add('is-open');
    cmdOverlay.querySelector('.billing-cmd-panel')?.setAttribute('aria-expanded', 'true');
    cmdInput.value = '';
    renderCmdResults('');
    setTimeout(() => cmdInput.focus(), 0);
  }

  function closeCmdPalette() {
    if (!cmdOverlay) return;
    cmdOpen = false;
    cmdOverlay.classList.remove('is-open');
    cmdOverlay.querySelector('.billing-cmd-panel')?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { cmdOverlay.hidden = true; }, 150);
    const returnFocus = cmdReturnFocus;
    cmdReturnFocus = null;
    if (returnFocus?.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
  }

  function executeCmdItem(index) {
    const item = cmdItems[index];
    if (!item) return;
    closeCmdPalette();
    try { item.action(); } catch (err) { console.error('cmd action failed', err); }
  }

  if (cmdInput) {
    cmdInput.addEventListener('input', () => renderCmdResults(cmdInput.value.trim()));
  }

  if (cmdOverlay) {
    cmdOverlay.addEventListener('click', (event) => {
      if (event.target === cmdOverlay) closeCmdPalette();
      const itemEl = event.target.closest('[data-cmd-index]');
      if (itemEl) executeCmdItem(Number(itemEl.dataset.cmdIndex));
    });
  }

  // Global keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    // ⌘K / Ctrl+K → toggle command palette
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      if (cmdOpen) closeCmdPalette(); else openCmdPalette();
      return;
    }

    // Esc → close command palette or review dialog
    if (event.key === 'Escape') {
      if (cmdOpen) { closeCmdPalette(); return; }
      // Review dialog handles its own cancel event
      return;
    }

    // Command palette navigation
    if (cmdOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (cmdItems.length) {
          cmdSelectedIndex = (cmdSelectedIndex + 1) % cmdItems.length;
          updateCmdSelection();
        }
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (cmdItems.length) {
          cmdSelectedIndex = (cmdSelectedIndex - 1 + cmdItems.length) % cmdItems.length;
          updateCmdSelection();
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (cmdSelectedIndex >= 0) executeCmdItem(cmdSelectedIndex);
        return;
      }
      return;
    }

    // Skip shortcuts when typing in form fields
    const tag = event.target.tagName;
    const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target.isContentEditable;
    if (isEditable) return;

    // N → new invoice
    if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      openNewInvoice();
      return;
    }
    // C → new customer
    if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      toast('Opret kunde via kildesystemet');
      return;
    }
    // / → focus search (command palette)
    if (event.key === '/') {
      event.preventDefault();
      openCmdPalette();
      return;
    }
  });

  refresh();
  return Object.freeze({ refresh, render });
}

if (typeof document !== 'undefined') createApp();

export { createApp, formatMoney, formatWorkMinutes, resolveBillingSession };
