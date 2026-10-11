import test from 'node:test';
import assert from 'node:assert/strict';
import {JobStore} from '../src/store.js';
import {dueSchedules} from '../src/cli.js';
const input={projectId:'p',topic:'topic',contentId:'c',template:'explainer'};
test('two workers cannot claim different jobs simultaneously',()=>{
  const store=new JobStore(':memory:');try{
    const a=store.create(input);store.create({...input,topic:'second'});assert.equal(store.claim('one')?.id,a.id);assert.equal(store.claim('two'),undefined);
    store.update(a.id,'FAILED',{owner:'one',releaseLease:true});assert.ok(store.claim('two'));
  }finally{store.close();}
});
test('stale workers cannot modify or promote a reclaimed job',()=>{
  const store=new JobStore(':memory:');try{
    const j=store.create(input);store.claim('old');store.db.prepare("UPDATE jobs SET lease_expires_at='2000-01-01T00:00:00Z'").run();store.claim('new');
    assert.equal(store.update(j.id,'FAILED',{owner:'old',releaseLease:true}),false);
    let promoted=false;assert.equal(store.finalize(j.id,'old',()=>{promoted=true;},{}),false);assert.equal(promoted,false);assert.equal(store.get(j.id)?.leaseOwner,'new');assert.ok(store.events(0,j.id).some((e)=>e.type==='lease-recovered'));
  }finally{store.close();}
});
test('idempotency conflicts reject different content',()=>{
  const store=new JobStore(':memory:');try{const one=store.create({...input,idempotencyKey:'slot'});assert.equal(store.create({...input,idempotencyKey:'slot'}).id,one.id);assert.throws(()=>store.create({...input,topic:'different',idempotencyKey:'slot'}),/Idempotency conflict/);}finally{store.close();}
});
test('cancellation of a completed review job is terminal and prevents approval',()=>{
  const store=new JobStore(':memory:');try{const j=store.create(input);store.update(j.id,'READY_FOR_REVIEW',{qaPassed:true});assert.equal(store.requestCancel(j.id)?.status,'CANCELLED');assert.throws(()=>store.review(j.id,'APPROVED'),/not ready/);}finally{store.close();}
});
test('approval rejects a ready job whose QA did not pass',()=>{
  const store=new JobStore(':memory:');try{const j=store.create(input);store.update(j.id,'READY_FOR_REVIEW',{qaPassed:false});assert.throws(()=>store.review(j.id,'APPROVED'),/passing QA/);}finally{store.close();}
});
test('daily scheduling catches missed minute and deduplicates by local date',()=>{
  const s={id:'daily',projectId:'p',topic:'topic',contentId:'c',template:'explainer',hour:9,minute:0,timezone:'America/Chicago',enabled:true};
  assert.equal(dueSchedules([s],new Date('2026-10-10T13:59:00Z')).length,0);
  const due=dueSchedules([s],new Date('2026-10-10T16:00:00Z'));assert.equal(due[0]?.idempotencyKey,'schedule:daily:2026-10-10');
  assert.equal(dueSchedules([s],new Date('2026-10-10T22:00:00Z'))[0]?.idempotencyKey,due[0]?.idempotencyKey);
  assert.throws(()=>dueSchedules([{...s,hour:99}]),/Too big/);assert.throws(()=>dueSchedules([{...s,timezone:'fake'}]),/Invalid timezone/);
});
test('state and event rollback together on failure',()=>{
  const store=new JobStore(':memory:');try{const j=store.create(input);store.db.exec("CREATE TRIGGER reject_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'failure'); END");assert.throws(()=>store.update(j.id,'FAILED'),/failure/);assert.equal(store.get(j.id)?.status,'QUEUED');}finally{store.close();}
});
