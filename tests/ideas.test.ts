import test from 'node:test';
import assert from 'node:assert/strict';
import {JobStore} from '../src/store.js';
import {IdeaService,resolveIdeaEvidence,validateIdeaCandidate,type IdeaCandidate} from '../src/ideas.js';
import {KnowledgeRegistry,loadKnowledge} from '../src/knowledge.js';

const whod:IdeaCandidate={projectId:'whodunnit',topic:'Clearer writing, same meaning',audience:'People who want clearer writing without losing their voice',hook:'Make room for your voice.',intendedMessage:'Less clutter. The same idea.',sourceClaimIds:['wh-topic','wh-audience','wh-hook','wh-body','wh-before','wh-after','wh-cta','wh-template-0'],requiredAssets:[],template:'before-after',durationSeconds:20,cta:'Find your voice with Whodunnit.',risk:'SYNTHETIC_DEMO'};
const gigwise:IdeaCandidate={projectId:'gigwise',topic:'Organize your business records',audience:'Independent workers organizing business records',hook:'A little structure goes a long way.',intendedMessage:'Track mileage, receipts, and business expenses.',sourceClaimIds:['gw-topic','gw-audience','gw-hook','gw-body','gw-cta','gw-template-0'],requiredAssets:[],template:'explainer',durationSeconds:24,cta:'Keep your records with GigWise.',risk:'LOW'};

test('deterministic validation accepts exact evidence and rejects unsupported copy, risk, assets, and duplicates',async()=>{const knowledge=await loadKnowledge('whodunnit');assert.deepEqual((await validateIdeaCandidate(whod,knowledge)).reasons,[]);assert.ok((await validateIdeaCandidate({...whod,hook:'Invented feature'},knowledge)).reasons.some(v=>v.includes('Hook lacks')));assert.ok((await validateIdeaCandidate({...whod,risk:'LOW'},knowledge)).reasons.some(v=>v.includes('SYNTHETIC_DEMO')));assert.ok((await validateIdeaCandidate({...whod,requiredAssets:['unknown']},knowledge)).reasons.some(v=>v.includes('asset')));assert.ok((await validateIdeaCandidate({...whod,sourceClaimIds:whod.sourceClaimIds.filter(id=>id!=='wh-after')},knowledge)).reasons.some(v=>v.includes('original approved pair')));assert.ok((await validateIdeaCandidate(whod,knowledge,undefined,{priorCandidates:[whod]})).reasons.some(v=>v.includes('Duplicate')));});

test('resolved evidence supports exact copy and the original pair without legitimizing invented claims or assets',async()=>{
  const knowledge=await loadKnowledge('whodunnit'),raw={...whod,sourceClaimIds:['wh-topic']},resolved=resolveIdeaEvidence(raw,knowledge);
  assert.deepEqual(raw.sourceClaimIds,['wh-topic']);assert.deepEqual((await validateIdeaCandidate(resolved,knowledge)).reasons,[]);
  for(const id of ['wh-cta','wh-template-0','wh-before','wh-after'])assert.ok(resolved.sourceClaimIds.includes(id));
  const invalid=resolveIdeaEvidence({...raw,hook:'Invented feature',requiredAssets:['wh-brand-asset'],sourceClaimIds:['unknown']},knowledge),checked=await validateIdeaCandidate(invalid,knowledge);
  assert.ok(checked.reasons.some(reason=>reason.includes('unknown')));assert.ok(checked.reasons.some(reason=>reason.includes('Hook lacks')));assert.ok(checked.reasons.some(reason=>reason.includes('asset')));
});

test('generation restricts media assets and templates, ranks only validated IDs, and retains failed ranking provenance',async()=>{
  const store=new JobStore(':memory:');let calls=0;
  const service=new IdeaService(store,undefined,async(prompt,schema)=>{
    calls++;
    if(calls===1){const value={candidates:[gigwise,gigwise,gigwise]};assert.equal(schema.safeParse(value).success,true);assert.equal(schema.safeParse({candidates:value.candidates.map(candidate=>({...candidate,requiredAssets:['gw-brand-asset']}))}).success,false);assert.equal(schema.safeParse({candidates:value.candidates.map(candidate=>({...candidate,template:'feature-demo'}))}).success,false);return {value:{candidates:value.candidates.map(candidate=>({...candidate,sourceClaimIds:['gw-topic']}))},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt,raw:{response:'raw candidate output'},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}} as any;}
    const candidates=JSON.parse(prompt.split('CANDIDATES=')[1]!);assert.equal(candidates.length,1);assert.equal(schema.safeParse({rankings:[{id:candidates[0].id,score:4,criterion:'SOURCE_COVERAGE'}]}).success,true);assert.equal(schema.safeParse({rankings:[]}).success,false);
    return {value:{rankings:[]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt,raw:{response:'{"rankings":[]}'},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}} as any;
  },async()=>true);
  try{const run=await service.enqueue('gigwise','schema-proof');await service.tick();assert.equal(calls,2);assert.equal(service.getRun(run.id)?.status,'COMPLETE');const ideas=service.list();assert.equal(ideas.filter(idea=>idea.status==='AWAITING_IDEA_APPROVAL').length,1);assert.match(service.getRun(run.id)!.error!,/cover every/);const {readFile}=await import('node:fs/promises'),{DATA_DIR}=await import('../src/config.js'),path=await import('node:path');const provenance=JSON.parse(await readFile(path.join(DATA_DIR,'idea-runs',run.id+'.json'),'utf8'));assert.equal(provenance.ranking.raw.response,'{"rankings":[]}');assert.equal(provenance.generation.raw.response,'raw candidate output');}finally{await service.stop();store.close();}
});

test('ranking unload failure fails the run without persisting partially validated candidates',async()=>{
  const store=new JobStore(':memory:');let calls=0;
  const service=new IdeaService(store,undefined,async()=>{calls++;if(calls===2)throw Object.assign(new Error('Qwen unload failed after ranking'),{attempt:{unload:{ok:false}},raw:{response:'ranking'}});return {value:{candidates:[gigwise,gigwise,gigwise]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt:'fixture',raw:{done:true},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}} as any;},async()=>true);
  try{const run=await service.enqueue('gigwise','ranking-cleanup');await service.tick();assert.equal(calls,2);assert.equal(service.getRun(run.id)?.status,'QUEUED');assert.match(service.getRun(run.id)!.error!,/unload failed/);assert.equal(service.list().length,0);}finally{await service.stop();store.close();}
});

test('complete knowledge without copy that fits the field limits fails before model inference',async()=>{
  const store=new JobStore(':memory:'),knowledge=new KnowledgeRegistry(),snapshot=await loadKnowledge('gigwise');let calls=0;
  snapshot.claims=snapshot.claims.map(claim=>['marketing','demo','capability'].includes(claim.kind)?{...claim,text:'x'.repeat(241)}:claim);knowledge.load=async()=>snapshot;
  const service=new IdeaService(store,knowledge,async()=>{calls++;throw new Error('Unexpected inference');},async()=>true);
  try{const run=await service.enqueue('gigwise','oversized-copy');await service.tick();assert.equal(calls,0);assert.match(service.getRun(run.id)!.error!,/no usable hook values/);assert.equal(service.list().length,0);}finally{await service.stop();store.close();}
});

test('idea runs block incomplete projects, deduplicate keys, persist all raw candidates, and require approval',async()=>{const store=new JobStore(':memory:');let calls=0;const generate=async()=>{calls++;return (calls===1?{value:{candidates:[gigwise,gigwise,{...gigwise,hook:'Unsupported wording'}]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt:'fixture',raw:{done:true},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}}:{value:{rankings:[]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt:'rank',raw:{done:true},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}}) as any;};const service=new IdeaService(store,undefined,generate,async()=>true);try{const blocked=await service.enqueue('angband','blocked');assert.equal(blocked.status,'BLOCKED');const run=await service.enqueue('gigwise','weekly');assert.equal((await service.enqueue('gigwise','weekly')).id,run.id);await service.tick();assert.equal(service.getRun(run.id)?.status,'COMPLETE');const ideas=service.list('gigwise');assert.equal(ideas.length,3);assert.equal(ideas.filter(v=>v.status==='AWAITING_IDEA_APPROVAL').length,1);assert.equal(ideas.filter(v=>v.status==='REJECTED').length,2);const approved=await service.approve(ideas.find(v=>v.status==='AWAITING_IDEA_APPROVAL')!.id);assert.equal(approved?.status,'APPROVED');assert.ok(approved?.backlogId);}finally{await service.stop();store.close();}});

test('queued production takes priority over idea model operations and operation lease fences job claims',async()=>{const store=new JobStore(':memory:');let calls=0;const generate=async()=>{calls++;return {value:{candidates:[gigwise,gigwise,gigwise]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt:'fixture',raw:{done:true},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}} as any;},service=new IdeaService(store,undefined,generate,async()=>true);try{await service.enqueue('gigwise','priority');const job=store.create({projectId:'gigwise',topic:'Organize your business records',contentId:'recordkeeping',template:'explainer'});await service.tick();assert.equal(calls,0);assert.equal(service.getRun(service.runs()[0]!.id)?.status,'QUEUED');store.requestCancel(job.id);assert.equal(store.acquireOperation('fixture','test','op'),true);assert.equal(store.claim('video'),undefined);assert.equal(store.releaseOperation('fixture','op'),true);}finally{await service.stop();store.close();}});

test('claim IDs, available templates, and historical hook bodies are validated',async()=>{
  const knowledge=await loadKnowledge('gigwise'),store=new JobStore(':memory:');new IdeaService(store);
  try{
    assert.ok((await validateIdeaCandidate({...gigwise,sourceClaimIds:[...gigwise.sourceClaimIds,'unknown']},knowledge)).reasons.some(v=>v.includes('unknown')));
    assert.ok((await validateIdeaCandidate({...gigwise,sourceClaimIds:[...gigwise.sourceClaimIds,'gw-body']},knowledge)).reasons.some(v=>v.includes('unique')));
    assert.ok((await validateIdeaCandidate({...gigwise,template:'gameplay'},knowledge)).reasons.some(v=>v.includes('matching asset')));
    assert.ok((await validateIdeaCandidate(gigwise,knowledge,store,{priorCandidates:[{...gigwise,topic:'Other topic',hook:gigwise.hook}]})).reasons.some(v=>v.includes('Duplicate')));
  }finally{store.close();}
});

test('bounded idea failure retries persist no partial candidates and exhaust safely',async()=>{
  const store=new JobStore(':memory:');let calls=0;const service=new IdeaService(store,undefined,async()=>{calls++;throw new Error('simulated unavailable model');},async()=>true);
  try{
    const run=await service.enqueue('gigwise','bounded-failure');
    for(let attempt=1;attempt<=3;attempt++){
      await service.tick();const current=service.getRun(run.id)!;assert.equal(current.attempts,attempt);assert.equal(service.list().length,0);
      if(attempt<3){assert.equal(current.status,'QUEUED');assert.ok(current.retryNotBefore);store.db.prepare("UPDATE idea_runs SET retry_not_before='2000-01-01T00:00:00Z' WHERE id=?").run(run.id);}else assert.equal(current.status,'FAILED');
    }
    await service.tick();assert.equal(calls,3);assert.match(service.getRun(run.id)!.error!,/simulated/);
  }finally{await service.stop();store.close();}
});

test('approval binding cannot be forged by imported provenance or edited fields',async()=>{
  const store=new JobStore(':memory:');let calls=0;
  const service=new IdeaService(store,undefined,async()=>{calls++;return {value:calls===1?{candidates:[gigwise,gigwise,gigwise]}:{rankings:[]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt:'fixture',raw:{done:true},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}} as any;},async()=>true);
  const {BacklogService}=await import('../src/backlog.js');const backlog=new BacklogService(store);
  try{
    await service.enqueue('gigwise','binding');await service.tick();const idea=service.list().find(v=>v.status==='AWAITING_IDEA_APPROVAL')!;
    const approved=await service.approve(idea.id),entry=backlog.get(approved!.backlogId!)!;assert.equal((await backlog.validateForProduction(entry)).content.id,'proposal:'+idea.id);
    await assert.rejects(()=>backlog.validateForProduction({...entry,id:'forged-copy'}),/not explicitly approved/);
    await assert.rejects(()=>backlog.validateForProduction({...entry,targetAudience:'unsupported audience'}),/does not match/);
    const job=await backlog.produce(entry.id);assert.equal(job?.status,'QUEUED');assert.equal(job?.qaPassed,null);assert.throws(()=>store.review(job!.id,'APPROVED'),/not ready/);
  }finally{await service.stop();store.close();}
});

test('idea lease recovery survives restart, retains slot identity, and produces one candidate set',async()=>{
  const {mkdtemp,rm}=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');const dir=await mkdtemp(path.join(os.tmpdir(),'idea-recovery-')),filename=path.join(dir,'factory.sqlite');let store=new JobStore(filename),service=new IdeaService(store);
  try{
    const run=await service.enqueue('gigwise','restart-slot');
    store.db.prepare("UPDATE idea_runs SET status='GENERATING',attempts=1,lease_owner='crashed',lease_expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(run.id);store.acquireOperation('crashed','idea-run',run.id);store.db.exec("UPDATE operation_lease SET expires_at='2000-01-01T00:00:00Z'");store.close();
    store=new JobStore(filename);let calls=0;service=new IdeaService(store,undefined,async()=>{calls++;return {value:calls===1?{candidates:[gigwise,gigwise,gigwise]}:{rankings:[]},attempt:{provider:'fixture',startedAt:'x',finishedAt:'x',request:{}},prompt:'fixture',raw:{done:true},model:{name:'fixture'},metrics:{evalCount:1,promptEvalCount:1,totalDurationNs:1}} as any;},async()=>true);
    await service.tick();assert.equal(service.getRun(run.id)?.status,'QUEUED');assert.ok(service.getRun(run.id)?.retryNotBefore);assert.equal((await service.enqueue('gigwise','restart-slot')).id,run.id);assert.equal(store.heartbeatOperation('crashed',run.id),false);
    store.db.prepare("UPDATE idea_runs SET retry_not_before='2000-01-01T00:00:00Z' WHERE id=?").run(run.id);await service.tick();await service.tick();assert.equal(service.getRun(run.id)?.attempts,2);assert.equal(service.getRun(run.id)?.status,'COMPLETE');assert.equal(service.list().length,3);await assert.rejects(()=>service.enqueue('whodunnit','restart-slot'),/idempotency conflict/);
  }finally{await service.stop();store.close();await rm(dir,{recursive:true,force:true});}
});
