import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {JobStore} from '../src/store.js';
import {BacklogService} from '../src/backlog.js';
import {dueSchedules,dueIdeaSchedules,runDueIdeaSchedules,productionGate,type ProductionConfig} from '../src/scheduler.js';
import {createApp} from '../src/server.js';
import {PORT} from '../src/config.js';

const direct={projectId:'p',topic:'topic',contentId:'content',template:'explainer'};
const config:ProductionConfig={timezone:'America/Chicago',window:{enabled:true,start:'08:00',end:'22:00'},minimumFreeDiskBytes:2*1024**3,minimumFreeMemoryBytes:1024**3,jobConcurrency:1};

test('production control and backlog bindings survive database restart',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'video-scheduler-')),filename=path.join(dir,'factory.sqlite');try{let store=new JobStore(filename),backlog=new BacklogService(store);await backlog.seed();store.setPaused(true,'maintenance');const job=await backlog.produceScheduled('whodunnit','schedule:restart:2026-10-10');assert.ok(job);store.close();store=new JobStore(filename);backlog=new BacklogService(store);assert.equal(store.production().statusReason,'maintenance');assert.equal(backlog.get('whodunnit-clear-writing')?.jobId,job.id);assert.equal((await backlog.produceScheduled('whodunnit','schedule:restart:2026-10-10'))?.id,job.id);assert.equal(backlog.get('gigwise-recordkeeping')?.jobId,null);store.close();}finally{await rm(dir,{recursive:true,force:true});}});

test('pause and production window gate new claims while stale leases recover',async()=>{const store=new JobStore(':memory:');try{const first=store.create(direct);store.claim('old');store.db.prepare("UPDATE jobs SET lease_expires_at='2000-01-01T00:00:00.000Z'").run();store.setPaused(true,'operator hold');const paused=await productionGate(store,new Date('2026-10-10T16:00:00Z'),config);assert.equal(paused.allowed,false);assert.equal(store.claim('new',30_000,paused.allowed),undefined);assert.equal(store.get(first.id)?.status,'QUEUED');assert.equal(store.production().statusReason,'operator hold');store.setPaused(false);const outside=await productionGate(store,new Date('2026-10-10T12:00:00Z'),config);assert.deepEqual({allowed:outside.allowed,reason:outside.reason},{allowed:false,reason:'Outside production window'});}finally{store.close();}});

test('automatic failures retry twice with backoff then become terminal',()=>{const store=new JobStore(':memory:');try{const job=store.create(direct);for(let attempt=1;attempt<=3;attempt++){const claimed=store.claim('worker');assert.equal(claimed?.attempts,attempt);assert.equal(store.failAttempt(job.id,'worker','boom '+attempt),true);const current=store.get(job.id)!;if(attempt<3){assert.equal(current.status,'QUEUED');assert.ok(current.retryNotBefore);store.db.prepare("UPDATE jobs SET retry_not_before='2000-01-01T00:00:00.000Z' WHERE id=?").run(job.id);}else{assert.equal(current.status,'FAILED');assert.equal(current.retryNotBefore,null);assert.throws(()=>store.retry(job.id),/Maximum attempts/);}}const events=store.events(0,job.id);assert.equal(events.filter((event)=>event.type==='retry-scheduled').length,2);assert.equal(events.filter((event)=>event.type==='retry-exhausted').length,1);}finally{store.close();}});

test('cancellation stays terminal and blocked tax ideas cannot be approved',async()=>{const store=new JobStore(':memory:'),backlog=new BacklogService(store);try{const job=store.create(direct);assert.equal(store.requestCancel(job.id)?.status,'CANCELLED');assert.equal(store.claim('worker'),undefined);backlog.upsertDraft({id:'unsupported-tax',projectId:'gigwise',topic:'Organize your business records',targetAudience:'Independent workers',intendedMessage:'Track mileage, receipts, and business expenses.',proposedHook:'A little structure goes a long way.',requiredAssets:[],sourceReferences:[{id:'irs',url:'https://www.irs.gov/example',source:'Operator supplied reference',verified:true,type:'authoritative'}],template:'explainer',contentId:'recordkeeping',approvalRequirements:{content:true,publishing:true},taxYear:2026,taxClaims:true,syntheticDemo:false});await assert.rejects(()=>backlog.approve('unsupported-tax'),/explicitly approved tax-specific content profile/);assert.equal(backlog.get('unsupported-tax')?.status,'DRAFT');}finally{store.close();}});

test('backlog schedules keep direct schedule compatibility and stable day keys',()=>{const now=new Date('2026-10-10T16:00:00Z'),directSchedule={id:'direct',projectId:'whodunnit',topic:'Clearer writing, same meaning',contentId:'clear-writing',template:'before-after' as const,hour:9,minute:0,timezone:'America/Chicago',enabled:true},backlogSchedule={id:'ideas',projectId:'gigwise',hour:9,minute:0,timezone:'America/Chicago',enabled:true,useBacklog:true};const due=dueSchedules([directSchedule,backlogSchedule],now);assert.equal(due.length,2);assert.equal(due[0]?.idempotencyKey,'schedule:direct:2026-10-10');assert.equal(due[1]?.idempotencyKey,'schedule:ideas:2026-10-10');});

test('weekly idea slots follow the local weekday and persist one three-candidate run across restart',async()=>{
  const schedule={id:'weekly',projectId:'gigwise',frequency:'weekly',weekday:0,hour:0,minute:30,timezone:'America/Chicago',count:3,enabled:true};
  assert.deepEqual(dueIdeaSchedules([schedule],new Date('2026-10-11T04:59:00Z')),[]);assert.deepEqual(dueIdeaSchedules([schedule],new Date('2026-10-11T05:29:00Z')),[]);
  const now=new Date('2026-10-11T05:30:00Z');assert.equal(dueIdeaSchedules([schedule],now)[0]?.idempotencyKey,'idea-schedule:weekly:2026-10-11');
  assert.deepEqual(dueIdeaSchedules([{...schedule,enabled:false}],now),[]);assert.deepEqual(dueIdeaSchedules([schedule],new Date('2026-10-12T06:00:00Z')),[]);
  const dir=await mkdtemp(path.join(os.tmpdir(),'idea-schedule-')),filename=path.join(dir,'factory.sqlite');let store=new JobStore(filename);
  try{const first=(await runDueIdeaSchedules(store,[schedule],now))[0]!;assert.equal(first.count,3);assert.equal(first.status,'QUEUED');store.close();store=new JobStore(filename);assert.equal((await runDueIdeaSchedules(store,[schedule],now))[0]?.id,first.id);assert.equal(store.db.prepare('SELECT COUNT(*) count FROM idea_runs').get()?.count,1);}finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('production and backlog API mutations retain host and origin guards',async()=>{const store=new JobStore(':memory:'),backlog=new BacklogService(store);await backlog.seed();const app=createApp(store),server=app.listen(0,'127.0.0.1');await new Promise<void>((resolve)=>server.once('listening',resolve));const base='http://127.0.0.1:'+(server.address() as AddressInfo).port;const request=(route:string,origin?:string)=>new Promise<{status:number;body:any}>((resolve,reject)=>{const req=http.request(base+route,{method:'POST',headers:{host:'127.0.0.1:'+PORT,'content-type':'application/json',...origin?{origin}:{}}},(response)=>{let raw='';response.on('data',(chunk)=>raw+=chunk);response.on('end',()=>resolve({status:response.statusCode!,body:JSON.parse(raw)}));});req.on('error',reject);req.end('{}');});try{assert.equal((await request('/api/production/pause','https://evil.example')).status,403);assert.equal((await request('/api/production/pause')).status,200);assert.equal(store.production().paused,true);assert.equal((await request('/api/production/resume')).status,200);assert.equal(store.production().paused,false);assert.equal((await request('/api/backlog/missing/produce')).status,404);}finally{app.locals.closeStreams();await new Promise<void>((resolve)=>server.close(()=>resolve()));store.close();}});

test('scheduler records invalid configuration and recovers after restart without duplicating jobs',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'video-scheduler-recovery-')),filename=path.join(dir,'factory.sqlite'),scheduleFile=path.join(dir,'schedules.json'),ideaScheduleFile=path.join(dir,'idea-schedules.json'),now=new Date('2026-10-11T04:00:00Z');
  const {writeFile}=await import('node:fs/promises');const {Scheduler}=await import('../src/scheduler.js');
  let store=new JobStore(filename);
  try{
    await new BacklogService(store).seed();await writeFile(scheduleFile,'invalid JSON');await writeFile(ideaScheduleFile,'[]');
    await new Scheduler(store,scheduleFile,60_000,ideaScheduleFile,async()=>({allowed:true,reason:'Isolated fixture',config})).tick(now);assert.match(store.production().error!,/JSON/);
    store.close();store=new JobStore(filename);assert.match(store.production().error!,/JSON/);
    await writeFile(scheduleFile,JSON.stringify([{id:'recovery',projectId:'whodunnit',hour:9,minute:0,timezone:'America/Chicago',enabled:true,useBacklog:true}]));
    const scheduler=new Scheduler(store,scheduleFile,60_000,ideaScheduleFile,async()=>({allowed:true,reason:'Isolated fixture',config}));const first=await scheduler.tick(now);assert.equal(first.length,1);assert.equal(store.production().error,null);
    const second=await scheduler.tick(now);assert.equal(second[0]?.id,first[0]?.id);assert.equal(store.list().length,1);
    store.claim('crashed');store.db.prepare("UPDATE jobs SET lease_expires_at='2000-01-01T00:00:00Z'").run();store.close();store=new JobStore(filename);
    const recovered=store.claim('replacement');assert.equal(recovered?.id,first[0]?.id);assert.equal(recovered?.attempts,2);assert.equal(store.update(first[0]!.id,'FAILED',{owner:'crashed'}),false);
    assert.ok(store.events(0,first[0]!.id).some(e=>e.type==='lease-recovered'));
  }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
