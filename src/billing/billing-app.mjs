import { createBillingClient } from './browser-client.mjs';
import { projectInvoice } from './money.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const queueCopy = Object.freeze({
  ready: {
    label: 'Klar til fakturering',
    context: 'Alt nødvendigt er registreret. Gennemgå beløb og opret fakturakladden.',
    empty: 'Der er ikke noget, der er klar til fakturering lige nu.',
  },
  waiting: {
    label: 'Venter',
    context: 'Arbejdet er registreret, men faktureringsperioden er ikke afsluttet endnu.',
    empty: 'Ingen kunder venter på et senere besøg i den aktuelle faktureringsperiode.',
  },
  needs_info: {
    label: 'Mangler oplysninger',
    context: 'Noget nødvendigt mangler. Ret det her, så posten kan gå videre automatisk.',
    empty: 'Der mangler ingen oplysninger til faktureringen.',
  },
  invoiced: {
    label: 'Faktureret',
    context: 'Arbejdet er allerede bundet til en faktura og kan ikke faktureres igen.',
    empty: 'Ingen fakturaer er registreret i denne visning endnu.',
  },
});

const reasonCopy = Object.freeze({
  billing_window_closed: 'Klar til gennemgang',
  future_visit_same_window: 'Samles med næste besøg',
  missing_actuals: 'Faktiske arbejdstimer mangler',
  missing_customer_email: 'Kundens e-mail mangler',
  missing_rate: 'Timepris mangler',
  missing_currency: 'Valuta mangler',
  unknown_billing_mode: 'Faktureringsmetode skal vælges',
  already_invoiced: 'Allerede faktureret',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function localDateOnly(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value, locale = 'da-DK') {
  if (!value) return 'Ukendt dato';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function formatMoney(minor, currency = 'DKK', locale = 'da-DK') {
  const value = Number.isInteger(minor) ? minor / 100 : 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWorkMinutes(minutes, locale = 'da-DK') {
  if (!Number.isInteger(minutes)) return 'Arbejdstid mangler';
  const hours = minutes / 60;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(hours)} arbejdstimer`;
}

function plural(value, singular, pluralForm) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function itemKey(item) {
  return `${item.status}:${item.customerId}:${(item.visitIds || []).join(',')}`;
}

function getActor() {
  const actor = new URLSearchParams(location.search).get('actor');
  return actor?.trim() || 'demo-user';
}

function createApp() {
  const client = createBillingClient({ actor: getActor() });
  const state = {
    billing: null,
    queue: 'ready',
    busy: false,
    activeItemKey: null,
    activeInvoice: null,
    toastTimer: null,
  };

  const els = {
    summary: $('#billing-summary'),
    list: $('#billing-list'),
    listTitle: $('#billing-list-title'),
    listContext: $('#billing-list-context'),
    connection: $('#billing-connection'),
    refresh: $('#billing-refresh'),
    review: $('#billing-review'),
    reviewTitle: $('#billing-review-title'),
    reviewKicker: $('#billing-review-kicker'),
    reviewBody: $('#billing-review-body'),
    toast: $('#billing-toast'),
  };

  const locale = () => state.billing?.settings?.locale || 'da-DK';
  const projection = () => state.billing?.projection || { items: [], summary: {} };
  const customerById = (id) => state.billing?.customers?.find((customer) => customer.id === id) || null;
  const visitById = (id) => state.billing?.visits?.find((visit) => visit.id === id) || null;
  const invoiceById = (id) => state.billing?.invoices?.find((invoice) => invoice.id === id) || null;

  const visitsFor = (item) => (item.visitIds || []).map(visitById).filter(Boolean);

  const previewFor = (item) => {
    const customer = customerById(item.customerId);
    const visits = visitsFor(item);
    if (!customer || visits.length === 0 || visits.some((visit) => !visit.actual || !Number.isInteger(visit.actual.workMinutes))) return null;
    try {
      return projectInvoice({
        customer,
        visits,
        taxRateBps: state.billing?.settings?.taxRateBps ?? 0,
      });
    } catch {
      return null;
    }
  };

  const showToast = (message) => {
    clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    state.toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2600);
  };

  const setConnection = (text, kind = '') => {
    els.connection.textContent = text;
    els.connection.className = `billing-connection${kind ? ` is-${kind}` : ''}`;
  };

  const currentItems = () => projection().items.filter((item) => item.status === state.queue);

  const readyAmount = () => projection().items
    .filter((item) => item.status === 'ready')
    .map(previewFor)
    .filter(Boolean)
    .reduce((sum, invoice) => sum + invoice.totalGrossMinor, 0);

  const readyCurrency = () => {
    const ready = projection().items.find((item) => item.status === 'ready');
    return ready ? customerById(ready.customerId)?.billing?.currency || 'DKK' : 'DKK';
  };

  const renderSummary = () => {
    const summary = projection().summary || {};
    els.summary.innerHTML = `
      <article class="billing-summary-item is-primary">
        <span class="billing-summary-label">Klar nu</span>
        <strong class="billing-summary-value">${escapeHtml(formatMoney(readyAmount(), readyCurrency(), locale()))}</strong>
        <span class="billing-summary-detail">${escapeHtml(plural(summary.ready || 0, 'faktura', 'fakturaer'))}</span>
      </article>
      <article class="billing-summary-item">
        <span class="billing-summary-label">Venter</span>
        <strong class="billing-summary-value">${summary.waiting || 0}</strong>
        <span class="billing-summary-detail">senere i perioden</span>
      </article>
      <article class="billing-summary-item">
        <span class="billing-summary-label">Mangler</span>
        <strong class="billing-summary-value">${summary.needsInfo || 0}</strong>
        <span class="billing-summary-detail">kræver handling</span>
      </article>
      <article class="billing-summary-item">
        <span class="billing-summary-label">Faktureret</span>
        <strong class="billing-summary-value">${summary.invoiced || 0}</strong>
        <span class="billing-summary-detail">beskyttet mod dublet</span>
      </article>`;
  };

  const reasonDetail = (item) => {
    if (item.reasonCode === 'future_visit_same_window' && item.nextVisitAt) {
      return `Næste besøg er ${formatDate(item.nextVisitAt, locale())}.`;
    }
    if (item.reasonCode === 'missing_actuals') return 'Registrér den samlede faktiske arbejdstid for besøget.';
    if (item.reasonCode === 'already_invoiced') {
      return item.invoiceNumber ? `Faktura nr. ${item.invoiceNumber}.` : 'Besøget er allerede bundet til en faktura.';
    }
    if (item.reasonCode === 'billing_window_closed') return 'Actuals, pris og kundeoplysninger er på plads.';
    return 'Ret den manglende oplysning i den kanoniske kundedata.';
  };

  const rowAction = (item) => {
    if (item.status === 'ready') {
      return `<button type="button" class="billing-primary-button" data-action="review" data-item-key="${escapeHtml(itemKey(item))}">Gennemgå faktura</button>`;
    }
    if (item.status === 'needs_info' && item.reasonCode === 'missing_actuals' && item.visitId) {
      return `<button type="button" class="billing-secondary-button" data-action="actuals" data-item-key="${escapeHtml(itemKey(item))}">Tilføj arbejdstid</button>`;
    }
    return '';
  };

  const rowAmount = (item) => {
    const preview = previewFor(item);
    if (preview) return formatMoney(preview.totalGrossMinor, preview.currency, locale());
    if (item.status === 'invoiced') {
      const invoice = invoiceById(item.invoiceId);
      if (invoice?.totalGrossMinor !== undefined) return formatMoney(invoice.totalGrossMinor, invoice.currency || 'DKK', locale());
    }
    return '—';
  };

  const rowSubtitle = (item) => {
    const visits = visitsFor(item);
    const completed = visits.filter((visit) => visit.status === 'completed');
    const minutes = completed.reduce((sum, visit) => sum + (Number.isInteger(visit.actual?.workMinutes) ? visit.actual.workMinutes : 0), 0);
    if (completed.length === 0) return 'Ingen afsluttede besøg';
    const date = formatDate(completed.at(-1)?.scheduledStart, locale());
    const work = minutes > 0 ? formatWorkMinutes(minutes, locale()) : 'Arbejdstid mangler';
    return `${date} · ${work}`;
  };

  const renderList = () => {
    const copy = queueCopy[state.queue];
    els.listTitle.textContent = copy.label;
    els.listContext.textContent = copy.context;

    $$('.billing-tab').forEach((button) => {
      const selected = button.dataset.queue === state.queue;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });

    const summary = projection().summary || {};
    const counts = {
      ready: summary.ready || 0,
      waiting: summary.waiting || 0,
      needs_info: summary.needsInfo || 0,
      invoiced: summary.invoiced || 0,
    };
    Object.entries(counts).forEach(([queue, count]) => {
      const node = $(`[data-count="${queue}"]`);
      if (node) node.textContent = String(count);
    });

    const items = currentItems();
    if (items.length === 0) {
      els.list.innerHTML = `<div class="billing-empty">${escapeHtml(copy.empty)}</div>`;
      return;
    }

    els.list.innerHTML = items.map((item) => `
      <article class="billing-row" data-status="${escapeHtml(item.status)}">
        <div class="billing-row-main">
          <h3 class="billing-row-name"><span class="billing-status-dot" aria-hidden="true"></span>${escapeHtml(item.customerName)}</h3>
          <div class="billing-row-subtitle">${escapeHtml(rowSubtitle(item))}</div>
        </div>
        <div class="billing-row-meta">
          <strong>${escapeHtml(rowAmount(item))}</strong>
          <small>${escapeHtml(plural(item.visitIds?.length || 0, 'besøg', 'besøg'))}</small>
        </div>
        <div class="billing-row-reason">
          <strong>${escapeHtml(reasonCopy[item.reasonCode] || 'Kræver gennemgang')}</strong>
          ${escapeHtml(reasonDetail(item))}
        </div>
        <div class="billing-row-action">${rowAction(item)}</div>
      </article>`).join('');
  };

  const render = () => {
    if (!state.billing) return;
    renderSummary();
    renderList();
  };

  const refresh = async ({ quiet = false } = {}) => {
    if (state.busy) return;
    state.busy = true;
    els.refresh.disabled = true;
    if (!quiet) setConnection('Synkroniserer…');
    try {
      const body = await client.load();
      state.billing = body.billing;
      setConnection('Aktuel', 'current');
      render();
    } catch (error) {
      setConnection('Kan ikke hente data', 'degraded');
      if (!state.billing) {
        els.summary.innerHTML = '';
        els.list.innerHTML = `<div class="billing-error"><strong>Fakturering er utilgængelig.</strong><br>Der vises ikke demo- eller cachedata som erstatning for backendens aktuelle sandhed.</div>`;
      }
      if (!quiet) showToast('Kunne ikke opdatere fakturering');
      console.error('billing load failed', error);
    } finally {
      state.busy = false;
      els.refresh.disabled = false;
    }
  };

  const findItem = (key) => projection().items.find((item) => itemKey(item) === key) || null;

  const openDialog = () => {
    if (typeof els.review.showModal === 'function') els.review.showModal();
    else els.review.setAttribute('open', '');
  };

  const closeDialog = () => {
    if (typeof els.review.close === 'function') els.review.close();
    else els.review.removeAttribute('open');
    state.activeItemKey = null;
    state.activeInvoice = null;
  };

  const reviewLines = (item, preview) => {
    const visits = visitsFor(item);
    return preview.lines.map((line) => {
      const visit = visits.find((candidate) => candidate.id === line.visitId);
      const discount = line.discountMinor > 0
        ? `<small>${line.discountPercent}% rabat · −${escapeHtml(formatMoney(line.discountMinor, preview.currency, locale()))}</small>`
        : '';
      return `<div class="billing-review-line">
        <div>
          <strong>${escapeHtml(formatDate(visit?.scheduledStart, locale()))}</strong>
          <small>${escapeHtml(formatWorkMinutes(line.workMinutes, locale()))} · ${escapeHtml(formatMoney(line.rateMinor, preview.currency, locale()))}/time</small>
          ${discount}
        </div>
        <div class="billing-review-line-amount">${escapeHtml(formatMoney(line.totalGrossMinor, preview.currency, locale()))}</div>
      </div>`;
    }).join('');
  };

  const renderDraftControls = (item, preview) => {
    const invoice = state.activeInvoice;
    if (invoice) {
      const issued = invoice.status === 'issued' || invoice.status === 'emailed';
      return `
        <div class="billing-draft-status">
          <strong>${issued ? 'Faktura udstedt' : 'Kladde oprettet'}</strong>
          <p>Nr. ${escapeHtml(invoice.number)} · forfalder ${escapeHtml(formatDate(invoice.dueDate, locale()))}</p>
        </div>
        <div class="billing-form-actions">
          <button type="button" class="billing-secondary-button" data-action="close-review">Luk</button>
          ${issued ? '' : `<button type="button" class="billing-primary-button" data-action="issue" data-invoice-id="${escapeHtml(invoice.id)}">Udsted faktura</button>`}
        </div>`;
    }

    return `
      <form id="billing-draft-form" class="billing-form">
        <div class="billing-form-row">
          <div class="billing-field">
            <label for="billing-number">Fakturanummer</label>
            <input id="billing-number" name="number" inputmode="numeric" autocomplete="off" placeholder="fx 1370" required>
          </div>
          <div class="billing-field">
            <label for="billing-issue-date">Fakturadato</label>
            <input id="billing-issue-date" name="issueDate" type="date" value="${localDateOnly()}" required>
          </div>
        </div>
        <p class="billing-form-help">Nummeret reserveres først, når kladden oprettes. V1 sender ikke fakturaen automatisk.</p>
        <div class="billing-form-actions">
          <button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button>
          <button type="submit" class="billing-primary-button">Opret kladde</button>
        </div>
      </form>`;
  };

  const renderReview = (item) => {
    const preview = previewFor(item);
    const customer = customerById(item.customerId);
    if (!preview || !customer) {
      els.reviewBody.innerHTML = '<div class="billing-error"><strong>Kan ikke danne fakturakladde.</strong><br>De nødvendige actuals eller prisoplysninger mangler.</div>';
      return;
    }

    els.reviewKicker.textContent = state.activeInvoice ? 'Faktura' : 'Fakturakladde';
    els.reviewTitle.textContent = state.activeInvoice?.status === 'issued' ? 'Faktura udstedt' : 'Gennemgå faktura';
    els.reviewBody.innerHTML = `
      <section class="billing-review-customer">
        <h3>${escapeHtml(customer.name)}</h3>
        <p>${escapeHtml(customer.email)} · ${escapeHtml(plural(item.visitIds.length, 'besøg', 'besøg'))}</p>
      </section>
      <section class="billing-review-lines" aria-label="Fakturalinjer">
        ${reviewLines(item, preview)}
      </section>
      <section class="billing-totals" aria-label="Fakturatotaler">
        ${preview.discountMinor > 0 ? `<div class="billing-total-row"><span>Rabat</span><span>−${escapeHtml(formatMoney(preview.discountMinor, preview.currency, locale()))}</span></div>` : ''}
        <div class="billing-total-row"><span>Ekskl. moms</span><span>${escapeHtml(formatMoney(preview.totalNetMinor, preview.currency, locale()))}</span></div>
        <div class="billing-total-row"><span>Moms</span><span>${escapeHtml(formatMoney(preview.taxMinor, preview.currency, locale()))}</span></div>
        <div class="billing-total-row is-total"><span>I alt</span><span>${escapeHtml(formatMoney(preview.totalGrossMinor, preview.currency, locale()))}</span></div>
      </section>
      ${renderDraftControls(item, preview)}`;
  };

  const openReview = (item) => {
    state.activeItemKey = itemKey(item);
    state.activeInvoice = null;
    renderReview(item);
    openDialog();
    setTimeout(() => $('#billing-number', els.review)?.focus(), 0);
  };

  const openActuals = (item) => {
    const visit = visitById(item.visitId);
    state.activeItemKey = itemKey(item);
    state.activeInvoice = null;
    els.reviewKicker.textContent = 'Manglende oplysninger';
    els.reviewTitle.textContent = 'Tilføj arbejdstid';
    els.reviewBody.innerHTML = `
      <section class="billing-review-customer">
        <h3>${escapeHtml(item.customerName)}</h3>
        <p>${escapeHtml(formatDate(visit?.scheduledStart, locale()))}</p>
      </section>
      <form id="billing-actuals-form" class="billing-form">
        <div class="billing-field">
          <label for="billing-work-hours">Samlede faktiske arbejdstimer</label>
          <input id="billing-work-hours" name="workHours" type="number" min="0" step="0.25" inputmode="decimal" placeholder="fx 2" required>
        </div>
        <p class="billing-form-help">Skriv den samlede arbejdstid på tværs af medarbejdere. Kalenderens planlagte varighed bruges ikke som fakturagrundlag.</p>
        <div class="billing-form-actions">
          <button type="button" class="billing-secondary-button" data-action="close-review">Annuller</button>
          <button type="submit" class="billing-primary-button">Gem actuals</button>
        </div>
      </form>`;
    openDialog();
    setTimeout(() => $('#billing-work-hours', els.review)?.focus(), 0);
  };

  const createDraft = async (form) => {
    const item = findItem(state.activeItemKey);
    if (!item || state.busy) return;
    const data = new FormData(form);
    const number = String(data.get('number') || '').trim();
    const issueDate = String(data.get('issueDate') || '').trim();
    if (!number || !issueDate) return;

    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      const body = await client.createDraft({
        customerId: item.customerId,
        visitIds: item.visitIds,
        number,
        issueDate,
      });
      state.billing = body.billing;
      state.activeInvoice = body.invoice;
      renderReview(item);
      render();
      showToast(`Fakturakladde ${body.invoice.number} oprettet`);
    } catch (error) {
      showToast(error.code === 'invoice_number_conflict' ? 'Fakturanummeret er allerede i brug' : 'Kunne ikke oprette fakturakladde');
    } finally {
      state.busy = false;
    }
  };

  const issueInvoice = async (invoiceId, button) => {
    if (!invoiceId || state.busy) return;
    state.busy = true;
    button.disabled = true;
    try {
      const body = await client.issueInvoice(invoiceId);
      state.billing = body.billing;
      state.activeInvoice = body.invoice;
      const item = findItem(state.activeItemKey) || {
        customerId: body.invoice.customerId,
        customerName: customerById(body.invoice.customerId)?.name || body.invoice.customerId,
        visitIds: body.invoice.visitIds,
      };
      renderReview(item);
      await refresh({ quiet: true });
      showToast(`Faktura ${body.invoice.number} er udstedt`);
    } catch {
      showToast('Kunne ikke udstede faktura');
    } finally {
      state.busy = false;
    }
  };

  const saveActuals = async (form) => {
    const item = findItem(state.activeItemKey);
    if (!item?.visitId || state.busy) return;
    const data = new FormData(form);
    const hours = Number(String(data.get('workHours') || '').replace(',', '.'));
    if (!Number.isFinite(hours) || hours < 0) return;
    const workMinutes = Math.round(hours * 60);

    state.busy = true;
    form.querySelectorAll('button,input').forEach((node) => { node.disabled = true; });
    try {
      await client.recordActuals({ visitId: item.visitId, actual: { workMinutes } });
      closeDialog();
      await refresh({ quiet: true });
      state.queue = projection().items.some((candidate) => candidate.customerId === item.customerId && candidate.status === 'ready')
        ? 'ready'
        : 'needs_info';
      render();
      showToast('Arbejdstiden er gemt');
    } catch {
      showToast('Kunne ikke gemme arbejdstiden');
    } finally {
      state.busy = false;
    }
  };

  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-queue]');
    if (tab) {
      state.queue = tab.dataset.queue;
      renderList();
      return;
    }

    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'close-review') {
      closeDialog();
      return;
    }
    if (action.dataset.action === 'review') {
      const item = findItem(action.dataset.itemKey);
      if (item) openReview(item);
      return;
    }
    if (action.dataset.action === 'actuals') {
      const item = findItem(action.dataset.itemKey);
      if (item) openActuals(item);
      return;
    }
    if (action.dataset.action === 'issue') {
      issueInvoice(action.dataset.invoiceId, action);
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'billing-draft-form') {
      event.preventDefault();
      createDraft(event.target);
    }
    if (event.target.id === 'billing-actuals-form') {
      event.preventDefault();
      saveActuals(event.target);
    }
  });

  els.refresh.addEventListener('click', () => refresh());
  els.review.addEventListener('click', (event) => {
    if (event.target === els.review) closeDialog();
  });

  refresh();
  return Object.freeze({ refresh, render });
}

if (typeof document !== 'undefined') createApp();

export { createApp, formatMoney, formatWorkMinutes };
