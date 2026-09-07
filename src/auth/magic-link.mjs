import { createHmac, timingSafeEqual } from 'node:crypto';

// Magic-link auth (HMAC-SHA256, roro-pattern).
// Ceiling: issuance is capability-gated, not email-challenged; email delivery
// plus REQUIRE_AUTH enforcement lands with the login UI slice.
const VERSION = 'v1';

function b64urlEncode(buffer) {
  return Buffer.from(buffer).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function b64urlDecode(text) {
  const padded = text.replaceAll('-', '+').replaceAll('_', '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

export function authSecretFromEnv(env = process.env) {
  return env.AFTERGRAPH_AUTH_SECRET || 'aftergraph-dev-secret-change-in-production';
}

export function isDevSecret(secret) {
  return secret === 'aftergraph-dev-secret-change-in-production';
}

export function issueMagicToken({ userId, secret, ttlMs = 15 * 60 * 1000, now = Date.now() } = {}) {
  if (!userId || typeof userId !== 'string') throw new TypeError('userId required');
  if (!secret) throw new TypeError('secret required');
  const exp = now + ttlMs;
  const payload = b64urlEncode(`${userId}.${exp}`);
  const sig = b64urlEncode(createHmac('sha256', secret).update(`${VERSION}.${payload}`).digest());
  return `${VERSION}.${payload}.${sig}`;
}

export function verifyMagicToken(token, { secret, now = Date.now() } = {}) {
  const fail = code => { const error = new Error(`invalid token: ${code}`); error.code = 'invalid_token'; throw error; };
  if (!token || typeof token !== 'string') return fail('missing');
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) return fail('malformed');
  const [, payload, sig] = parts;
  const expected = b64urlEncode(createHmac('sha256', secret).update(`${VERSION}.${payload}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail('bad_signature');
  const decoded = b64urlDecode(payload).toString('utf8');
  const dot = decoded.lastIndexOf('.');
  if (dot < 1) return fail('malformed');
  const userId = decoded.slice(0, dot);
  const exp = Number(decoded.slice(dot + 1));
  if (!Number.isFinite(exp) || now > exp) return fail('expired');
  return { userId, exp };
}

export function subjectFromAuthHeader(req, { secret } = {}) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (!header) return null;
  const match = String(header).match(/^Bearer (.+)$/);
  if (!match) { const error = new Error('malformed authorization'); error.code = 'invalid_token'; error.status = 403; throw error; }
  try {
    return verifyMagicToken(match[1].trim(), { secret }).userId;
  } catch (error) {
    error.status = 403; throw error;
  }
}
