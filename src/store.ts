import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
export const JOB_STATUSES=['QUEUED','SCRIPTING','REFINING','RENDERING','VALIDATING','READY_FOR_REVIEW','APPROVED','REJECTED','FAILED','CANCELLED'] as const;
export type JobStatus=typeof JOB_STATUSES[number];
export type JobRow={id:string;projectId:string;topic:string;contentId:string;template:string;idempotencyKey:string|null;status:JobStatus;attempts:number;maxAttempts:number;error:string|null;warning:string|null;artifactDir:string|null;qaPassed:number|null;cancelRequested:number;leaseOwner:string|null;leaseExpiresAt:string|null;createdAt:string;updatedAt:string};
type Fields={error?:string|null;warning?:string|null;artifactDir?:string;qaPassed?:boolean;releaseLease?:boolean;owner?:string};
export class JobStore{
  readonly db:DatabaseSync;
  constructor(readonly filename:string){
    if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
    this.db.exec('CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,topic TEXT NOT NULL,content_id TEXT NOT NULL,template TEXT NOT NULL,idempotency_key TEXT UNIQUE,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,max_attempts INTEGER NOT NULL DEFAULT 3,error TEXT,warning TEXT,artifact_dir TEXT,qa_passed INTEGER,cancel_requested INTEGER NOT NULL DEFAULT 0,lease_owner TEXT,lease_expires_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS jobs_queue_idx ON jobs(status,created_at);CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,type TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);CREATE INDEX IF NOT EXISTS events_job_idx ON events(job_id,id);');
  }
  close(){this.db.close();}
  transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const value=fn();this.db.exec('COMMIT');return value;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  private map(r:Record<string,unknown>):JobRow{return {id:r.id as string,projectId:r.project_id as string,topic:r.topic as string,contentId:r.content_id as string,template:r.template as string,idempotencyKey:r.idempotency_key as string|null,status:r.status as JobStatus,attempts:r.attempts as number,maxAttempts:r.max_attempts as number,error:r.error as string|null,warning:r.warning as string|null,artifactDir:r.artifact_dir as string|null,qaPassed:r.qa_passed as number|null,cancelRequested:r.cancel_requested as number,leaseOwner:r.lease_owner as string|null,leaseExpiresAt:r.lease_expires_at as string|null,createdAt:r.created_at as string,updatedAt:r.updated_at as string};}
  private same(existing:JobRow,input:{projectId:string;topic:string;contentId:string;template:string}){if(['projectId','topic','contentId','template'].some((k)=>existing[k as keyof typeof input]!==input[k as keyof typeof input]))throw new Error('Idempotency conflict: key is already bound to a different request');return existing;}
  create(input:{projectId:string;topic:string;contentId:string;template:string;idempotencyKey?:string}):JobRow{
    return this.transaction(()=>{if(input.idempotencyKey){const r=this.db.prepare('SELECT * FROM jobs WHERE idempotency_key=?').get(input.idempotencyKey) as Record<string,unknown>|undefined;if(r)return this.same(this.map(r),input);}
      const id=randomUUID(),now=new Date().toISOString();
      this.db.prepare("INSERT INTO jobs(id,project_id,topic,content_id,template,idempotency_key,status,created_at,updated_at)VALUES(?,?,?,?,?,?,'QUEUED',?,?)").run(id,input.projectId,input.topic,input.contentId,input.template,input.idempotencyKey??null,now,now);
      this.event(id,'created',{status:'QUEUED'});return this.get(id)!;});
  }
  get(id:string){const r=this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id) as Record<string,unknown>|undefined;return r?this.map(r):undefined;}
  list(limit=100){if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('Job limit must be an integer from 1 to 500');return (this.db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string,unknown>[]).map((r)=>this.map(r));}
  events(after=0,jobId?:string){if(!Number.isSafeInteger(after)||after<0)throw new Error('Event cursor must be a nonnegative integer');const rows=jobId?this.db.prepare('SELECT * FROM events WHERE id>? AND job_id=? ORDER BY id LIMIT 500').all(after,jobId):this.db.prepare('SELECT * FROM events WHERE id>? ORDER BY id LIMIT 500').all(after);return (rows as Record<string,unknown>[]).map((r)=>({id:r.id,jobId:r.job_id,type:r.type,data:JSON.parse(r.data as string),createdAt:r.created_at}));}
  event(id:string,type:string,data:unknown){this.db.prepare('INSERT INTO events(job_id,type,data,created_at)VALUES(?,?,?,?)').run(id,type,JSON.stringify(data),new Date().toISOString());}
  owns(id:string,owner:string){const j=this.get(id);return Boolean(j&&j.leaseOwner===owner&&j.leaseExpiresAt&&j.leaseExpiresAt>new Date().toISOString()&&['SCRIPTING','REFINING','RENDERING','VALIDATING'].includes(j.status));}
  private writeStatus(id:string,status:JobStatus,fields:Fields={}){
    const assignments=['status=?','updated_at=?'];const values:Array<string|number|null>=[status,new Date().toISOString()];
    for(const [key,column] of [['error','error'],['warning','warning'],['artifactDir','artifact_dir'],['qaPassed','qa_passed']] as const){
      if(fields[key]!==undefined){assignments.push(column+'=?');const v=fields[key];values.push(typeof v==='boolean'?Number(v):v??null);}
    }
    if(fields.releaseLease)assignments.push('lease_owner=NULL','lease_expires_at=NULL');
    values.push(id);this.db.prepare('UPDATE jobs SET '+assignments.join(',')+' WHERE id=?').run(...values);
    const {owner,...eventFields}=fields;this.event(id,'status',{status,...eventFields});
  }
  update(id:string,status:JobStatus,fields:Fields={}):boolean{return this.transaction(()=>{if(!this.get(id)||fields.owner&&!this.owns(id,fields.owner))return false;this.writeStatus(id,status,fields);return true;});}
  finalize(id:string,owner:string,promote:()=>void,fields:Fields):boolean{return this.transaction(()=>{if(!this.owns(id,owner)||this.get(id)?.cancelRequested)return false;promote();this.writeStatus(id,'READY_FOR_REVIEW',{...fields,qaPassed:true,releaseLease:true});return true;});}
  claim(owner:string,leaseMs=30_000):JobRow|undefined{return this.transaction(()=>{
    const now=new Date().toISOString();const stale=this.db.prepare("SELECT * FROM jobs WHERE status IN ('SCRIPTING','REFINING','RENDERING','VALIDATING') AND lease_expires_at<=?").all(now) as Record<string,unknown>[];
    for(const r of stale){const j=this.map(r);const status=j.cancelRequested?'CANCELLED':j.attempts>=j.maxAttempts?'FAILED':'QUEUED';this.writeStatus(j.id,status,{releaseLease:true,error:status==='FAILED'?'Worker lease expired at maximum attempts':j.error});this.event(j.id,'lease-recovered',{previousOwner:j.leaseOwner,status});}
    const active=this.db.prepare("SELECT id FROM jobs WHERE status IN ('SCRIPTING','REFINING','RENDERING','VALIDATING') AND lease_expires_at>? LIMIT 1").get(now);
    if(active)return undefined;
    const r=this.db.prepare("SELECT * FROM jobs WHERE status='QUEUED' AND attempts<max_attempts AND cancel_requested=0 ORDER BY created_at,rowid LIMIT 1").get() as Record<string,unknown>|undefined;if(!r)return undefined;
    const expiry=new Date(Date.now()+leaseMs).toISOString();this.db.prepare("UPDATE jobs SET status='SCRIPTING',attempts=attempts+1,lease_owner=?,lease_expires_at=?,updated_at=? WHERE id=?").run(owner,expiry,now,r.id as string);
    this.event(r.id as string,'claimed',{owner,status:'SCRIPTING'});return this.get(r.id as string);
  });}
  heartbeat(id:string,owner:string,leaseMs=30_000){if(!this.owns(id,owner))return false;const now=new Date().toISOString();return this.db.prepare('UPDATE jobs SET lease_expires_at=?,updated_at=? WHERE id=? AND lease_owner=? AND lease_expires_at>?').run(new Date(Date.now()+leaseMs).toISOString(),now,id,owner,now).changes===1;}
  requestCancel(id:string){return this.transaction(()=>{const j=this.get(id);if(!j)return undefined;if(['APPROVED','REJECTED','CANCELLED'].includes(j.status))throw new Error('Cannot cancel '+j.status+' job');this.db.prepare('UPDATE jobs SET cancel_requested=1,updated_at=? WHERE id=?').run(new Date().toISOString(),id);if(['QUEUED','FAILED','READY_FOR_REVIEW'].includes(j.status))this.writeStatus(id,'CANCELLED',{releaseLease:true});this.event(id,'cancel-requested',{});return this.get(id);});}
  retry(id:string){return this.transaction(()=>{const j=this.get(id);if(!j)return undefined;if(j.status!=='FAILED')throw new Error('Only failed jobs can be retried');if(j.attempts>=j.maxAttempts)throw new Error('Maximum attempts reached');this.db.prepare('UPDATE jobs SET cancel_requested=0,qa_passed=NULL WHERE id=?').run(id);this.writeStatus(id,'QUEUED',{error:null,warning:null,releaseLease:true});this.event(id,'retried',{attempt:j.attempts+1});return this.get(id);});}
  review(id:string,action:'APPROVED'|'REJECTED',note?:string){return this.transaction(()=>{const j=this.get(id);if(!j)return undefined;if(j.status!=='READY_FOR_REVIEW')throw new Error('Job is not ready for review');if(action==='APPROVED'&&j.qaPassed!==1)throw new Error('Job cannot be approved without passing QA');if(note!==undefined&&(typeof note!=='string'||note.length>2000))throw new Error('Invalid review note');this.writeStatus(id,action,{releaseLease:true});this.event(id,'operator-review',{action,note:note??null});return this.get(id);});}
}
