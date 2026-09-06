import {sendJson} from './http-utils.mjs';
export const isApiRequest=url=>url.pathname.startsWith('/api/v1/');
export function sendApiError(res,error){if(error?.code==='invalid_json'){sendJson(res,400,{error:'invalid_json'});return}if(error?.code==='payload_too_large'){sendJson(res,413,{error:'payload_too_large'});return}sendJson(res,500,{error:'internal_error'})}
