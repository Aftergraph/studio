import { AGIcon, esc, attr } from '../shared.mjs';

// Login UI slice-1: request a magic-link token, then sign in with it.
// Slice ceiling: panel emits data-auth-action events only; bootstrap actor
// switch and token persistence land in the follow-up slice.
export function AGAuthPanel({ state = 'request', userId = '', token = '', error = '' }) {
  const notice = error ? `<p class="ag-auth-error" role="alert">${esc(error)}</p>` : '';
  if (state === 'token') {
    return `<section class="ag-auth-panel" data-ag-component="auth-panel" aria-live="polite"><div class="ag-auth-head"><small>Token issued</small><h2>Sign in as ${esc(userId)}</h2></div><p>Signing in proves workspace ownership. Tokens expire after 15 minutes.</p><footer><button type="button" class="ag-button primary" data-auth-action="signin" data-user-id="${attr(userId)}" data-token="${attr(token)}">${AGIcon('shield', { size: 15 })} Sign in</button><button type="button" class="ag-button quiet" data-auth-action="back">Back</button></footer></section>`;
  }
  return `<section class="ag-auth-panel" data-ag-component="auth-panel" aria-live="polite"><div class="ag-auth-head"><small>Sign in</small><h2>Workspace login</h2></div><p>Signing in proves workspace ownership. Tokens expire after 15 minutes.</p>${notice}<div><label for="auth-user-id">User ID</label><input id="auth-user-id" name="user-id" value="${attr(userId)}" autocomplete="username"></div><footer><button type="button" class="ag-button primary" data-auth-action="request">Request token</button></footer></section>`;
}
