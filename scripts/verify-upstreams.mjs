import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSourceTruthBundle } from '../src/integrations/source-truth.mjs';
import { UPSTREAM_REVISIONS } from '../src/integrations/upstream-hub.mjs';

const root=path.join(fileURLToPath(new URL('..',import.meta.url)),'upstreams');
const read=rel=>JSON.parse(readFileSync(path.join(root,rel),'utf8'));
const report=validateSourceTruthBundle({
  manifest:read('UPSTREAM-MANIFEST.json'),
  missionState:read('contracts/governance/mission-state-1.0.json'),
  policyToken:read('contracts/governance/policy.token.schema.json'),
  workIntelligenceBoundary:read('contracts/work-intelligence/work-intelligence-boundary-1.0.json'),
  revisions:UPSTREAM_REVISIONS,
});
if(!report.ok){for(const error of report.errors)console.error(`FAIL ${error}`);process.exit(1)}
console.log(`PASS exact-head source truth: ${report.repositories} repositories, ${report.missionStates} mission states`);
console.log(`PASS Work Intelligence boundary: execution_authority=${report.workIntelligenceExecutionAuthority}, promotion_required=${report.workIntelligencePromotionRequired}, human_review_required=${report.workIntelligenceHumanReviewRequired}`);
