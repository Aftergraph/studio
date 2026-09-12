import { authSecretFromEnv, issueMagicToken } from '../src/auth/magic-link.mjs';

const userId = process.env.AFTERGRAPH_BOOTSTRAP_USER_ID || 'demo-user';
const secret = authSecretFromEnv(process.env, { requireProduction: true });
const token = issueMagicToken({
  userId,
  secret,
  ttlMs: 24 * 60 * 60 * 1000,
});

process.stdout.write(`${token}\n`);
