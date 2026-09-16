import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AGVerificationProvenance } from '../packages/ui/index.mjs';

test('verification provenance renders durable Sentinel receipt semantics fail-closed',()=>{
  const receipt='dvr_'+ 'a'.repeat(64);
  const passed=AGVerificationProvenance({verification:{source:'works-execution',workId:'wrk_1',status:'passed',verifierRef:'sentinel:domain-verifier',receiptRef:receipt,verifiedAt:'2026-09-16T06:00:00Z'}});
  assert.match(passed,/Verified outcome/);
  assert.match(passed,/sentinel:domain-verifier/);
  assert.match(passed,/dvr_aaaaaaaa/);
  assert.match(passed,/data-verification-status="passed"/);
  const malformed=AGVerificationProvenance({verification:{status:'passed',verifierRef:'agent:self',receiptRef:'not-a-receipt'}});
  assert.doesNotMatch(malformed,/Verified outcome/);
  assert.match(malformed,/Verification unavailable/);
  assert.match(AGVerificationProvenance({verification:{status:'pending'}}),/Verification pending/);
  assert.match(AGVerificationProvenance({verification:{status:'failed',verifierRef:'sentinel:domain-verifier',receiptRef:receipt,verifiedAt:'2026-09-16T06:00:00Z'}}),/Verification failed/);
});

test('bootstrap treats verification as ephemeral GET context projection, never persisted business truth',async()=>{
  const source=await readFile(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
  assert.match(source,/apiClient\.context\(/);
  assert.match(source,/verificationProjection/);
  assert.match(source,/AGVerificationProvenance/);
  assert.doesNotMatch(source,/verificationProjection[^\n]{0,80}saveState\(/);
});
