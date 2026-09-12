// User profile capability validation — TDD test suite.
// ponytail: minimal in-memory validation, no persistence, no framework.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCapabilities } from '../src/user/capability-set.mjs';
import { createUser, getUser, updateCapabilities } from '../src/user/user-store.mjs';

describe('capability-set', () => {
  it('rejects wildcard "*" with invalid_capability error', () => {
    assert.throws(
      () => normalizeCapabilities(['mission.execute', '*']),
      /invalid_capability/,
      'wildcard "*" must be rejected'
    );
  });

  it('deduplicates capabilities', () => {
    const caps = normalizeCapabilities(['mission.execute', 'mission.execute']);
    assert.deepEqual(caps, ['mission.execute']);
  });

  it('validates against allowlist', () => {
    assert.throws(
      () => normalizeCapabilities(['mission.execute', 'invalid.op']),
      /invalid_capability/,
      'unknown capability must be rejected'
    );
  });

  it('accepts valid InstitutionalGraph operations', () => {
    const caps = normalizeCapabilities([
      'mission.execute',
      'agent.assign',
      'policy.read',
      'evidence.read',
      'organization.read',
    ]);
    assert.deepEqual(caps, [
      'mission.execute',
      'agent.assign',
      'policy.read',
      'evidence.read',
      'organization.read',
    ]);
  });

  it('accepts memory operations', () => {
    const caps = normalizeCapabilities(['memory.write', 'memory.promote']);
    assert.deepEqual(caps, ['memory.write', 'memory.promote']);
  });

  it('accepts autonomy.* pattern', () => {
    const caps = normalizeCapabilities(['autonomy.plan', 'autonomy.execute']);
    assert.deepEqual(caps, ['autonomy.plan', 'autonomy.execute']);
  });
});

describe('user-store', () => {
  it('creates user with valid capabilities (no wildcard)', () => {
    const user = createUser({
      id: 'alice',
      name: 'Alice',
      role: 'operator',
      capabilities: ['mission.execute'],
    });
    assert.equal(user.id, 'alice');
    assert.equal(user.name, 'Alice');
    assert.equal(user.role, 'operator');
    assert.deepEqual(user.capabilities, ['mission.execute']);
    assert.ok(!user.capabilities.includes('*'), 'user must not have wildcard');
  });

  it('returns undefined for unknown user', () => {
    const user = getUser('unknown-user-id');
    assert.equal(user, undefined);
  });

  it('rejects wildcard in createUser', () => {
    assert.throws(
      () =>
        createUser({
          id: 'bad-user',
          name: 'Bad',
          role: 'operator',
          capabilities: ['*'],
        }),
      /invalid_capability/,
      'wildcard must be rejected in createUser'
    );
  });

  it('updateCapabilities rejects invalid capability', () => {
    createUser({
      id: 'bob',
      name: 'Bob',
      role: 'operator',
      capabilities: ['mission.execute'],
    });
    assert.throws(
      () => updateCapabilities('bob', ['invalid.cap']),
      /invalid_capability/,
      'updateCapabilities must validate against allowlist'
    );
  });

  it('updateCapabilities replaces capabilities', () => {
    createUser({
      id: 'charlie',
      name: 'Charlie',
      role: 'operator',
      capabilities: ['mission.execute'],
    });
    const updated = updateCapabilities('charlie', [
      'mission.execute',
      'agent.assign',
    ]);
    assert.deepEqual(updated.capabilities, ['mission.execute', 'agent.assign']);
  });

  it('rejects user ids that can escape per-user state file paths', () => {
    for (const id of ['../../escape', '..\\\\escape', '/absolute', '']) {
      assert.throws(
        () => createUser({ id, capabilities: [] }),
        /invalid_user_id|user id/i,
        `unsafe user id must be rejected: ${id}`,
      );
    }
  });
});
