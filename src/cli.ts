import {readFile,rename,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {CONFIG_DIR,DATA_DIR,DB_PATH,HOST,PORT,loadProfile,loadProfiles} from './config.js';
import {templateSchema,type Template} from './domain.js';
import {checkOllama,discoverBonsai} from './models.js';
import {Pipeline} from './pipeline.js';
import {JobStore,type JobRow} from './store.js';
import {BacklogService} from './backlog.js';
import {dueSchedules,productionGate,runDueSchedules,scheduleSchema} from './scheduler.js';
import {IdeaService} from './ideas.js';
import {campaignId} from './campaign-domain.js';
import {KnowledgeRegistry,knowledgeRegistrySchema,knowledgeSourceSchema} from './knowledge.js';
export {dueSchedules,scheduleSchema} from './scheduler.js';
const api='http://'+HOST+':'+PORT;
class ApiResponseError extends Error{constructor(readonly status:number,message:string){super(message);}}
function args(argv:string[]){const result:Record<string,string|boolean>={};for(let i=0;i<argv.length;i++){const value=argv[i]!;if(value.startsWith('--')){const next=argv[i+1];if(next&&!next.startsWith('--')){result[value.slice(2)]=next;i++;}else result[value.slice(2)]=true;}}return result;}
function required(value:string|boolean|undefined,name:string){if(typeof value!=='string'||!value.trim())throw new Error('Missing --'+name);return value;}
async function apiRequest(method:string,pathname:string,body?:unknown){const response=await fetch(api+pathname,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8_000)});const data=await response.json();if(!response.ok)throw new ApiResponseError(response.status,data.error??'API request failed');return data;}
function unavailable(error:unknown){return error instanceof TypeError||error instanceof DOMException;}
async function validatedInput(options:Record<string,string|boolean>){const projectId=required(options.project,'project'),topic=required(options.topic,'topic'),contentId=required(options.content,'content');if(topic.length>300)throw new Error('Topic exceeds 300 characters');const profile=await loadProfile(projectId);if(!profile.approvedContent.some((c)=>c.id===contentId))throw new Error('Content is not approved');const template=templateSchema.parse(typeof options.template==='string'?options.template:profile.templates[0]);if(!profile.templates.includes(template))throw new Error('Template is not enabled');return {projectId,topic,contentId,template};}
type JobInput={projectId:string;topic:string;contentId:string;template:Template;idempotencyKey?:string};
async function enqueue(input:JobInput):Promise<JobRow>{try{return await apiRequest('POST','/api/jobs',input);}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);try{return store.create(input);}finally{store.close();}}}
function validateKnowledgeConfig(value:unknown){const config=knowledgeRegistrySchema.parse(value),unique=(values:string[],label:string)=>{if(new Set(values).size!==values.length)throw new Error(label+' must be unique');};unique(config.sources.map(source=>source.id),'Knowledge source IDs');unique(config.projects.map(project=>project.id),'Knowledge project IDs');unique(config.sources.flatMap(source=>source.selectors.map(selector=>selector.claimId)),'Knowledge claim IDs');const projectIds=new Set(config.projects.map(project=>project.id));if(config.sources.some(source=>source.selectors.some(selector=>!projectIds.has(selector.projectId))))throw new Error('Knowledge selector references unknown project');return config;}
async function registerKnowledgeSource(value:unknown){const registry=new KnowledgeRegistry(),source=await registry.registerSource(value),filename=path.join(CONFIG_DIR,'knowledge.json'),current=validateKnowledgeConfig(JSON.parse(await readFile(filename,'utf8'))),next=validateKnowledgeConfig({...current,sources:[...current.sources.filter(entry=>entry.id!==source.id),source]}),temp=filename+'.tmp-'+process.pid+'-'+Date.now();await writeFile(temp,JSON.stringify(next,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,filename);return source;}
function offlineIdeaRun(service:IdeaService,id:string){const run=service.getRun(z.uuid().parse(id));if(!run)throw new Error('Idea run not found');const events=(service.store.db.prepare('SELECT id,type,data,created_at FROM idea_events WHERE run_id=? ORDER BY id').all(run.id) as Array<{id:number;type:string;data:string;created_at:string}>).map(event=>({...event,data:JSON.parse(event.data),createdAt:event.created_at}));return readFile(path.join(DATA_DIR,'idea-runs',run.id+'.json'),'utf8').then(raw=>({...run,candidates:service.list(run.projectId).filter(idea=>idea.runId===run.id),events,provenance:JSON.parse(raw)}),()=>({...run,candidates:service.list(run.projectId).filter(idea=>idea.runId===run.id),events,provenance:null}));}
export async function main(argv=process.argv.slice(2)){
  const command=argv[0],options=args(argv.slice(1));
  if(command==='campaign'){
    const action=argv[1]??'status';if(!['init','status','start','pause','resume','refresh-sources','retry-pilot','export'].includes(action))throw new Error('Usage: campaign init|status|start|pause|resume|refresh-sources|retry-pilot|export');
    const result=action==='init'?await apiRequest('POST','/api/campaigns',{id:campaignId}):await apiRequest(action==='status'?'GET':'POST','/api/campaigns/'+campaignId+(action==='status'?'':'/'+action),action==='status'?undefined:{});
    if(action==='status'){const {slots,...summary}=result;console.log(JSON.stringify(summary,null,2));}else console.log(JSON.stringify(result,null,2));return;
  }
  if(command==='doctor'){
    const versions:Record<string,unknown>={node:process.version,profiles:(await loadProfiles()).map((p)=>({id:p.id,enabled:p.enabled})),tools:{}};
    for(const tool of ['ffmpeg','ffprobe','ollama']){const result=spawnSync(tool,tool==='ollama'?['--version']:['-version'],{encoding:'utf8'});(versions.tools as Record<string,unknown>)[tool]={available:result.status===0,version:result.stdout?.split('\n')[0]??null};}
    try{const q=await checkOllama();versions.ollama={available:true,models:q.modelDetails,selected:q.selected,loaded:q.loaded};}catch(e){versions.ollama={available:false,error:e instanceof Error?e.message:String(e)};}
    const bonsai=await discoverBonsai();versions.bonsai={available:Boolean(bonsai.base),endpoint:bonsai.base?.href??null,reason:bonsai.reason};console.log(JSON.stringify(versions,null,2));return;
  }
  if(command==='jobs'){try{console.log(JSON.stringify(await apiRequest('GET','/api/jobs'),null,2));}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);try{console.log(JSON.stringify(store.list(),null,2));}finally{store.close();}}return;}
  if(command==='production'){
    const action=argv[1]??'status',route=action==='status'?'/api/production':'/api/production/'+action;if(!['status','pause','resume'].includes(action))throw new Error('Usage: production status|pause|resume');
    try{console.log(JSON.stringify(await apiRequest(action==='status'?'GET':'POST',route,action==='status'?undefined:{}),null,2));}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);try{let result:unknown;if(action==='pause')result=store.setPaused(true);else if(action==='resume')result=store.setPaused(false,'Resumed by operator');else{const gate=await productionGate(store);result={...store.production(),window:gate.config.window,timezone:gate.config.timezone,minimumFreeDiskBytes:gate.config.minimumFreeDiskBytes,minimumFreeMemoryBytes:gate.config.minimumFreeMemoryBytes,jobConcurrency:gate.config.jobConcurrency,canStartJob:gate.allowed,gateReason:gate.reason};}console.log(JSON.stringify(result,null,2));}finally{store.close();}}return;
  }
  if(command==='backlog'){
    const action=argv[1]??'list';if(action==='import'){const value=JSON.parse(await readFile(path.resolve(required(options.file,'file')),'utf8'));const values=Array.isArray(value)?value:[value];const store=new JobStore(DB_PATH),backlog=new BacklogService(store);try{console.log(JSON.stringify(values.map(idea=>backlog.upsertDraft(idea)),null,2));}finally{store.close();}return;}try{if(action==='list')console.log(JSON.stringify(await apiRequest('GET','/api/backlog'),null,2));else{const id=required(options.id,'id');if(!['approve','reject','produce'].includes(action))throw new Error('Usage: backlog list|approve|reject|produce [--id ID]');console.log(JSON.stringify(await apiRequest('POST','/api/backlog/'+encodeURIComponent(id)+'/'+action,{}),null,2));}}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH),backlog=new BacklogService(store);try{await backlog.seed();const id=typeof options.id==='string'?options.id:'';const result=action==='list'?backlog.list():action==='approve'?await backlog.approve(required(id,'id')):action==='reject'?backlog.reject(required(id,'id')):action==='produce'?await backlog.produce(required(id,'id')):undefined;if(result===undefined)throw new Error(action==='list'?'Invalid backlog action':'Backlog idea not found');console.log(JSON.stringify(result,null,2));}finally{store.close();}}return;
  }
  if(command==='knowledge'){
    const action=argv[1]??'list',registry=new KnowledgeRegistry();
    if(action==='register'){const descriptor=knowledgeSourceSchema.parse(JSON.parse(required(options.descriptor,'descriptor')));try{console.log(JSON.stringify(await apiRequest('POST','/api/knowledge/register',descriptor),null,2));}catch(e){if(!unavailable(e))throw e;console.log(JSON.stringify(await registerKnowledgeSource(descriptor),null,2));}return;}
    if(action==='inspect'){const id=required(options.id,'id');try{console.log(JSON.stringify(await apiRequest('GET','/api/knowledge/sources/'+encodeURIComponent(id)),null,2));}catch(e){if(!unavailable(e))throw e;console.log(JSON.stringify(await registry.inspectSource(id),null,2));}return;}
    if(!['list','refresh'].includes(action))throw new Error('Usage: knowledge list|refresh|inspect --id ID|register --descriptor JSON');
    try{console.log(JSON.stringify(await apiRequest(action==='refresh'?'POST':'GET','/api/knowledge'+(action==='refresh'?'/refresh':''),action==='refresh'?{}:undefined),null,2));}catch(e){if(!unavailable(e))throw e;console.log(JSON.stringify(await registry.refresh(),null,2));}return;
  }
  if(command==='ideas'){
    const action=argv[1]??'list';
    try{
      if(action==='list'){console.log(JSON.stringify(await apiRequest('GET','/api/ideas'+(typeof options.project==='string'?'?projectId='+encodeURIComponent(options.project):'')),null,2));return;}
      if(action==='runs'){console.log(JSON.stringify(await apiRequest('GET','/api/idea-runs'),null,2));return;}
      if(action==='run'){console.log(JSON.stringify(await apiRequest('GET','/api/idea-runs/'+z.uuid().parse(required(options.id,'id'))),null,2));return;}
      if(action==='generate'){const projectId=required(options.project,'project'),idempotencyKey=typeof options.key==='string'?options.key:'manual-ideas:'+randomUUID();console.log(JSON.stringify(await apiRequest('POST','/api/idea-runs',{projectId,idempotencyKey,count:3}),null,2));return;}
      const id=z.uuid().parse(required(options.id,'id'));if(action==='approve'){console.log(JSON.stringify(await apiRequest('POST','/api/ideas/'+id+'/approve',{}),null,2));return;}if(action==='reject'){console.log(JSON.stringify(await apiRequest('POST','/api/ideas/'+id+'/reject',typeof options.note==='string'?{note:options.note}:{}),null,2));return;}if(action==='regenerate'){console.log(JSON.stringify(await apiRequest('POST','/api/ideas/'+id+'/regenerate',{idempotencyKey:typeof options.key==='string'?options.key:'regenerate-idea:'+randomUUID()}),null,2));return;}throw new Error('Usage: ideas list|runs|run|generate|approve|reject|regenerate');
    }catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH),service=new IdeaService(store);try{let result:unknown;if(action==='list')result=service.list(typeof options.project==='string'?options.project:undefined);else if(action==='runs')result=service.runs();else if(action==='run')result=await offlineIdeaRun(service,required(options.id,'id'));else if(action==='generate')result=await service.enqueue(required(options.project,'project'),typeof options.key==='string'?options.key:'manual-ideas:'+randomUUID(),3);else if(action==='approve')result=await service.approve(z.uuid().parse(required(options.id,'id')));else if(action==='reject')result=service.reject(z.uuid().parse(required(options.id,'id')),typeof options.note==='string'?options.note:undefined);else if(action==='regenerate')result=await service.regenerate(z.uuid().parse(required(options.id,'id')),typeof options.key==='string'?options.key:'regenerate-idea:'+randomUUID());else throw new Error('Usage: ideas list|runs|run|generate|approve|reject|regenerate');if(result===undefined)throw new Error('Idea not found');console.log(JSON.stringify(result,null,2));}finally{store.close();}return;}
  }
  if(command==='enqueue'){console.log(JSON.stringify(await enqueue({...await validatedInput(options),idempotencyKey:typeof options.key==='string'?options.key:undefined}),null,2));return;}
  if(command==='generate'){
    const input=await validatedInput(options);const key=typeof options.key==='string'?options.key:'manual:'+randomUUID();
    const job=await enqueue({...input,idempotencyKey:key});console.log('Job '+job.id+' queued');
    let local:{store:JobStore;pipeline:Pipeline}|undefined;let interrupted=false;
    const stop=()=>{interrupted=true;if(local)void local.pipeline.stop();};process.once('SIGINT',stop);process.once('SIGTERM',stop);
    try{
      for(;;){
        if(interrupted)throw new Error('CLI interrupted; the job remains persisted. Use cancel to cancel explicitly.');
        let current:JobRow;
        if(local)current=local.store.get(job.id)!;
        else try{current=await apiRequest('GET','/api/jobs/'+job.id);}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);if(!store.get(job.id)){store.close();throw new Error('Enqueued job cannot be found; refusing to create a duplicate');}local={store,pipeline:new Pipeline(store)};local.pipeline.start();current=store.get(job.id)!;}
        if(['READY_FOR_REVIEW','APPROVED','REJECTED','FAILED','CANCELLED'].includes(current.status)){console.log(JSON.stringify(current,null,2));if(['FAILED','CANCELLED'].includes(current.status))process.exitCode=1;return;}
        await new Promise((r)=>setTimeout(r,750));
      }
    }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);if(local){await local.pipeline.stop();local.store.close();}}
  }
  if(['retry','cancel','approve','reject'].includes(command??'')){
    const id=z.uuid().parse(required(options.id,'id'));
    try{console.log(JSON.stringify(await apiRequest('POST','/api/jobs/'+id+'/'+command,{}),null,2));}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);try{const job=command==='retry'?store.retry(id):command==='cancel'?store.requestCancel(id):store.review(id,command==='approve'?'APPROVED':'REJECTED');if(!job)throw new Error('Job not found');console.log(JSON.stringify(job,null,2));}finally{store.close();}}return;
  }
  if(command==='regenerate'){
    const id=z.uuid().parse(required(options.id,'id'));try{console.log(JSON.stringify(await apiRequest('POST','/api/jobs/'+id+'/regenerate',{}),null,2));}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH),backlog=new BacklogService(store);try{const prior=store.get(id);if(!prior)throw new Error('Job not found');let profile=await loadProfile(prior.projectId);if(!profile.approvedContent.some(content=>content.id===prior.contentId)){const bound=backlog.list(prior.projectId).find(idea=>idea.contentId===prior.contentId);if(!bound)throw new Error('Content is no longer approved');const validated=await backlog.validateForProduction(bound);if(validated.content.topic!==prior.topic)throw new Error('Proposal content identity changed');profile=validated.profile;}if(!profile.approvedContent.some(content=>content.id===prior.contentId)||!profile.templates.includes(templateSchema.parse(prior.template)))throw new Error('Content or template is no longer approved');const job=store.regenerate(id,{projectId:prior.projectId,topic:prior.topic,contentId:prior.contentId,template:prior.template});console.log(JSON.stringify(job,null,2));}finally{store.close();}}return;
  }
  if(command==='schedule'){
    const filename=path.resolve(required(options.file,'file')),value=JSON.parse(await readFile(filename,'utf8'));scheduleSchema.parse(value);const store=new JobStore(DB_PATH);try{await new BacklogService(store).seed();const gate=await productionGate(store);if(!gate.allowed)throw new Error('Schedule blocked: '+gate.reason);console.log(JSON.stringify(await runDueSchedules(store,value),null,2));store.recordProductionTick('Schedule CLI completed',null);}catch(error){store.recordProductionTick('Schedule CLI error',error instanceof Error?error.message:String(error));throw error;}finally{store.close();}return;
  }
  throw new Error('Usage: npm run cli -- doctor | generate --project ID --topic TOPIC --content ID [--template T] | enqueue ... [--key K] | jobs | retry|cancel|approve|reject|regenerate --id UUID | production status|pause|resume | backlog list|approve|reject|produce [--id ID] | knowledge list|refresh|inspect|register | ideas list|runs|run|generate|approve|reject|regenerate | schedule --file config/schedules.json');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch((e)=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
