import { esc, attr } from '../shared.mjs';

const RECEIPT_RE=/^dvr_[a-f0-9]{64}$/;
function terminal(v){
  const status=String(v?.status||'unknown');
  if(!['passed','failed'].includes(status))return null;
  const verifierRef=String(v?.verifierRef||'');
  const receiptRef=String(v?.receiptRef||'');
  const verifiedAt=String(v?.verifiedAt||'');
  if(!verifierRef.startsWith('sentinel:')||!RECEIPT_RE.test(receiptRef)||!verifiedAt||Number.isNaN(Date.parse(verifiedAt)))return null;
  return {status,verifierRef,receiptRef,verifiedAt};
}

export function AGVerificationProvenance({verification}={}){
  if(String(verification?.status||'unknown')==='pending'){
    return '<span class="ag-verification-provenance pending" data-ag-component="verification-provenance" data-verification-status="pending"><strong>Verification pending</strong></span>';
  }
  const v=terminal(verification);
  if(!v){
    return '<span class="ag-verification-provenance unknown" data-ag-component="verification-provenance" data-verification-status="unknown"><strong>Verification unavailable</strong></span>';
  }
  const label=v.status==='passed'?'Verified outcome':'Verification failed';
  const short=v.receiptRef.slice(0,12);
  return `<span class="ag-verification-provenance ${attr(v.status)}" data-ag-component="verification-provenance" data-verification-status="${attr(v.status)}" title="${attr(v.verifierRef)} · ${attr(v.receiptRef)} · ${attr(v.verifiedAt)}"><strong>${esc(label)}</strong><small>${esc(v.verifierRef)}</small><code>${esc(short)}…</code></span>`;
}
