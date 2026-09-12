import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFile=promisify(nodeExecFile);

function providerError(code,message,status){
  const error=new Error(message);
  error.code=code;
  if(status)error.status=status;
  return error;
}

function parseCandidate(value){
  if(typeof value!=='string'||!value.trim()){
    throw providerError('provider_invalid_response','Intent provider returned no candidate content');
  }
  try {
    const parsed=JSON.parse(value.trim());
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('candidate must be object');
    return parsed;
  } catch {
    throw providerError('provider_invalid_response','Intent provider returned invalid JSON');
  }
}

export function createIntentProvider({invoke}={}){
  return {
    async analyze({source}){
      if(typeof invoke!=='function'){
        throw providerError('provider_unconfigured','Intent provider is not configured');
      }
      try {
        return parseCandidate(await invoke(String(source||'')));
      } catch(error) {
        if(error?.code)throw error;
        throw providerError('provider_request_failed','Intent provider invocation failed',502);
      }
    },
  };
}

function analysisPrompt(source){
  return [
    'Return strict JSON only.',
    'Extract candidate intent semantics without granting new authority.',
    'Prefer explicit ambiguity over guessing.',
    'Relevant fields: goal, artifact, scope, constraints, authority, capabilities, verification, output, targetHints, ambiguities.',
    `SOURCE: ${String(source||'')}`,
  ].join('\n');
}

export function createHermesIntentProvider({runImpl=execFile,command='hermes'}={}){
  return createIntentProvider({
    invoke:async source=>{
      const result=await runImpl(command,[
        '--ignore-rules',
        '-z',analysisPrompt(source),
      ],{
        maxBuffer:512*1024,
        timeout:60_000,
      });
      return String(result?.stdout||'').trim();
    },
  });
}
