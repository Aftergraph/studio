import { apiFederationCapabilities, apiFederationIntegrations, apiFederationNow, apiFederationObject, apiFederationObjects, apiFederationSearch } from '../api-routes.mjs';

export function createFederationBrowserClient({baseUrl='',fetchImpl=globalThis.fetch}={}){
  const get=async path=>{
    const r=await fetchImpl(`${baseUrl}${path}`,{headers:{accept:'application/json'},credentials:'same-origin'});
    const body=await r.json();
    if(!r.ok){const e=new Error(body?.error||`http_${r.status}`);e.status=r.status;throw e}
    return body;
  };
  return Object.freeze({
    integrations:()=>get(apiFederationIntegrations()),
    objects:()=>get(apiFederationObjects()),
    object:id=>get(apiFederationObject(id)),
    search:(q,{tenantId=null}={})=>get(apiFederationSearch(q,{tenantId})),
    now:()=>get(apiFederationNow()),
    capabilities:(q='')=>get(apiFederationCapabilities(q)),
  });
}
