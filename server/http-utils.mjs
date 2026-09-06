export const API_VERSION='aftergraph.workspace.v5';
export function apiHeaders(extra={}){return {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra}}
export function sendJson(res,status,body,headers={}){res.writeHead(status,apiHeaders(headers));res.end(JSON.stringify(body))}
export async function readJson(req,{maxBytes=64*1024}={}){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>maxBytes){const error=new Error('payload_too_large');error.code='payload_too_large';throw error}}if(!body)return{};try{return JSON.parse(body)}catch{const error=new Error('invalid_json');error.code='invalid_json';throw error}}
