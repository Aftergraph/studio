import { createJsonHttpClient } from './http-json.mjs';

function approvalVerb(decision){
  if(decision==='approve'||decision==='approved') return 'approve';
  if(decision==='deny'||decision==='denied'||decision==='reject'||decision==='rejected') return 'deny';
  throw new Error('decision must be approve or deny');
}

export function createTrustGatewayAdapter({baseUrl,token,timeout,fetchImpl}={}){
  const http=createJsonHttpClient({baseUrl,token,timeout,fetchImpl});
  return Object.freeze({
    kind:'trust-gateway',
    health:()=>http.get('/healthz'),
    identity:()=>http.get('/v2/whoami'),
    approvals:()=>http.get('/v1/approvals'),
    needsYou:()=>http.get('/v2/need-you/now'),
    verifyAudit:()=>http.get('/v1/audit/verify'),
    audit:(since=0)=>http.get(`/v1/audit${since?`?since=${encodeURIComponent(String(since))}`:''}`),
    decideApproval:(id,decision)=>http.post(`/v1/approvals/${encodeURIComponent(id)}/${approvalVerb(decision)}`,{}),
    action:(tool,args)=>http.post('/v1/actions',args===undefined?{tool}:{tool,args}),
  });
}
