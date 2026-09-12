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
