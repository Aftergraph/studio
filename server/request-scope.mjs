import { subjectFromAuthHeader } from '../src/auth/magic-link.mjs';
import { getUser } from '../src/user/user-store.mjs';

/**
 * Unified request scope resolution for both billing-server and app-server.
 *
 * Extracts bearer token, validates claimed actor, resolves workspace store.
 * Replaces billing-server.mjs:resolveScope and app-server.mjs:rescope.
 *
 * @param {object} options
 * @param {import('node:http').IncomingMessage} options.req - HTTP request
 * @param {URL} options.url - Parsed request URL
 * @param {string} options.secret - Auth secret for bearer verification
 * @param {boolean} options.requireAuth - Whether authentication is required
 * @param {Function} options.storeFor - Factory: (actor) => WorkspaceStateStore
 * @param {string} [options.claimedActor] - Actor claimed via body or query param
 * @param {boolean} [options.isAuthRoute] - True if this is an auth booth route (exempt from requireAuth)
 * @returns {Promise<{actor: string, store: object}>}
 */
export async function createRequestScope({
  req,
  url,
  secret,
  requireAuth,
  storeFor,
  claimedActor = undefined,
  isAuthRoute = false,
}) {
  // Bearer extraction
  let bearer = null;
  try {
    bearer = subjectFromAuthHeader(req, { secret });
  } catch (error) {
    // Preserve original status from subjectFromAuthHeader (403 for forged/malformed tokens)
    throw scopeError(error.code || 'authentication_required', error.status || 401, error.message);
  }

  // requireAuth gate (auth booth routes are exempt)
  if (requireAuth && !bearer && !isAuthRoute) {
    throw scopeError('authentication_required', 401);
  }

  // Resolve claimed actor from parameter or query string
  const queryActor = url.searchParams.get('actor') || undefined;
  const claimed = claimedActor || queryActor;

  // Bearer binds the request — claimed actor must match token subject
  if (bearer && claimed && bearer !== claimed) {
    throw scopeError('forbidden', 403, 'token subject mismatch');
  }

  // Determine effective actor: bearer > claimed > demo-user (only when !requireAuth)
  const actor = bearer || claimed || (requireAuth ? null : 'demo-user');
  if (!actor) {
    throw scopeError('authentication_required', 401);
  }

  // Validate claimed actor exists in user registry
  // Unknown actors (not in user store) get 422 — distinct from forbidden (known but unauthorized)
  const user = getUser(actor);
  if (!user) {
    // If actor was explicitly claimed (not derived from bearer or fallback), reject as unknown
    if (claimed && !bearer) {
      throw scopeError('unknown_actor', 422, `unknown actor: ${claimed}`);
    }
    // Bearer-derived or fallback actors that don't exist are forbidden
    throw scopeError('forbidden', 403, 'unknown actor');
  }

  // Resolve workspace store
  const store = storeFor(actor);
  if (!store) {
    throw scopeError('workspace_not_initialized', 409);
  }
  await store.readyP;

  return { actor, store };
}

function scopeError(code, status, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
