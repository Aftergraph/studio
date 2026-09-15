import { AGGenUIError } from './component-registry.mjs';

const FRAME_KEYS=new Set(['componentId','version','instanceId','props','interactionClass']);

function fail(code,message,details={}){throw new AGGenUIError(code,message,details)}

function isPlainObject(value){
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);
  return proto===Object.prototype||proto===null;
}

function byteLength(value){
  return new TextEncoder().encode(String(value)).byteLength;
}

export function normalizeGeneratedFrame(input) {
  if(!isPlainObject(input))fail('generated_frame_invalid','Generated UI frame must be an object');
  const unknown=Object.keys(input).filter(key=>!FRAME_KEYS.has(key));
  if(unknown.length)fail('generated_frame_invalid','Generated UI frame contains unsupported fields',{unknown});
  const componentId=String(input.componentId||'').trim();
  const version=String(input.version||'').trim();
  if(!componentId||!version)fail('generated_frame_invalid','Generated UI frame requires componentId and version');
  if(input.props!==undefined&&!isPlainObject(input.props))fail('generated_frame_invalid','Generated UI props must be an object');
  if(input.instanceId!==undefined&&typeof input.instanceId!=='string')fail('generated_frame_invalid','Generated UI instanceId must be a string');
  if(input.interactionClass!==undefined&&typeof input.interactionClass!=='string')fail('generated_frame_invalid','Generated UI interactionClass must be a string');
  return Object.freeze({
    componentId,version,
    ...(input.instanceId?{instanceId:input.instanceId}:{}),
    props:Object.freeze({...input.props}),
    ...(input.interactionClass?{interactionClass:input.interactionClass}:{}),
  });
}

export function createGeneratedUIParser({maxBytes=64*1024}={}) {
  let buffer='';
  let complete=null;
  const limit=Math.max(1,Number(maxBytes)||64*1024);
  return Object.freeze({
    push(chunk='') {
      if(complete)fail('generated_frame_closed','Generated UI frame is already complete');
      buffer+=String(chunk);
      if(byteLength(buffer)>limit)fail('generated_frame_too_large','Generated UI frame exceeded stream limit',{maxBytes:limit});
      try {
        const parsed=JSON.parse(buffer);
        complete=normalizeGeneratedFrame(parsed);
        return Object.freeze({status:'complete',node:complete});
      } catch(error) {
        if(error instanceof AGGenUIError)throw error;
        return Object.freeze({status:'incomplete'});
      }
    },
    finish() {
      if(complete)return Object.freeze({status:'complete',node:complete});
      try {
        complete=normalizeGeneratedFrame(JSON.parse(buffer));
        return Object.freeze({status:'complete',node:complete});
      } catch(error) {
        if(error instanceof AGGenUIError)throw error;
        fail('generated_frame_parse_failed','Generated UI stream ended before a valid structured frame was produced');
      }
    },
  });
}
