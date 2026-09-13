import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntentProvider, createHermesIntentProvider } from '../server/intent-provider.mjs';

test('generic provider rejects missing adapter', async () => {
  const provider=createIntentProvider({});
  await assert.rejects(
    () => provider.analyze({source:'rough thought'}),
    error => error.code === 'provider_unconfigured',
  );
});

test('generic provider parses strict JSON candidate output', async () => {
  const provider=createIntentProvider({
    invoke:async()=>'{"goal":{"statement":"Ship safely"}}',
  });
  const result=await provider.analyze({source:'ship it'});
  assert.equal(result.goal.statement,'Ship safely');
});

test('generic provider rejects malformed output', async () => {
  const provider=createIntentProvider({invoke:async()=>'not-json'});
  await assert.rejects(
    () => provider.analyze({source:'rough thought'}),
    error => error.code === 'provider_invalid_response',
  );
});

test('hermes adapter keeps analysis local and parses stdout', async () => {
  let call;
  const provider=createHermesIntentProvider({
    runImpl:async(command,args)=>{
      call={command,args};
      return {stdout:'{"goal":{"statement":"Review Relay"}}'};
    },
  });
  const result=await provider.analyze({source:'review relay'});
  assert.equal(result.goal.statement,'Review Relay');
  assert.equal(call.command,'hermes');
  assert.ok(call.args.includes('-z'));
});

test('hermes adapter uses bounded inference-only safe mode', async () => {
  let call;
  const provider=createHermesIntentProvider({
    provider:'openrouter',model:'deepseek/deepseek-v4.1-flash',reasoning:'minimal',timeoutMs:45_000,
    runImpl:async(command,args,options)=>{
      call={command,args,options};
      return {stdout:'{"goal":{"statement":"Fast intent"}}'};
    },
  });
  await provider.analyze({source:'make this clear'});
  assert.ok(call.args.includes('--safe-mode'));
  assert.deepEqual(call.args.slice(1,7),['--provider','openrouter','-m','deepseek/deepseek-v4.1-flash','--reasoning','minimal']);
  assert.equal(call.options.timeout,45_000);
});


test('hermes api adapter sends authenticated stateless chat request', async () => {
  let call;
  const { createHermesApiIntentProvider }=await import('../server/intent-provider.mjs');
  const provider=createHermesApiIntentProvider({
    baseUrl:'http://127.0.0.1:8643',authHeader:'opaque-local-auth',model:'aftergraph-compose',
    fetchImpl:async(url,options)=>{
      call={url,options};
      return new Response(JSON.stringify({choices:[{message:{content:'{"goal":{"statement":"Review Relay"}}'},finish_reason:'stop'}]}),{status:200,headers:{'content-type':'application/json'}});
    },
  });
  const result=await provider.analyze({source:'review relay'});
  assert.equal(result.goal.statement,'Review Relay');
  assert.equal(call.url,'http://127.0.0.1:8643/v1/chat/completions');
  assert.equal(call.options.headers.authorization,'opaque-local-auth');
  const body=JSON.parse(call.options.body);
  assert.equal(body.stream,false);
  assert.equal(body.model,'aftergraph-compose');
  assert.equal(body.messages.at(-1).content,'review relay');
});

test('hermes api adapter fails closed on agent error responses', async () => {
  const { createHermesApiIntentProvider }=await import('../server/intent-provider.mjs');
  const provider=createHermesApiIntentProvider({
    baseUrl:'http://127.0.0.1:8643',authHeader:'opaque-local-auth',
    fetchImpl:async()=>new Response(JSON.stringify({
      choices:[{message:{content:'billing exhausted'},finish_reason:'error'}],
      hermes:{failed:true,error:'provider unavailable'},
    }),{status:200,headers:{'content-type':'application/json'}}),
  });
  await assert.rejects(
    () => provider.analyze({source:'make it clearer'}),
    error => error.code === 'provider_request_failed',
  );
});

test('hermes api adapter rejects missing server credential', async () => {
  const { createHermesApiIntentProvider }=await import('../server/intent-provider.mjs');
  const provider=createHermesApiIntentProvider({baseUrl:'http://127.0.0.1:8643',authHeader:''});
  await assert.rejects(
    () => provider.analyze({source:'make it clearer'}),
    error => error.code === 'provider_unconfigured',
  );
});
