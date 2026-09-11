import { createBillingClient } from './browser-client.mjs';
import { projectInvoice } from './money.mjs';
import { canFinanciallyMutate, itemsForBillingView } from './app-state.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const READ_CACHE_KEY = 'aftergraph.billing.read-cache.v1';

const VIEWS = Object.freeze({
  inbox: ['Indbakke', 'Mangler oplysninger først, derefter det der er klar til fakturering.'],
  ready: ['Klar til fakturering', 'Alt nødvendigt er registreret. Gennemgå beløb og opret fakturakladden.'],
  waiting: ['Venter', 'Arbejdet er registreret, men faktureringsperioden er ikke afsluttet endnu.'],
  needs_info: ['Mangler oplysninger', 'Ret den manglende oplysning her, så posten kan gå videre.'],
  invoiced: ['Faktureret', 'Arbejdet er allerede bundet til en faktura og kan ikke faktureres igen.'],
});

const REASONS = Object.freeze({
  billing_window_closed: 'Klar til gennemgang',
  future_visit_same_window: 'Samles med næste besøg',
  missing_actuals: 'Faktiske arbejdstimer mangler',
  missing_customer_email: 'Kundens e-mail mangler',
  missing_rate: 'Timepris mangler',
  missing_currency: 'Valuta mangler',
  unknown_billing_mode: 'Faktureringsmetode skal vælges',
  already_invoiced: 'Allerede faktureret',
});

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(value, locale = 'da-DK') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10) || 'Ukendt dato';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatSyncTime(value, locale = 'da-DK') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ukendt tidspunkt';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatMoney(minor, currency = 'DKK', locale = 'da-DK') {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format((Number.isInteger(minor) ? minor : 0) / 100);
}

function formatWorkMinutes(minutes, locale = 'da-DK') {
  if (!Number.isInteger(minutes)) return 'Arbejdstid mangler';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(minutes / 60)} arbejdstimer`;
}

function itemKey(item) {
  return `${item.status}:${item.customerId}:${(item.visitIds || []).join(',')}`;
}

function getActor() {
  return new URLSearchParams(location.search).get('actor')?.trim() || 'demo-user';
}

function sanitizeBillingForCache(billing) {
  if (!billing || typeof billing !== 'object') return null;
  return {
    settings: {
      taxRateBps: Number.isInteger(billing.settings?.taxRateBps) ? billing.settings.taxRateBps : 0,
      locale: billing.settings?.locale || 'da-DK',
    },
    customers: (billing.customers || []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      status: entry.status,
      billing: entry.billing ? {
        mode: entry.billing.mode,
        paymentTermsDays: entry.billing.paymentTermsDays,
        rateMinor: entry.billing.rateMinor,
        currency: entry.billing.currency,
        discountPercent: entry.billing.discountPercent,
      } : null,
    })),
    visits: (billing.visits || []).map((entry) => ({
      id: entry.id,
      customerId: entry.customerId,
      scheduledStart: entry.scheduledStart,
      status: entry.status,
      actual: entry.actual ? {
        workMinutes: entry.actual.workMinutes,
        discountPercent: entry.actual.discountPercent,
      } : null,
    })),
    invoices: (billing.invoices || []).map((entry) => ({
      id: entry.id,
      number: entry.number,
      customerId: entry.customerId,
      visitIds: entry.visitIds,
      issueDate: entry.issueDate,
      dueDate: entry.dueDate,
      status: entry.status,
      currency: entry.currency,
      totalGrossMinor: entry.totalGrossMinor,
    })),
    projection: billing.projection ? structuredClone(billing.projection) : { items: [], summary: {} },
  };
}

function writeReadCache(billing, syncedAt = new Date().toISOString()) {
  try {
    const safe = sanitizeBillingForCache(billing);
    if (!safe) return null;
    localStorage.setItem(READ_CACHE_KEY, JSON.stringify({ syncedAt, billing: safe }));
    return syncedAt;
  } catch {
    return null;
  }
}

function readReadCache() {
  try {
    const raw = localStorage.getItem(READ_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.syncedAt || !parsed?.billing?.projection) return null;
    return parsed;
  } catch {
    return null;
  }
}

function createApp() {
  const client = createBillingClient({ actor: getActor() });
  const state = {
    billing: null,
    view: 'inbox',
    busy: false,
    cached: false,
    cachedAt: null,
    lastSyncedAt: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
    activeItem: null,
    activeInvoice: null,
    toastTimer: null,
  };

  const els = {
    summary: $('#billing-summary'), list: $('#billing-list'), title: $('#billing-list-title'),
    context: $('#billing-list-context'), connection: $('#billing-connection'), refresh: $('#billing-refresh'),
    review: $('#billing-review'), reviewTitle: $('#billing-review-title'), reviewKicker: $('#billing-review-kicker'),
    reviewBody: $('#billing-review-body'), toast: $('#billing-toast'),
  };

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
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    state.toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2400);
  }

  function connection(text, kind = '') {
    els.connection.textContent = text;
    els.connection.className = `billing-connection${kind ? ` is-${kind}` : ''}`;
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

  function renderSummary() {
    const summary = projection().summary || {};
    const readyItems = projection().items.filter((item) => item.status === 'ready');
    const readyTotal = readyItems.reduce((sum, item) => sum + (preview(item)?.totalGrossMinor || 0), 0);
    const currency = readyItems.length ? customer(readyItems[0].customerId)?.billing?.currency || 'DKK' : 'DKK';
    els.summary.innerHTML = `
      <article class="billing-summary-item is-primary"><span class="billing-summary-label">Klar nu</span><strong class="billing-summary-value">${esc(formatMoney(readyTotal, currency, locale()))}</strong><span class="billing-summary-detail">${summary.ready || 0} klar</span></article>
      <article class="billing-summary-item"><span class="billing-summary-label">Venter</span><strong class="billing-summary-value">${summary.waiting || 0}</strong><span class="billing-summary-detail">senere i perioden</span></article>
      <article class="billing-summary-item"><span class="billing-summary-label">Mangler</span><strong class="billing-summary-value">${summary.needsInfo || 0}</strong><span class="billing-summary-detail">kræver handling</span></article>
      <article class="billing-summary-item"><span class="billing-summary-label">Faktureret</span><strong class="billing-summary-value">${summary.invoiced || 0}</strong><span class="billing-summary-detail">dubletbeskyttet</span></article>`;
  }

  function renderList() {
    const [label, contextText] = VIEWS[state.view];
    els.title.textContent = label;
    els.context.textContent = contextText;
    $$('.billing-tab').forEach((tab) => {
      const selected = tab.dataset.view === state.view;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
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
  }

  function render() {
    if (!state.billing) return;
    renderSummary();
    renderList();
    renderConnection();
  }

  function adoptCache() {
    const cached = readReadCache();
    if (!cached) return false;
    state.billing = cached.billing;
    state.cached = true;
    state.cachedAt = cached.syncedAt;
    state.lastSyncedAt = cached.syncedAt;
    render();
    return true;
  }

  async function refresh() {
    if (state.busy) return;
    state.busy = true;
    els.refresh.disabled = true;
    state.online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    if (!state.online) {
      if (!adoptCache() && !state.billing) {
        els.summary.innerHTML = '';
        els.list.innerHTML = '<div class="billing-error"><strong>Fakturering er offline.</strong><br>Der findes ingen tidligere synkroniseret visning på denne enhed.</div>';
      } else if (!state.cached && state.billing) {
        state.cached = true;
        state.cachedAt = state.lastSyncedAt;
      }
      renderConnection();
      state.busy = false;
      els.refresh.disabled = false;
      return;
    }
    connection('Synkroniserer…');
    try {
      const body = await client.load();
      const syncedAt = new Date().toISOString();
      state.billing = body.billing;
      state.cached = false;
      state.cachedAt = null;
      state.lastSyncedAt = syncedAt;
      writeReadCache(body.billing, syncedAt);
      render();
    } catch (error) {
      const usedCache = adoptCache();
      if (!usedCache && !state.billing) {
        els.summary.innerHTML = '';
        els.list.innerHTML = '<div class="billing-error"><strong>Fakturering er utilgængelig.</strong><br>Der findes ingen verificeret lokal kopi.</div>';
        connection('Kan ikke hente data', 'degraded');
      }
      console.error('billing load failed', error);
      toast(usedCache ? 'Viser senest synkroniserede data' : 'Kunne ikke opdatere fakturering');
    } finally {
      state.busy = false;
      els.refresh.disabled = false;
    }
  }

  function findItem(key) {
    return projection().items.find((item) => itemKey(item) === key) || null;
  }

  function openDialog() {
    if (typeof els.review.showModal === 'function') els.review.showModal();
    else els.review.setAttribute('open', '');
  }

  function closeDialog() {
    if (typeof els.review.close === 'function') els.review.close();
    else els.review.removeAttribute('open');
    state.activeItem = null;
    state.activeInvoice = null;
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

  function controlsHtml() {
    const disabled = canMutate() ? '' : ' disabled aria-disabled="true" title="Kræver online og aktuelle data"';
    if (state.activeInvoice) {
      const final = ['issued', 'emailed'].includes(state.activeInvoice.status);
      return `<div class="billing-draft-status"><strong>${final ? 'Faktura udstedt' : 'Kladde oprettet'}</strong><p>Nr. ${esc(state.activeInvoice.number)} · forfalder ${esc(formatDate(state.activeInvoice.dueDate, locale()))}</p></div><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Luk</button>${final ? '' : `<button type="button" class="billing-primary-button" data-action="issue" data-invoice-id="${esc(state.activeInvoice.id)}"${disabled}>Udsted faktura</button>`}</div>`;
    }
    return `<form id="billing-draft-form" class="billing-form"><div class="billing-form-row"><div class="billing-field"><label for="billing-number">Fakturanummer</label><input id="billing-number" name="number" inputmode="numeric" autocomplete="off" placeholder="fx 1370" required${disabled}></div><div class="billing-field"><label for="billing-issue-date">Fakturadato</label><input id="billing-issue-date" name="issueDate" type="date" value="${today()}" required${disabled}></div></div><p class="billing-form-help">Nummeret reserveres først, når kladden oprettes. Finansielle handlinger kræver online og aktuelle data.</p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button"${disabled}>Opret kladde</button></div></form>`;
  }

  function renderReview() {
    const item = state.activeItem;
    const projected = item ? preview(item) : null;
    const account = item ? customer(item.customerId) : null;
    if (!item || !projected || !account) {
      els.reviewBody.innerHTML = '<div class="billing-error"><strong>Kan ikke danne fakturakladde.</strong><br>Nødvendige actuals eller prisoplysninger mangler.</div>';
      return;
    }
    els.reviewKicker.textContent = state.activeInvoice ? 'Faktura' : 'Fakturakladde';
    els.reviewTitle.textContent = state.activeInvoice?.status === 'issued' ? 'Faktura udstedt' : 'Gennemgå faktura';
    els.reviewBody.innerHTML = `<section class="billing-review-customer"><h3>${esc(account.name)}</h3><p>${item.visitIds.length} besøg</p></section><section class="billing-review-lines" aria-label="Fakturalinjer">${lineHtml(item, projected)}</section><section class="billing-totals" aria-label="Fakturatotaler">${projected.discountMinor ? `<div class="billing-total-row"><span>Rabat</span><span>−${esc(formatMoney(projected.discountMinor, projected.currency, locale()))}</span></div>` : ''}<div class="billing-total-row"><span>Ekskl. moms</span><span>${esc(formatMoney(projected.totalNetMinor, projected.currency, locale()))}</span></div><div class="billing-total-row"><span>Moms</span><span>${esc(formatMoney(projected.taxMinor, projected.currency, locale()))}</span></div><div class="billing-total-row is-total"><span>I alt</span><span>${esc(formatMoney(projected.totalGrossMinor, projected.currency, locale()))}</span></div></section>${controlsHtml()}`;
  }

  function openReview(item) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    state.activeItem = structuredClone(item);
    state.activeInvoice = null;
    renderReview();
    openDialog();
    setTimeout(() => $('#billing-number', els.review)?.focus(), 0);
  }

  function openActuals(item) {
    if (state.busy || !canMutate()) return toast('Kræver online og aktuelle data');
    state.activeItem = structuredClone(item);
    state.activeInvoice = null;
    els.reviewKicker.textContent = 'Manglende oplysninger';
    els.reviewTitle.textContent = 'Tilføj arbejdstid';
    els.reviewBody.innerHTML = `<section class="billing-review-customer"><h3>${esc(item.customerName)}</h3><p>${esc(formatDate(visit(item.visitId)?.scheduledStart, locale()))}</p></section><form id="billing-actuals-form" class="billing-form"><div class="billing-field"><label for="billing-work-hours">Samlede faktiske arbejdstimer</label><input id="billing-work-hours" name="workHours" type="number" min="0" step="0.25" inputmode="decimal" placeholder="fx 2" required></div><p class="billing-form-help">Skriv den samlede arbejdstid på tværs af medarbejdere. Kalenderens planlagte varighed bruges ikke som fakturagrundlag.</p><div class="billing-form-actions"><button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button><button type="submit" class="billing-primary-button">Gem actuals</button></div></form>`;
    openDialog();
    setTimeout(() => $('#billing-work-hours', els.review)?.focus(), 0);
  }

  async function createDraft(form) {
    if (!state.activeItem || state.busy || !canMutate()) return;
    const data = new FormData(form);
    const number = String(data.get('number') || '').trim();
    const issueDate = String(data.get('issueDate') || '').trim();
    if (!number || !issueDate) return;
    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.createDraft({ customerId: state.activeItem.customerId, visitIds: state.activeItem.visitIds, number, issueDate });
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = writeReadCache(body.billing) || state.lastSyncedAt;
      render();
      renderReview();
      toast(`Fakturakladde ${body.invoice.number} oprettet`);
    } catch (error) {
      toast(error.code === 'invoice_number_conflict' ? 'Fakturanummeret er allerede i brug' : 'Kunne ikke oprette fakturakladde');
      form.querySelectorAll('button,input').forEach((node) => { node.disabled = false; });
    } finally {
      state.busy = false;
    }
  }

  async function issueInvoice(id, button) {
    if (!id || state.busy || !canMutate()) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.issueInvoice(id);
      state.billing = body.billing;
      state.cached = false;
      state.activeInvoice = body.invoice;
      state.lastSyncedAt = writeReadCache(body.billing) || state.lastSyncedAt;
      render();
      renderReview();
      toast(`Faktura ${body.invoice.number} er udstedt`);
    } catch {
      button.disabled = false;
      toast('Kunne ikke udstede faktura');
    } finally {
      state.busy = false;
    }
  }

  async function saveActuals(form) {
    if (!state.activeItem?.visitId || state.busy || !canMutate()) return;
    const hours = Number(String(new FormData(form).get('workHours') || '').replace(',', '.'));
    if (!Number.isFinite(hours) || hours < 0) return;
    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.recordActuals({ visitId: state.activeItem.visitId, actual: { workMinutes: Math.round(hours * 60) } });
      state.billing = body.billing;
      state.cached = false;
      state.lastSyncedAt = writeReadCache(body.billing) || state.lastSyncedAt;
      closeDialog();
      state.view = 'inbox';
      render();
      toast('Arbejdstiden er gemt');
    } catch {
      form.querySelectorAll('button,input').forEach((node) => { node.disabled = false; });
      toast('Kunne ikke gemme arbejdstiden');
    } finally {
      state.busy = false;
    }
  }

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-view]');
    if (tab) {
      state.view = tab.dataset.view;
      renderList();
      return;
    }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'close-review') return closeDialog();
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
    if (action.dataset.action === 'issue') issueInvoice(action.dataset.invoiceId, action);
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'billing-draft-form') {
      event.preventDefault();
      createDraft(event.target);
    } else if (event.target.id === 'billing-actuals-form') {
      event.preventDefault();
      saveActuals(event.target);
    }
  });

  window.addEventListener('billing-connectivity', (event) => {
    const wasOnline = state.online;
    state.online = event.detail?.online !== false;
    if (state.online && !wasOnline) {
      state.cached = true;
      void refresh();
      return;
    }
    if (!state.online) {
      const cached = readReadCache();
      if (cached) {
        state.billing = cached.billing;
        state.cached = true;
        state.cachedAt = cached.syncedAt;
        state.lastSyncedAt = cached.syncedAt;
      } else if (state.billing) {
        state.cached = true;
        state.cachedAt = state.lastSyncedAt;
      }
    }
    render();
  });

  els.refresh.addEventListener('click', refresh);
  els.review.addEventListener('click', (event) => { if (event.target === els.review) closeDialog(); });
  refresh();
  return Object.freeze({ refresh, render });
}

if (typeof document !== 'undefined') createApp();

export { createApp, formatMoney, formatWorkMinutes, sanitizeBillingForCache };
