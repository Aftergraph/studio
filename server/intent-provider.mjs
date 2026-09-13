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

export function createHermesIntentProvider({
  runImpl=execFile,
  command='hermes',
  provider=process.env.AFTERGRAPH_INTENT_HERMES_PROVIDER||'openrouter',
  model=process.env.AFTERGRAPH_INTENT_HERMES_MODEL||'deepseek/deepseek-v4.1-flash',
  reasoning=process.env.AFTERGRAPH_INTENT_HERMES_REASONING||'minimal',
  timeoutMs=Number(process.env.AFTERGRAPH_INTENT_HERMES_TIMEOUT_MS||45_000),
}={}){
  return createIntentProvider({
    invoke:async source=>{
      const result=await runImpl(command,[
        '--safe-mode',
        '--provider',provider,
        '-m',model,
        '--reasoning',reasoning,
        '-z',analysisPrompt(source),
      ],{maxBuffer:512*1024,timeout:timeoutMs});
      return String(result?.stdout||'').trim();
    },
  });
}


export function createHermesApiIntentProvider({
  fetchImpl=globalThis.fetch,
  baseUrl=process.env.AFTERGRAPH_INTENT_HERMES_URL||'http://127.0.0.1:8643',
  authHeader=process.env.AFTERGRAPH_INTENT_HERMES_AUTH||'',
  model=process.env.AFTERGRAPH_INTENT_HERMES_MODEL||'aftergraph-compose',
  timeoutMs=Number(process.env.AFTERGRAPH_INTENT_HERMES_TIMEOUT_MS||45_000),
}={}){
  return createIntentProvider({invoke:async source=>{
    if(!authHeader)throw providerError('provider_unconfigured','Hermes API authentication is not configured');
    const response=await fetchImpl(`${String(baseUrl).replace(/\/$/,'')}/v1/chat/completions`,{
      method:'POST',signal:AbortSignal.timeout(timeoutMs),
      headers:{authorization:authHeader,'content-type':'application/json'},
      body:JSON.stringify({model,stream:false,messages:[
        {role:'system',content:'Return strict JSON only. Extract candidate intent semantics without granting new authority. Prefer explicit ambiguity over guessing. Relevant fields: goal, artifact, scope, constraints, authority, capabilities, verification, output, targetHints, ambiguities.'},
        {role:'user',content:String(source||'')},
      ]}),
    });
    if(!response?.ok)throw providerError('provider_request_failed','Hermes API request failed',502);
    const body=await response.json();
    const choice=body?.choices?.[0];
    if(body?.hermes?.failed || choice?.finish_reason==='error')throw providerError('provider_request_failed','Hermes agent failed to produce intent',502);
    return String(choice?.message?.content||'').trim();
  }});
}
