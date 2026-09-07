import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLesson } from '../src/goal/goal-lesson.mjs';
import { createAppServer } from '../server.mjs';

test('lesson requires human author, verdict and non-empty text', () => {
  assert.throws(() => createLesson({ missionId: 'm1', verdict: 'success', lesson: 'x', by: 'agent:worker' }), /human/);
  assert.throws(() => createLesson({ missionId: 'm1', verdict: 'maybe', lesson: 'x', by: 'demo-user' }), /verdict/);
  assert.throws(() => createLesson({ missionId: 'm1', verdict: 'success', lesson: '  ', by: 'demo-user' }), /lesson/);
  const lesson = createLesson({ missionId: 'm1', verdict: 'failure', lesson: 'deploy needs freeze', by: 'demo-user' });
  assert.equal(lesson.missionId, 'm1');
  assert.ok(lesson.recordedAt);
});

async function withServer(fn) {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-lessons-'));
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile: join(dir, 'ws.json'), runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

async function post(port, path, body, key) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

test('lessons server: record and filter by verdict in user scope', async () => {
  await withServer(async port => {
    const bad = await post(port, '/api/v1/lessons', { actor: 'demo-user', missionId: 'm1', verdict: 'success', lesson: 'x', by: 'agent:worker' }, 'les-bad-1');
    assert.equal(bad.status, 422, 'agent author rejected');
    const ok = await post(port, '/api/v1/lessons', { actor: 'demo-user', missionId: 'm1', verdict: 'failure', lesson: 'freeze before deploy', by: 'demo-user' }, 'les-ok-1');
    assert.equal(ok.status, 201);
    await post(port, '/api/v1/lessons', { actor: 'demo-user', missionId: 'm2', verdict: 'success', lesson: 'cache helped', by: 'demo-user' }, 'les-ok-2');
    const failures = await (await fetch(`http://127.0.0.1:${port}/api/v1/lessons?actor=demo-user&verdict=failure`)).json();
    assert.equal(failures.lessons.length, 1);
    assert.equal(failures.lessons[0].lesson, 'freeze before deploy');
    const other = await (await fetch(`http://127.0.0.1:${port}/api/v1/lessons?actor=demo-user`)).json();
    assert.equal(other.lessons.length, 2);
  });
});
