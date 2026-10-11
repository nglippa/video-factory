import {mkdir,readFile,statfs} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import {ARTIFACTS_DIR,CONFIG_DIR,loadProfile} from './config.js';
import {templateSchema} from './domain.js';
import {BacklogService} from './backlog.js';
import {JobStore,type JobRow} from './store.js';
import {IdeaService,type IdeaRun} from './ideas.js';

const timeSchema=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const productionConfigSchema=z.object({timezone:z.string().refine(validTimezone,'Invalid timezone'),window:z.object({enabled:z.boolean(),start:timeSchema,end:timeSchema}).strict(),minimumFreeDiskBytes:z.number().int().min(2*1024**3),minimumFreeMemoryBytes:z.number().int().min(1024**3),jobConcurrency:z.literal(1)}).strict();
export type ProductionConfig=z.infer<typeof productionConfigSchema>;
const scheduleItemSchema=z.object({id:z.string().regex(/^[a-z0-9-]+$/),projectId:z.string(),topic:z.string().min(1).max(300).optional(),contentId:z.string().optional(),template:templateSchema.optional(),hour:z.number().int().min(0).max(23),minute:z.number().int().min(0).max(59),timezone:z.string().refine(validTimezone,'Invalid timezone'),enabled:z.boolean(),useBacklog:z.boolean().optional().default(false)}).strict().superRefine((schedule,context)=>{if(!schedule.useBacklog&&(!schedule.topic||!schedule.contentId||!schedule.template))context.addIssue({code:'custom',message:'Direct schedules require topic, contentId, and template'});});
export const scheduleSchema=z.array(scheduleItemSchema).refine((s)=>new Set(s.map((v)=>v.id)).size===s.length,'Schedule IDs must be unique');
export type DueSchedule=z.infer<typeof scheduleItemSchema>&{idempotencyKey:string};
const ideaScheduleItemSchema=z.object({id:z.string().regex(/^[a-z0-9-]+$/),projectId:z.string(),frequency:z.enum(['daily','weekly']),weekday:z.number().int().min(0).max(6).optional(),hour:z.number().int().min(0).max(23),minute:z.number().int().min(0).max(59),timezone:z.string().refine(validTimezone,'Invalid timezone'),count:z.literal(3),enabled:z.boolean()}).strict().superRefine((value,context)=>{if(value.frequency==='weekly'&&value.weekday===undefined)context.addIssue({code:'custom',message:'Weekly idea schedules require weekday'});});
export const ideaScheduleSchema=z.array(ideaScheduleItemSchema).refine(values=>new Set(values.map(v=>v.id)).size===values.length,'Idea schedule IDs must be unique');

function validTimezone(value:string){try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}
function localParts(now:Date,timezone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const get=(type:string)=>parts.find((part)=>part.type===type)?.value??'';return {date:get('year')+'-'+get('month')+'-'+get('day'),minutes:Number(get('hour'))*60+Number(get('minute'))};}
export function dueSchedules(value:unknown,now=new Date()):DueSchedule[]{return scheduleSchema.parse(value).filter((schedule)=>schedule.enabled).flatMap((schedule)=>{const local=localParts(now,schedule.timezone);if(local.minutes<schedule.hour*60+schedule.minute)return [];return [{...schedule,idempotencyKey:'schedule:'+schedule.id+':'+local.date}];});}
export function dueIdeaSchedules(value:unknown,now=new Date()){return ideaScheduleSchema.parse(value).filter(schedule=>schedule.enabled).flatMap(schedule=>{const local=localParts(now,schedule.timezone),actual=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(new Intl.DateTimeFormat('en-US',{timeZone:schedule.timezone,weekday:'short'}).format(now));if(schedule.frequency==='weekly'&&actual!==schedule.weekday||local.minutes<schedule.hour*60+schedule.minute)return [];return [{...schedule,idempotencyKey:'idea-schedule:'+schedule.id+':'+local.date}];});}
export async function loadProductionConfig(filename=path.join(CONFIG_DIR,'production.json')){return productionConfigSchema.parse(JSON.parse(await readFile(filename,'utf8')));}
function memoryAvailable(config:ProductionConfig){if(process.platform==='darwin'){const result=spawnSync('memory_pressure',['-Q'],{encoding:'utf8',timeout:2_000});const match=result.stdout.match(/free percentage:\s*(\d+)%/i);if(result.status===0&&match)return Number(match[1])>10;}return os.freemem()>=config.minimumFreeMemoryBytes;}
let resourceCache:{checkedAt:number;freeDisk:number;memoryAvailable:boolean}|undefined;
async function resources(config:ProductionConfig){if(resourceCache&&Date.now()-resourceCache.checkedAt<10_000)return resourceCache;await mkdir(ARTIFACTS_DIR,{recursive:true});const disk=await statfs(ARTIFACTS_DIR);resourceCache={checkedAt:Date.now(),freeDisk:Number(disk.bavail)*Number(disk.bsize),memoryAvailable:memoryAvailable(config)};return resourceCache;}
export async function productionGate(store:JobStore,now=new Date(),config?:ProductionConfig){
  const control=store.production(),settings=config??await loadProductionConfig();
  if(control.paused)return {allowed:false,reason:control.statusReason??'Paused by operator',config:settings};
  if(settings.window.enabled){const local=localParts(now,settings.timezone).minutes,[startHour,startMinute]=settings.window.start.split(':').map(Number),[endHour,endMinute]=settings.window.end.split(':').map(Number),start=startHour!*60+startMinute!,end=endHour!*60+endMinute!;const inside=start<=end?local>=start&&local<end:local>=start||local<end;if(!inside)return {allowed:false,reason:'Outside production window',config:settings};}
  const available=await resources(settings);if(available.freeDisk<settings.minimumFreeDiskBytes)return {allowed:false,reason:'Insufficient free disk space',config:settings};
  if(!available.memoryAvailable)return {allowed:false,reason:'High memory pressure',config:settings};
  return {allowed:true,reason:'Ready',config:settings};
}
export async function runDueSchedules(store:JobStore,value:unknown,now=new Date()){
  const backlog=new BacklogService(store),created:JobRow[]=[],errors:string[]=[];
  for(const schedule of dueSchedules(value,now)){
    try{if(schedule.useBacklog){const job=await backlog.produceScheduled(schedule.projectId,schedule.idempotencyKey);if(job)created.push(job);continue;}const profile=await loadProfile(schedule.projectId);if(!profile.approvedContent.some((content)=>content.id===schedule.contentId))throw new Error('Scheduled content is not approved');if(!schedule.template||!profile.templates.includes(schedule.template))throw new Error('Scheduled template is not approved');created.push(store.create({projectId:schedule.projectId,topic:schedule.topic!,contentId:schedule.contentId!,template:schedule.template,idempotencyKey:schedule.idempotencyKey}));}catch(error){errors.push(schedule.id+': '+(error instanceof Error?error.message:String(error)));}
  }
  if(errors.length)throw new Error('Schedule errors: '+errors.join('; '));
  return created;
}
export async function runDueIdeaSchedules(store:JobStore,value:unknown,now=new Date(),service=new IdeaService(store)){const runs:IdeaRun[]=[];for(const schedule of dueIdeaSchedules(value,now))runs.push(await service.enqueue(schedule.projectId,schedule.idempotencyKey,schedule.count));return runs;}
export class Scheduler{
  private timer?:NodeJS.Timeout;private running=false;
  constructor(readonly store:JobStore,readonly schedulesFile=path.join(CONFIG_DIR,'schedules.json'),readonly intervalMs=60_000,readonly ideaSchedulesFile=path.join(CONFIG_DIR,'idea-schedules.json'),readonly resourceGate=productionGate){}
  start(){if(this.timer)return;this.timer=setInterval(()=>void this.tick(),this.intervalMs);void this.tick();}
  async stop(){if(this.timer)clearInterval(this.timer);this.timer=undefined;while(this.running)await new Promise((resolve)=>setTimeout(resolve,10));}
  async tick(now=new Date()){if(this.running)return [];this.running=true;try{const gate=await this.resourceGate(this.store,now);if(!gate.allowed){this.store.recordProductionTick(gate.reason);return [];}let ideaError:string|undefined,videoError:string|undefined,runs:IdeaRun[]=[],jobs:JobRow[]=[];try{runs=await runDueIdeaSchedules(this.store,JSON.parse(await readFile(this.ideaSchedulesFile,'utf8')),now);}catch(error){ideaError=error instanceof Error?error.message:String(error);}try{jobs=await runDueSchedules(this.store,JSON.parse(await readFile(this.schedulesFile,'utf8')),now);}catch(error){videoError=error instanceof Error?error.message:String(error);}if(ideaError||videoError)throw new Error([ideaError&&'ideas: '+ideaError,videoError&&'videos: '+videoError].filter(Boolean).join('; '));this.store.recordProductionTick((jobs.length||runs.length)?`Due slots checked (${jobs.length} jobs bound, ${runs.length} idea runs)`:'Ready',null);return jobs;}catch(error){const message=error instanceof Error?error.message:String(error);this.store.recordProductionTick('Scheduler error',message);console.error('Scheduler tick failed:',message);return [];}finally{this.running=false;}}
}
