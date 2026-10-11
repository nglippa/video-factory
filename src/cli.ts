import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {DB_PATH,HOST,PORT,loadProfile,loadProfiles} from './config.js';
import {templateSchema,type Template} from './domain.js';
import {checkOllama,discoverBonsai} from './models.js';
import {Pipeline} from './pipeline.js';
import {JobStore,type JobRow} from './store.js';
const api='http://'+HOST+':'+PORT;
class ApiResponseError extends Error{constructor(readonly status:number,message:string){super(message);}}
function args(argv:string[]){const result:Record<string,string|boolean>={};for(let i=0;i<argv.length;i++){const value=argv[i]!;if(value.startsWith('--')){const next=argv[i+1];if(next&&!next.startsWith('--')){result[value.slice(2)]=next;i++;}else result[value.slice(2)]=true;}}return result;}
function required(value:string|boolean|undefined,name:string){if(typeof value!=='string'||!value.trim())throw new Error('Missing --'+name);return value;}
async function apiRequest(method:string,pathname:string,body?:unknown){const response=await fetch(api+pathname,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(8_000)});const data=await response.json();if(!response.ok)throw new ApiResponseError(response.status,data.error??'API request failed');return data;}
function unavailable(error:unknown){return error instanceof TypeError||error instanceof DOMException;}
async function validatedInput(options:Record<string,string|boolean>){const projectId=required(options.project,'project'),topic=required(options.topic,'topic'),contentId=required(options.content,'content');if(topic.length>300)throw new Error('Topic exceeds 300 characters');const profile=await loadProfile(projectId);if(!profile.approvedContent.some((c)=>c.id===contentId))throw new Error('Content is not approved');const template=templateSchema.parse(typeof options.template==='string'?options.template:profile.templates[0]);if(!profile.templates.includes(template))throw new Error('Template is not enabled');return {projectId,topic,contentId,template};}
type JobInput={projectId:string;topic:string;contentId:string;template:Template;idempotencyKey?:string};
async function enqueue(input:JobInput):Promise<JobRow>{try{return await apiRequest('POST','/api/jobs',input);}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);try{return store.create(input);}finally{store.close();}}}
export const scheduleSchema=z.array(z.object({id:z.string().regex(/^[a-z0-9-]+$/),projectId:z.string(),topic:z.string().min(1).max(300),contentId:z.string(),template:templateSchema,hour:z.number().int().min(0).max(23),minute:z.number().int().min(0).max(59),timezone:z.string().refine((v)=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone'),enabled:z.boolean()}).strict()).refine((s)=>new Set(s.map((v)=>v.id)).size===s.length,'Schedule IDs must be unique');
export function dueSchedules(value:unknown,now=new Date()){
  return scheduleSchema.parse(value).filter((s)=>s.enabled).flatMap((s)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const get=(t:string)=>parts.find((p)=>p.type===t)?.value??'';if(Number(get('hour'))*60+Number(get('minute'))<s.hour*60+s.minute)return [];return [{...s,idempotencyKey:'schedule:'+s.id+':'+get('year')+'-'+get('month')+'-'+get('day')}];});
}
export async function main(argv=process.argv.slice(2)){
  const command=argv[0],options=args(argv.slice(1));
  if(command==='doctor'){
    const versions:Record<string,unknown>={node:process.version,profiles:(await loadProfiles()).map((p)=>({id:p.id,enabled:p.enabled})),tools:{}};
    for(const tool of ['ffmpeg','ffprobe','ollama']){const result=spawnSync(tool,tool==='ollama'?['--version']:['-version'],{encoding:'utf8'});(versions.tools as Record<string,unknown>)[tool]={available:result.status===0,version:result.stdout?.split('\n')[0]??null};}
    try{const q=await checkOllama();versions.ollama={available:true,models:q.modelDetails,loaded:q.loaded};}catch(e){versions.ollama={available:false,error:e instanceof Error?e.message:String(e)};}
    const bonsai=await discoverBonsai();versions.bonsai={available:Boolean(bonsai.base),endpoint:bonsai.base?.href??null,reason:bonsai.reason};console.log(JSON.stringify(versions,null,2));return;
  }
  if(command==='jobs'){try{console.log(JSON.stringify(await apiRequest('GET','/api/jobs'),null,2));}catch(e){if(!unavailable(e))throw e;const store=new JobStore(DB_PATH);try{console.log(JSON.stringify(store.list(),null,2));}finally{store.close();}}return;}
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
  if(command==='schedule'){
    const filename=path.resolve(required(options.file,'file'));const due=dueSchedules(JSON.parse(await readFile(filename,'utf8')));const created:JobRow[]=[];
    for(const s of due){const input=await validatedInput({project:s.projectId,topic:s.topic,content:s.contentId,template:s.template});created.push(await enqueue({...input,idempotencyKey:s.idempotencyKey}));}
    console.log(JSON.stringify(created,null,2));return;
  }
  throw new Error('Usage: npm run cli -- doctor | generate --project ID --topic TOPIC --content ID [--template T] | enqueue ... [--key K] | jobs | retry|cancel|approve|reject --id UUID | schedule --file config/schedules.json');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch((e)=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
