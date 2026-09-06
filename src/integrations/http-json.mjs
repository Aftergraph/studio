function normalizeBaseUrl(baseUrl) {
  if (!baseUrl || typeof baseUrl !== 'string') throw new Error('baseUrl required');
  const url = new URL(baseUrl);
  if (!['http:','https:'].includes(url.protocol)) throw new Error('baseUrl must use http or https');
  url.pathname=url.pathname.replace(/\/+$/,'');
  return url.toString().replace(/\/$/,'');
}

function safeErrorMessage(status, body) {
  const code = body?.error || body?.detail || `http_${status}`;
  return typeof code === 'string' ? code.slice(0,240) : `http_${status}`;
}

export function createJsonHttpClient({baseUrl,token=null,timeout=10000,fetchImpl=globalThis.fetch,defaultHeaders={}}={}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation required');
  const base=normalizeBaseUrl(baseUrl);

  async function request(method,path,{body,headers={}}={}) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new Error('upstream_timeout')),timeout);
    const payload=body===undefined?undefined:JSON.stringify(body);
    const requestHeaders={
      accept:'application/json',
      ...(payload?{'content-type':'application/json'}:{}),
      ...(token?{authorization:`Bearer ${token}`}:{ }),
      ...defaultHeaders,
      ...headers,
    };
    try {
      const response=await fetchImpl(`${base}${path}`,{method,headers:requestHeaders,body:payload,signal:controller.signal});
      const type=response.headers.get('content-type')||'';
      let parsed={};
      if(type.includes('application/json')) parsed=await response.json();
      else { const text=await response.text(); parsed=text?{message:text}:{}; }
      if(!response.ok){
        const error=new Error(safeErrorMessage(response.status,parsed));
        error.code=parsed?.error||`http_${response.status}`;
        error.status=response.status;
        throw error;
      }
      return parsed;
    } catch(error) {
      if(error?.name==='AbortError'||controller.signal.aborted){const timeoutError=new Error('upstream_timeout');timeoutError.code='upstream_timeout';throw timeoutError}
      throw error;
    } finally { clearTimeout(timer); }
  }

  return Object.freeze({
    baseUrl:base,
    get:(path,opts)=>request('GET',path,opts),
    post:(path,body,opts={})=>request('POST',path,{...opts,body}),
    patch:(path,body,opts={})=>request('PATCH',path,{...opts,body}),
    delete:(path,opts)=>request('DELETE',path,opts),
  });
}
