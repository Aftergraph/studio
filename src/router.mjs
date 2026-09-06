import { resolveDomain, domainForObject } from './domain.mjs';

export function buildDeepLink(domain, type, id) {
  const d = resolveDomain(domain).toUpperCase();
  return `/d/${encodeURIComponent(d)}/o/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
}

export function parseDeepLink(pathname) {
  const raw = String(pathname || '').split('?')[0].split('#')[0];
  const m = raw.match(/^\/d\/([^/]+)\/o\/([^/]+)\/([^/]+)$/i);
  if (!m) return null;
  const domain = resolveDomain(decodeURIComponent(m[1]));
  const type = decodeURIComponent(m[2]).toLowerCase();
  const id = decodeURIComponent(m[3]);
  const owner = domainForObject(type);
  if (owner !== 'now' && owner !== domain) return { domain, type, id, namespaceMismatch:true, expectedDomain:owner };
  return { domain, type, id };
}

export function routeFromLocation(locationLike) {
  const pathname = locationLike?.pathname || '/';
  const deep = parseDeepLink(pathname);
  if (deep) return { kind:'object', ...deep };
  const first = pathname.split('/').filter(Boolean)[0];
  if (String(first||'').toLowerCase()==='space') return { kind:'mode', mode:'space', domain:'work' };
  return { kind:'domain', domain:resolveDomain(first || 'now') };
}
