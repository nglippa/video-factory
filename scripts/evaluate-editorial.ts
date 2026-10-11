/** Bounded, isolated editorial evaluation. Default is read-only analysis; --execute obeys live priority/lease gates. */
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {DB_PATH,DATA_DIR,loadProfile} from '../src/config.js';
import {JobStore} from '../src/store.js';
import {CampaignService,type CampaignSlot} from '../src/campaigns.js';
import {CommandCenter} from '../src/command-center.js';
import {productionGate,loadProductionConfig} from '../src/scheduler.js';
import {KnowledgeRegistry,assertKnowledgeStillApproved} from '../src/knowledge.js';
import {stableHash} from '../src/domain.js';
const execute=process.argv.includes('--execute'),started=new Date().toISOString(),temporary=await mkdtemp(path.join(os.tmpdir(),'editorial-eval-')),snapshot=path.join(temporary,'factory.sqlite');
const backup=spawnSync('python3',['-c','import sqlite3,sys; a=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True); b=sqlite3.connect(sys.argv[2]); a.backup(b); b.close(); a.close()',DB_PATH,snapshot],{encoding:'utf8'});if(backup.status!==0)throw new Error(backup.stderr);
const source=new DatabaseSync(DB_PATH,{readOnly:true}),store=new JobStore(snapshot),center=new CommandCenter(),folder=path.join(DATA_DIR,'editorial-convergence',started.replace(/[:.]/g,'-'));await mkdir(folder,{recursive:true});
const service=new CampaignService(store,center,path.join(folder,'evaluations')),overview=service.overview();
await writeFile(path.join(folder,'comparison.json'),JSON.stringify(overview,null,2)+'\n',{flag:'wx'});
const results:any[]=[];
try{
 for(const project of ['whodunnit-03','gigwise-01']){
  const id='2026-10-12-primary-projects-'+project,original=service.slot(id)!;if(!original.proposal)continue;
  const record:any={id,originalProposalHash:stableHash(original.proposal),mode:execute?'real-inference':'historical-analysis',newInferenceReceipts:[],deferral:null};results.push(record);
  const liveStatus=await center.status(),active=source.prepare("SELECT count(*) n FROM campaign_slots WHERE status IN ('PENDING','GENERATING')").get() as {n:number};
  const demand=source.prepare("SELECT count(*) n FROM jobs WHERE (status IN ('SCRIPTING','REFINING','RENDERING','VALIDATING') AND lease_expires_at>?) OR (status='QUEUED' AND attempts<max_attempts AND cancel_requested=0 AND (retry_not_before IS NULL OR retry_not_before<=?))").get(new Date().toISOString(),new Date().toISOString()) as {n:number};
  const cfg=await loadProductionConfig(),gate=await productionGate(store,new Date(),{...cfg,window:{...cfg.window,enabled:false}});
  record.preflight={activeCampaignSlots:active.n,productionDemand:demand.n,resourceAllowed:gate.allowed,resourceReason:gate.reason,workerActive:liveStatus.workerActive,activeSession:liveStatus.activeSession,queue:liveStatus.queue};
  if(active.n||demand.n||!gate.allowed||!liveStatus.workerActive||liveStatus.resource.blocker||liveStatus.queue.running||liveStatus.activeSession&&liveStatus.activeSession.state!=='STOPPED'){record.deferral='Existing campaign, production priority or resource gate prevents evaluation; no inference submitted.';continue;}
  if(original.snapshot){const current=await new KnowledgeRegistry().load(original.projectId);try{assertKnowledgeStillApproved(original.snapshot,current);}catch(error){record.deferral='Source approval changed: '+String(error);continue;}}
  if(!execute){record.deferral='Historical analysis only. Use --execute when existing production gates permit.';continue;}
  // Work only on the SQLite backup. All model work uses the existing durable Command Center bridge.
  let slot:CampaignSlot={...original,stage:1,status:'GENERATING',job:null,versions:[],editorialDecisions:[],previousValidCandidate:undefined,creativeRecovery:undefined};
  slot.versions=[{stage:0,attempt:0,jobId:'evaluation-original',artifact:'original.json',result:original.versions.find(v=>v.stage===0)!.result,value:original.proposal,parseError:null}];
  for(let step=0;step<5&&slot.status==='GENERATING';step++){
   const now=new Date().toISOString(),pending=source.prepare("SELECT count(*) n FROM campaign_slots WHERE status IN ('PENDING','GENERATING')").get() as {n:number},priority=source.prepare("SELECT count(*) n FROM jobs WHERE status='QUEUED' AND attempts<max_attempts AND cancel_requested=0 AND (retry_not_before IS NULL OR retry_not_before<=?)").get(now) as {n:number};
   const resource=await center.status();if(pending.n||priority.n||resource.resource.blocker||resource.queue.running||resource.activeSession&&resource.activeSession.state!=='STOPPED'){record.deferral='Priority changed between stages; evaluation paused without cancelling other work.';break;}
   const job=(service as any).jobFor(slot,await loadProfile(slot.projectId));job.jobId='editorial-convergence-'+project+'-'+Date.now()+'-'+step;
   store.db.prepare('UPDATE campaign_slots SET data=?,status=? WHERE id=?').run(JSON.stringify({...slot,job}),slot.status,slot.id);
   const result=await center.execute(job);record.newInferenceReceipts.push({jobId:job.jobId,stage:slot.stage,lifecycle:result.lifecycle});
   const evaluationService=new CampaignService(store,{...center,submit:async()=>result,get:jobId=>center.get(jobId),status:()=>center.status(),cancel:jobId=>center.cancel(jobId)},path.join(folder,'evaluations'));
   await (evaluationService as any).consume(evaluationService.slot(slot.id));slot=evaluationService.slot(slot.id)!;
  }
  record.finalStatus=slot.status;record.editorialDecisions=slot.editorialDecisions;record.validation=slot.validation;
 }
 await writeFile(path.join(folder,'evaluation.json'),JSON.stringify({started,finished:new Date().toISOString(),execute,results},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({folder,newInferenceReceipts:results.reduce((n,r)=>n+r.newInferenceReceipts.length,0),results:results.map(({id,deferral,finalStatus})=>({id,deferral,finalStatus}))},null,2));
}finally{store.close();source.close();}
