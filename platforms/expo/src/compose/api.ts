import type { CompileResponse, ComposeTarget } from './types';

const baseUrl = (process.env.EXPO_PUBLIC_AFTERGRAPH_API_URL || 'http://127.0.0.1:8000').replace(/\/$/,'');

export async function compileIntent(source:string,target:ComposeTarget='auto'):Promise<CompileResponse>{
  const response=await fetch(`${baseUrl}/api/v1/intent/compile`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({source,target}),
  });
  const body=await response.json();
  if(!response.ok){
    const error=new Error(body?.error || 'compile_failed');
    (error as Error & {code?:string}).code=body?.error || 'compile_failed';
    throw error;
  }
  return body as CompileResponse;
}

export function getComposeApiBaseUrl(){return baseUrl;}
