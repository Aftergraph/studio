import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export async function serveStatic({rootDir,url,res}){
  let requestPath=decodeURIComponent(url.pathname);if(requestPath==='/')requestPath='/index.html';
  if(requestPath.endsWith('/'))requestPath=`${requestPath}index.html`;
  const deep=/^\/d\/[^/]+\/o\/[^/]+\/[^/]+$/i.test(requestPath)||/^\/(now|chat|work|space|agents|brain|output|control|connect|system)$/i.test(requestPath);if(deep)requestPath='/index.html';
  const normalized=path.normalize(requestPath).replace(/^([.][.][/\\])+/,'');
  const filePath=path.resolve(rootDir,`.${normalized.startsWith('/')?normalized:`/${normalized}`}`);
  if(!filePath.startsWith(rootDir)){res.writeHead(403,{'content-type':'text/plain; charset=utf-8'});res.end('Forbidden');return true}
  try{const info=await stat(filePath);if(!info.isFile())throw new Error('not-file');const body=await readFile(filePath);res.writeHead(200,{'content-type':MIME[path.extname(filePath)]||'application/octet-stream','cache-control':filePath.endsWith('sw.js')?'no-cache':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(body)}catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('Not found')}return true;
}
