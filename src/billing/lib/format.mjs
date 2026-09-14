export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDate(value, locale = 'da-DK') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '').slice(0, 10) || 'Ukendt dato';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function formatSyncTime(value, locale = 'da-DK') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'ukendt tidspunkt';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatMoney(minor, currency = 'DKK', locale = 'da-DK') {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format((Number.isInteger(minor) ? minor : 0) / 100);
}

export function formatWorkMinutes(minutes, locale = 'da-DK') {
  if (!Number.isInteger(minutes)) return 'Arbejdstid mangler';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(minutes / 60)} arbejdstimer`;
}
