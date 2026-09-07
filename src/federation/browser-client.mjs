import * as R from '../api-routes.mjs';

export function createFederationBrowserClient({baseUrl='',fetchImpl=globalThis.fetch}={}){
  const get=async path=>{
    const r=await fetchImpl(`${baseUrl}${path}`,{headers:{accept:'application/json'},credentials:'same-origin'});
    const body=await r.json();
    if(!r.ok){const e=new Error(body?.error||`http_${r.status}`);e.status=r.status;throw e}
    return body;
  };
  return Object.freeze({
    integrations:()=>get(R.federationIntegrations()),
    objects:()=>get(R.federationObjects()),
    object:id=>get(R.federationObject(id)),
    search:(q,{tenantId=null}={})=>get(R.federationSearch(q,{tenantId})),
    now:()=>get(R.federationNow()),
    capabilities:(q='')=>get(R.federationCapabilities(q)),
  });
}
