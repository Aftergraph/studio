import { createJsonHttpClient } from './http-json.mjs';

function tenantPath(tenant,path){return tenant?`/${encodeURIComponent(tenant)}${path}`:path}

export function createAieAdapter({baseUrl,tenant=null,timeout,fetchImpl,headers={}}={}){
  const http=createJsonHttpClient({baseUrl,timeout,fetchImpl,defaultHeaders:headers});
  return Object.freeze({
    kind:'aie',
    tasks:()=>http.get(tenantPath(tenant,'/tasks')),
    task:id=>http.get(tenantPath(tenant,`/tasks/${encodeURIComponent(id)}`)),
    cancelTask:(id,body={})=>http.post(tenantPath(tenant,`/tasks/${encodeURIComponent(id)}:cancel`),body),
    sendMessage:body=>{
      const messageId=body?.message?.messageId;
      if(!messageId||typeof messageId!=='string') throw new Error('message.messageId is required');
      return http.post(tenantPath(tenant,'/message:send'),body);
    },
  });
}
