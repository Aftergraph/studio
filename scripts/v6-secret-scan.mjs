import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const FORBIDDEN_PATTERNS = [
  { name: 'AFTERGRAPH_API_TOKEN', pattern: /AFTERGRAPH_API_TOKEN\s*=\s*['"][^'"]+['"]/i },
  { name: 'TG_TOKEN', pattern: /TG_TOKEN\s*=\s*['"][^'"]+['"]/i },
  { name: 'Authorization Bearer Token', pattern: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/i },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'GitHub Personal Access Token', pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { name: 'OpenAI Secret Key', pattern: /sk-[A-Za-z0-9]{20,}/ }
];

const SCAN_DIRS = ['src', 'server', 'packages', 'contracts', 'styles'];
const SCAN_FILES = ['index.html', 'server.mjs', 'package.json'];

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const violations = [];
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({ file: path.relative(root, filePath), rule: name });
    }
  }
  return violations;
}

function walkDir(dir) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== '.git' && entry !== '.runtime') {
        results.push(...walkDir(full));
      }
    } else if (stat.isFile() && /\.(mjs|js|json|html|css|md)$/.test(entry)) {
      results.push(...scanFile(full));
    }
  }
  return results;
}

let allViolations = [];
for (const file of SCAN_FILES) {
  const p = path.join(root, file);
  allViolations.push(...scanFile(p));
}
for (const dir of SCAN_DIRS) {
  const p = path.join(root, dir);
  allViolations.push(...walkDir(p));
}

if (allViolations.length > 0) {
  console.error(`FAIL: Detected ${allViolations.length} potential secret leak(s):`);
  for (const v of allViolations) {
    console.error(`  - ${v.file}: ${v.rule}`);
  }
  process.exit(1);
} else {
  console.log('PASS V6 secret scan: 0 live secrets or credentials detected across all scanned surfaces');
}
