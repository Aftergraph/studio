import {sendJson} from './http-utils.mjs';
export const isApiRequest=url=>url.pathname.startsWith('/api/v1/');
export function sendApiError(res,error){
  const status=Number.isInteger(error?.status)?error.status:error?.code==='invalid_json'?400:error?.code==='payload_too_large'?413:500;
  const known=['invalid_json','payload_too_large','forbidden','idempotency_conflict','confirmation_required','actor_required','invalid_decision','invalid_control_mode','approval_not_found','mission_not_found','memory_not_found'];
  sendJson(res,status,{error:known.includes(error?.code)?error.code:status===500?'internal_error':String(error?.message||'request_failed')});
}
