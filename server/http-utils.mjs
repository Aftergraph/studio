export const API_VERSION='aftergraph.workspace.v5';
export function apiHeaders(extra={}){return {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra}}
const JSON_ESCAPE_MAP = Object.freeze({
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
});
export function serializeJson(body){
  return JSON.stringify(body)
    .replace(/[<>&]/g, (character) => JSON_ESCAPE_MAP[character])
    .replaceAll(String.fromCharCode(0x2028), '\\u2028')
    .replaceAll(String.fromCharCode(0x2029), '\\u2029');
}
export function sendJson(res,status,body,headers={}){res.writeHead(status,apiHeaders(headers));res.end(serializeJson(body))}
export async function readJson(req,{maxBytes=64*1024}={}){let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>maxBytes){const error=new Error('payload_too_large');error.code='payload_too_large';throw error}}if(!body)return{};try{return JSON.parse(body)}catch{const error=new Error('invalid_json');error.code='invalid_json';throw error}}
