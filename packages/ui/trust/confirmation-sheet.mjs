import { esc, attr } from '../shared.mjs';

export function AGConfirmationSheet({ id = 'confirmation', title = 'Confirm action', state = 'idle', description = 'This action requires confirmation.', error = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
  const loading = state === 'loading';
  const message = state === 'error' ? error : description;
  return `<dialog id="${attr(id)}" class="ag-confirmation-sheet" data-ag-component="confirmation-sheet" data-confirmation-state="${attr(state)}" aria-labelledby="${attr(id)}-title" aria-describedby="${attr(id)}-description"><h2 id="${attr(id)}-title">${esc(title)}</h2><p id="${attr(id)}-description" role="${state === 'error' ? 'alert' : 'status'}">${esc(message)}</p><footer><button type="button" data-confirmation-action="cancel">${esc(cancelLabel)}</button><button type="button" data-confirmation-action="confirm"${loading ? ' disabled aria-busy="true"' : ''}>${esc(loading ? 'Processing…' : confirmLabel)}</button></footer><small>Press Escape to cancel.</small></dialog>`;
}
