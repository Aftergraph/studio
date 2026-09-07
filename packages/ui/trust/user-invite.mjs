import { esc, attr } from '../shared.mjs';

// Operator invite form: create a scoped user from the auth overlay.
// Rendered only for user.manage holders (bootstrap decides); the server
// re-validates capabilities and rejects wildcards.
export function AGUserInvite({ capabilities = [], created = null, error = '' }) {
  const notice = error ? `<p class="ag-auth-error" role="alert">${esc(error)}</p>` : '';
  const done = created ? `<p class="ag-auth-done" role="status">Created ${esc(created.id)} with ${(created.capabilities || []).length} capabilities.</p>` : '';
  const boxes = capabilities.map(cap => `<label><input type="checkbox" name="capability" value="${attr(cap)}"> ${esc(cap)}</label>`).join('');
  return `<section class="ag-user-invite" data-ag-component="user-invite" aria-live="polite"><div class="ag-auth-head"><small>Invite user</small><h2>Scoped access</h2></div><p>New users start with no access beyond what you tick. No wildcards exist.</p>${notice}${done}<div><label for="invite-user-id">User ID</label><input id="invite-user-id" name="user-id" autocomplete="off"></div><fieldset><legend>Capabilities</legend>${boxes}</fieldset><footer><button type="button" class="ag-button primary" data-auth-action="invite">Create user</button></footer></section>`;
}
