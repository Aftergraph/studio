import { createJsonHttpClient } from './http-json.mjs';

export function createWorksAdapter({baseUrl,token,timeout,fetchImpl}={}){
  const http=createJsonHttpClient({baseUrl,token,timeout,fetchImpl});
  const workPath=id=>`/v1/works/${encodeURIComponent(id)}`;
  return Object.freeze({
    kind:'works-execution',
    health:()=>http.get('/healthz'),
    listWorks:()=>http.get('/v1/works'),
    createWork:body=>http.post('/v1/works',body),
    work:id=>http.get(workPath(id)),
    events:(id,{after=0,limit=100}={})=>http.get(`${workPath(id)}/events?after=${encodeURIComponent(String(after))}&limit=${encodeURIComponent(String(limit))}`),
    evidence:id=>http.get(`${workPath(id)}/evidence`),
    provenance:id=>http.get(`${workPath(id)}/provenance`),
    handoff:id=>http.get(`${workPath(id)}/handoff`),
    suspend:(id,body={})=>http.post(`${workPath(id)}/suspend`,body),
    resume:(id,body={})=>http.post(`${workPath(id)}/resume`,body),
    cancel:(id,body={})=>http.post(`${workPath(id)}/cancel`,body),
    brainPath:path=>http.get(`/v1/brain/objects?path=${encodeURIComponent(path)}`),
    brainPrefix:prefix=>http.get(`/v1/brain/objects?prefix=${encodeURIComponent(prefix)}`),
    brainAppend:body=>http.post('/v1/brain/objects',body),
  });
}
