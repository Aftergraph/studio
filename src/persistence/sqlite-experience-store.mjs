import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createExperienceDocument } from './experience-document.mjs';
import { assertExperienceStore, experienceStoreError } from './experience-store-contract.mjs';

const SCHEMA_VERSION = 1;
const clone = value => structuredClone(value);

function requiredString(value,name){
  if(typeof value!=='string'||value.trim()==='') throw experienceStoreError('invalid_argument',`${name} is required`);
  return value;
}
function integer(value,name,{min=0}={}){
  if(!Number.isInteger(value)||value<min) throw experienceStoreError('invalid_argument',`${name} must be an integer >= ${min}`);
  return value;
}
function canonical(value){
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
const parseJson=value=>JSON.parse(value);
export class SQLiteExperienceStore {
  constructor({filename=':memory:',clock=()=>new Date().toISOString(),busyTimeoutMs=5000}={}){
    this.filename=filename;
    this.clock=clock;
    this.busyTimeoutMs=busyTimeoutMs;
    this.db=null;
  }

  async init(){
    if(this.db) return this;
    if(this.filename!==':memory:') await mkdir(path.dirname(path.resolve(this.filename)),{recursive:true});
    this.db=new Database(this.filename,{timeout:this.busyTimeoutMs});
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma(`busy_timeout = ${this.busyTimeoutMs}`);
    this.db.pragma('synchronous = FULL');
    this.#migrate();
    assertExperienceStore(this);
    return this;
  }

  #requireDb(){
    if(!this.db) throw experienceStoreError('store_not_initialized','experience store is not initialized');
    return this.db;
  }
  #migrate(){
    const db=this.#requireDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS studio_migrations(
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
    `);
    const current=Number(db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM studio_migrations').get().version);
    if(current>SCHEMA_VERSION) throw experienceStoreError('schema_too_new',`database schema ${current} is newer than supported ${SCHEMA_VERSION}`);
    if(current===SCHEMA_VERSION) return;
    const migrate=db.transaction(()=>{
      db.exec(`
        CREATE TABLE IF NOT EXISTS experience_documents(
          tenant_id TEXT PRIMARY KEY,
          version INTEGER NOT NULL CHECK(version >= 0),
          document_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE IF NOT EXISTS experience_idempotency(
          tenant_id TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          request_hash TEXT NOT NULL,
          response_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY(tenant_id,idempotency_key)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS experience_events(
          tenant_id TEXT NOT NULL,
          sequence INTEGER NOT NULL CHECK(sequence > 0),
          event_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY(tenant_id,sequence)
        ) STRICT;
        CREATE TABLE IF NOT EXISTS experience_history_floor(
          tenant_id TEXT PRIMARY KEY,
          floor INTEGER NOT NULL CHECK(floor >= 0)
        ) STRICT;
      `);
      db.prepare('INSERT INTO studio_migrations(version,applied_at) VALUES(?,?)').run(SCHEMA_VERSION,this.clock());
    });
    migrate();
  }

  async read(tenantId){
    requiredString(tenantId,'tenantId');
    const row=this.#requireDb().prepare('SELECT version,document_json FROM experience_documents WHERE tenant_id=?').get(tenantId);
    if(!row) return Object.freeze({tenantId,version:0,document:null});
    return Object.freeze({tenantId,version:Number(row.version),document:clone(parseJson(row.document_json))});
  }
  async write({tenantId,document,expectedVersion,idempotencyKey}={}){
    tenantId=requiredString(tenantId,'tenantId');
    idempotencyKey=requiredString(idempotencyKey,'idempotencyKey');
    expectedVersion=integer(expectedVersion,'expectedVersion');
    let normalized;
    try{normalized=createExperienceDocument({...document,tenantId});}
    catch(error){throw experienceStoreError('invalid_document',error.message);}
    const requestHash=digest({tenantId,expectedVersion,document:normalized});
    const db=this.#requireDb();
    const existing=db.prepare('SELECT request_hash,response_json FROM experience_idempotency WHERE tenant_id=? AND idempotency_key=?').get(tenantId,idempotencyKey);
    if(existing){
      if(existing.request_hash!==requestHash) throw experienceStoreError('idempotency_conflict','idempotency key reused with different request');
      return clone(parseJson(existing.response_json));
    }

    const tx=db.transaction(()=>{
      const current=db.prepare('SELECT version FROM experience_documents WHERE tenant_id=?').get(tenantId);
      const currentVersion=Number(current?.version ?? 0);
      if(currentVersion!==expectedVersion) throw experienceStoreError('version_conflict','experience version conflict',{currentVersion});
      const version=currentVersion+1;
      const createdAt=this.clock();
      const event=Object.freeze({schema:'aftergraph.experience-event/1.0',tenantId,sequence:version,type:'experience.updated',documentVersion:version,createdAt});
      const documentJson=JSON.stringify(normalized);
      const eventJson=JSON.stringify(event);
      db.prepare(`INSERT INTO experience_documents(tenant_id,version,document_json,updated_at)
        VALUES(?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET version=excluded.version,document_json=excluded.document_json,updated_at=excluded.updated_at`)
        .run(tenantId,version,documentJson,createdAt);
      db.prepare('INSERT OR IGNORE INTO experience_history_floor(tenant_id,floor) VALUES(?,0)').run(tenantId);
      db.prepare('INSERT INTO experience_events(tenant_id,sequence,event_json,created_at) VALUES(?,?,?,?)')
        .run(tenantId,version,eventJson,createdAt);
      const response=Object.freeze({tenantId,version,document:normalized,event});
      db.prepare('INSERT INTO experience_idempotency(tenant_id,idempotency_key,request_hash,response_json,created_at) VALUES(?,?,?,?,?)')
        .run(tenantId,idempotencyKey,requestHash,JSON.stringify(response),createdAt);
      return response;
    });
    return clone(tx());
  }

  async readEvents(tenantId,{after=0,limit=100}={}){
    tenantId=requiredString(tenantId,'tenantId');
    after=integer(after,'after');
    limit=integer(limit,'limit',{min:1});
    if(limit>500) throw experienceStoreError('invalid_argument','limit must be <= 500');
    const db=this.#requireDb();
    const current=Number(db.prepare('SELECT COALESCE(version,0) AS version FROM experience_documents WHERE tenant_id=?').get(tenantId)?.version ?? 0);
    const floor=Number(db.prepare('SELECT floor FROM experience_history_floor WHERE tenant_id=?').get(tenantId)?.floor ?? 0);
    if(after<floor){
      return Object.freeze({tenantId,currentVersion:current,historyFloor:floor,resyncRequired:true,cursor:after,events:Object.freeze([])});
    }
    const rows=db.prepare('SELECT sequence,event_json FROM experience_events WHERE tenant_id=? AND sequence>? ORDER BY sequence ASC LIMIT ?')
      .all(tenantId,after,limit);
    const events=Object.freeze(rows.map(row=>Object.freeze(parseJson(row.event_json))));
    const cursor=events.length ? events.at(-1).sequence : after;
    return Object.freeze({tenantId,currentVersion:current,historyFloor:floor,resyncRequired:false,cursor,events});
  }

  async pruneEventsThrough(tenantId,sequence){
    tenantId=requiredString(tenantId,'tenantId');
    sequence=integer(sequence,'sequence');
    const db=this.#requireDb();
    const tx=db.transaction(()=>{
      const current=Number(db.prepare('SELECT COALESCE(version,0) AS version FROM experience_documents WHERE tenant_id=?').get(tenantId)?.version ?? 0);
      const nextFloor=Math.min(sequence,current);
      db.prepare('DELETE FROM experience_events WHERE tenant_id=? AND sequence<=?').run(tenantId,nextFloor);
      db.prepare(`INSERT INTO experience_history_floor(tenant_id,floor) VALUES(?,?)
        ON CONFLICT(tenant_id) DO UPDATE SET floor=MAX(floor,excluded.floor)`).run(tenantId,nextFloor);
      return Object.freeze({tenantId,historyFloor:nextFloor,currentVersion:current});
    });
    return tx();
  }
  async integrityCheck(){
    const result=this.#requireDb().pragma('quick_check',{simple:true});
    return Object.freeze({ok:result==='ok',result});
  }

  async diagnostics(){
    const db=this.#requireDb();
    return Object.freeze({
      schemaVersion:SCHEMA_VERSION,
      journalMode:String(db.pragma('journal_mode',{simple:true})),
      synchronous:Number(db.pragma('synchronous',{simple:true})),
      foreignKeys:Number(db.pragma('foreign_keys',{simple:true}))===1,
      busyTimeoutMs:Number(db.pragma('busy_timeout',{simple:true})),
      sqliteVersion:String(db.prepare('select sqlite_version() as version').get().version),
    });
  }

  async backup(destination){
    requiredString(destination,'destination');
    if(destination===':memory:') throw experienceStoreError('invalid_argument','backup destination must be a file');
    await mkdir(path.dirname(path.resolve(destination)),{recursive:true});
    await this.#requireDb().backup(destination);
    return Object.freeze({destination:path.resolve(destination)});
  }

  async close(){
    if(!this.db) return;
    this.db.close();
    this.db=null;
  }
}
