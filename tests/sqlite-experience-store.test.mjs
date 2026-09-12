import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SQLiteExperienceStore } from '../src/persistence/sqlite-experience-store.mjs';

const document=tenantId=>({tenantId,layout:{mode:'chat'},preferences:{density:'calm'}});

async function withFile(fn){
  const dir=await mkdtemp(path.join(os.tmpdir(),'ag-studio-sqlite-'));
  const file=path.join(dir,'studio.db');
  try{return await fn({dir,file});}
  finally{await rm(dir,{recursive:true,force:true});}
}

test('SQLite store persists a tenant document and version across reopen',async()=>{
  await withFile(async({file})=>{
    let store=await new SQLiteExperienceStore({filename:file}).init();
    assert.deepEqual(await store.read('tenant:acme'),{tenantId:'tenant:acme',version:0,document:null});
    const write=await store.write({tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'k1'});
    assert.equal(write.version,1); await store.close();
    store=await new SQLiteExperienceStore({filename:file}).init();
    const read=await store.read('tenant:acme');
    assert.equal(read.version,1); assert.equal(read.document.layout.mode,'chat');
    await store.close();
  });
});

test('SQLite store enables durable production pragmas and schema v1',async()=>{
  const store=await new SQLiteExperienceStore().init();
  const d=await store.diagnostics();
  assert.equal(d.schemaVersion,1);
  assert.equal(String(d.journalMode).toLowerCase(),'memory');
  assert.equal(d.foreignKeys,true);
  assert.ok(d.busyTimeoutMs>=5000);
  assert.equal((await store.integrityCheck()).ok,true);
  await store.close();
});

test('SQLite file store runs in WAL mode',async()=>{
  await withFile(async({file})=>{
    const store=await new SQLiteExperienceStore({filename:file}).init();
    assert.equal(String((await store.diagnostics()).journalMode).toLowerCase(),'wal');
    await store.close();
  });
});
test('optimistic version conflicts fail closed without partial state',async()=>{
  const store=await new SQLiteExperienceStore().init();
  await store.write({tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'first'});
  await assert.rejects(
    store.write({tenantId:'tenant:acme',document:{tenantId:'tenant:acme',layout:{mode:'work'}},expectedVersion:0,idempotencyKey:'stale'}),
    error=>error.code==='version_conflict'&&error.currentVersion===1,
  );
  const read=await store.read('tenant:acme');
  assert.equal(read.version,1);
  assert.equal(read.document.layout.mode,'chat');
  assert.equal((await store.readEvents('tenant:acme')).events.length,1);
  await store.close();
});

test('idempotent replay returns original result exactly once',async()=>{
  const store=await new SQLiteExperienceStore().init();
  const input={tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'same'};
  const a=await store.write(input); const b=await store.write(input);
  assert.deepEqual(b,a);
  assert.equal((await store.read('tenant:acme')).version,1);
  assert.equal((await store.readEvents('tenant:acme')).events.length,1);
  await store.close();
});
test('idempotency key reuse with another payload fails closed',async()=>{
  const store=await new SQLiteExperienceStore().init();
  await store.write({tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'reuse'});
  await assert.rejects(
    store.write({tenantId:'tenant:acme',document:{tenantId:'tenant:acme',layout:{mode:'space'}},expectedVersion:1,idempotencyKey:'reuse'}),
    error=>error.code==='idempotency_conflict',
  );
  assert.equal((await store.read('tenant:acme')).version,1);
  assert.equal((await store.readEvents('tenant:acme')).events.length,1);
  await store.close();
});

test('tenant documents and event streams remain isolated',async()=>{
  const store=await new SQLiteExperienceStore().init();
  await store.write({tenantId:'tenant:a',document:document('tenant:a'),expectedVersion:0,idempotencyKey:'a1'});
  await store.write({tenantId:'tenant:b',document:{tenantId:'tenant:b',layout:{mode:'work'}},expectedVersion:0,idempotencyKey:'b1'});
  assert.equal((await store.read('tenant:a')).document.layout.mode,'chat');
  assert.equal((await store.read('tenant:b')).document.layout.mode,'work');
  assert.deepEqual((await store.readEvents('tenant:a')).events.map(e=>e.tenantId),['tenant:a']);
  assert.deepEqual((await store.readEvents('tenant:b')).events.map(e=>e.tenantId),['tenant:b']);
  await store.close();
});
test('events are ordered by document version and cursor advances deterministically',async()=>{
  const store=await new SQLiteExperienceStore().init();
  await store.write({tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'e1'});
  await store.write({tenantId:'tenant:acme',document:{tenantId:'tenant:acme',layout:{mode:'work'}},expectedVersion:1,idempotencyKey:'e2'});
  await store.write({tenantId:'tenant:acme',document:{tenantId:'tenant:acme',layout:{mode:'space'}},expectedVersion:2,idempotencyKey:'e3'});
  const first=await store.readEvents('tenant:acme',{after:0,limit:2});
  assert.deepEqual(first.events.map(e=>e.sequence),[1,2]);
  assert.equal(first.cursor,2);
  const second=await store.readEvents('tenant:acme',{after:first.cursor,limit:2});
  assert.deepEqual(second.events.map(e=>e.sequence),[3]);
  assert.equal(second.currentVersion,3);
  await store.close();
});

test('pruned history returns explicit resync requirement instead of fabricating gaps',async()=>{
  const store=await new SQLiteExperienceStore().init();
  await store.write({tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'p1'});
  await store.write({tenantId:'tenant:acme',document:{tenantId:'tenant:acme',layout:{mode:'work'}},expectedVersion:1,idempotencyKey:'p2'});
  await store.pruneEventsThrough('tenant:acme',1);
  const stale=await store.readEvents('tenant:acme',{after:0});
  assert.equal(stale.resyncRequired,true);
  assert.equal(stale.historyFloor,1);
  assert.deepEqual(stale.events,[]);
  const current=await store.readEvents('tenant:acme',{after:1});
  assert.deepEqual(current.events.map(e=>e.sequence),[2]);
  await store.close();
});
test('backup is independently restorable and passes integrity check',async()=>{
  await withFile(async({dir,file})=>{
    const backup=path.join(dir,'backup.db');
    let store=await new SQLiteExperienceStore({filename:file}).init();
    await store.write({tenantId:'tenant:acme',document:document('tenant:acme'),expectedVersion:0,idempotencyKey:'backup-1'});
    await store.backup(backup);
    await store.close();
    store=await new SQLiteExperienceStore({filename:backup}).init();
    const restored=await store.read('tenant:acme');
    assert.equal(restored.version,1);
    assert.equal(restored.document.layout.mode,'chat');
    assert.equal((await store.integrityCheck()).ok,true);
    await store.close();
  });
});