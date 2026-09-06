import { createJsonHttpClient } from './http-json.mjs';

export function createWorkIntelligenceAdapter({baseUrl,token,timeout,fetchImpl}={}){
  const http=createJsonHttpClient({baseUrl,token,timeout,fetchImpl});
  const workPath=id=>`/v1/work-items/${encodeURIComponent(id)}`;
  return Object.freeze({
    kind:'work-intelligence-v2',
    health:()=>http.get('/healthz'),
    observations:query=>http.get(`/v1/observations${query?`?${new URLSearchParams(query)}`:''}`),
    ingest:body=>http.post('/v1/observations',body),
    workItems:()=>http.get('/v1/work-items'),
    workItem:id=>http.get(workPath(id)),
    actions:id=>http.get(`${workPath(id)}/actions`),
    evidence:id=>http.get(`${workPath(id)}/evidence`),
    transitions:id=>http.get(`${workPath(id)}/transitions`),
    review:(id,{decision,actor}={})=>{
      if(!decision||!actor) throw new Error('review requires decision and actor');
      return http.post(`${workPath(id)}/review`,{decision,actor});
    },
    promote:(id,{actor}={})=>{
      if(!actor) throw new Error('promotion requires explicit human actor');
      return http.post(`${workPath(id)}/promote`,{actor});
    },
  });
}
