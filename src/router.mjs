import { resolveDomain, domainForObject } from './domain.mjs';

const SURFACE_ROUTES=Object.freeze({
  projects:{domain:'work'},
  plugins:{domain:'connect'},
  remote:{domain:'connect'},
  settings:{domain:'system'},
  billing:{domain:'work'},
});

export function appBasePath(locationLike={}) {
  const pathname=typeof locationLike==='string'
    ? String(locationLike||'/')
    : String(locationLike?.pathname||'/');
  return pathname==='/studio'||pathname.startsWith('/studio/')?'/studio':'';
}

export function withAppBase(pathname,locationLike={}) {
  const base=appBasePath(locationLike);
  const path=String(pathname||'/').startsWith('/')?String(pathname||'/'):`/${pathname}`;
  if(!base)return path;
  if(path===base||path.startsWith(`${base}/`))return path;
  return path==='/'?`${base}/`:`${base}${path}`;
}

function stripAppBase(pathname='') {
  const raw=String(pathname||'/').split('?')[0].split('#')[0]||'/';
  if(raw==='/studio')return '/';
  if(raw.startsWith('/studio/'))return raw.slice('/studio'.length)||'/';
  return raw;
}

export function buildDeepLink(domain,type,id) {
  const d=resolveDomain(domain).toUpperCase();
  return `/d/${encodeURIComponent(d)}/o/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
}

export function parseDeepLink(pathname) {
  const raw=stripAppBase(pathname);
  const m=raw.match(/^\/d\/([^/]+)\/o\/([^/]+)\/([^/]+)$/i);
  if(!m)return null;
  const domain=resolveDomain(decodeURIComponent(m[1]));
  const type=decodeURIComponent(m[2]).toLowerCase();
  const id=decodeURIComponent(m[3]);
  const owner=domainForObject(type);
  if(owner!=='now'&&owner!==domain)return {domain,type,id,namespaceMismatch:true,expectedDomain:owner};
  return {domain,type,id};
}

export function routeFromLocation(locationLike={}) {
  const pathname=stripAppBase(locationLike?.pathname||'/');
  const deep=parseDeepLink(pathname);
  if(deep)return {kind:'object',...deep};
  const first=pathname.split('/').filter(Boolean)[0];
  const key=String(first||'').toLowerCase();
  if(!key||key==='chat')return {kind:'mode',mode:'chat',domain:'chat'};
  if(key==='work')return {kind:'mode',mode:'work',domain:'work'};
  if(key==='space')return {kind:'mode',mode:'space',domain:'work'};
  if(SURFACE_ROUTES[key])return {kind:'surface',surface:key,domain:SURFACE_ROUTES[key].domain};
  return {kind:'domain',domain:resolveDomain(key||'now')};
}
