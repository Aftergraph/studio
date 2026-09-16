import { createJsonHttpClient } from './http-json.mjs';

const receiptId=/^dvr_[a-f0-9]{64}$/;
const nonEmpty=value=>typeof value==='string'&&value.trim()?value.trim():null;

export function projectWorksOutcomeVerification(payload,workId){
  const id=nonEmpty(workId);
  if(!id)return Object.freeze({source:'works-execution',workId:null,status:'unknown'});
  const ov=payload?.outcome_verification;
  if(!ov||typeof ov!=='object'||Array.isArray(ov))return Object.freeze({source:'works-execution',workId:id,status:'unknown'});
  if(ov.status==='pending')return Object.freeze({source:'works-execution',workId:id,status:'pending'});
  if(!['passed','failed'].includes(ov.status))return Object.freeze({source:'works-execution',workId:id,status:'unknown'});
  const verifierRef=nonEmpty(ov.verifier_id);
  const receiptRef=nonEmpty(ov.evidence_ref);
  const verifiedAt=nonEmpty(ov.verified_at);
  if(!verifierRef?.startsWith('sentinel:')||!receiptId.test(receiptRef||'')||!verifiedAt||Number.isNaN(Date.parse(verifiedAt))){
    return Object.freeze({source:'works-execution',workId:id,status:'unknown'});
  }
  return Object.freeze({source:'works-execution',workId:id,status:ov.status,verifierRef,receiptRef,verifiedAt});
}

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
