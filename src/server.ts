import express,{type NextFunction,type Request,type Response} from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {z} from 'zod';
import {ARTIFACTS_DIR,DB_PATH,HOST,PORT,ROOT_DIR,loadProfile,loadProfiles} from './config.js';
import {templateSchema} from './domain.js';
import {checkOllama,discoverBonsai} from './models.js';
import {Pipeline} from './pipeline.js';
import {JobStore} from './store.js';
import {BacklogService} from './backlog.js';
import {productionGate,Scheduler} from './scheduler.js';
const artifactNames=new Set(['video.mp4','poster.jpg','script.json','metadata.json','qa.json']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobInput=z.object({projectId:z.string().min(1),topic:z.string().trim().min(1).max(300),contentId:z.string().min(1),template:templateSchema.optional(),idempotencyKey:z.string().min(1).max(200).optional()}).strict();
export function createApp(store:JobStore,pipeline?:Pipeline){
  const app=express(),backlog=new BacklogService(store);app.disable('x-powered-by');const streams=new Set<()=>void>();app.locals.closeStreams=()=>{for(const close of streams)close();};
  const allowedHosts=new Set([HOST+':'+PORT,'localhost:'+PORT]);
  app.use((req,res,next)=>{
    if(!allowedHosts.has(req.headers.host??''))return res.status(403).json({error:'Foreign Host rejected'});
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});
    next();
  });
  app.use(express.json({limit:'32kb',strict:true}));
  const param=(value:string|string[]|undefined)=>typeof value==='string'?value:'';
  const mutationGuard=(req:Request,res:Response,next:NextFunction)=>{
    if(req.headers.origin){
      try{const u=new URL(req.headers.origin);if(u.protocol!=='http:'||!allowedHosts.has(u.host))return res.status(403).json({error:'Foreign Origin rejected'});}catch{return res.status(403).json({error:'Invalid Origin'});}
    }
    if(!req.is('application/json'))return res.status(415).json({error:'Mutations require application/json'});next();
  };
  app.get('/api/projects',async(_req,res)=>res.json(await loadProfiles()));
  app.get('/api/jobs',(req,res)=>res.json(store.list(Number(req.query.limit??100))));
  app.get('/api/jobs/:id',(req,res)=>{const j=store.get(param(req.params.id));if(!j)return res.status(404).json({error:'Not found'});res.json({...j,events:store.events(0,j.id)});});
  app.get('/api/status',async(_req,res)=>{
    const found=await discoverBonsai();const bonsai={available:Boolean(found.base),endpoint:found.base?.href??null,reason:found.reason??null,memorySafe:process.env.BONSAI_MEMORY_SAFE==='true'};
    try{const q=await checkOllama();res.json({ok:true,worker:Boolean(pipeline),qwenModel:q.selected.name,bonsai,ollama:{available:true,tags:q.tags,loaded:q.loaded}});}
    catch(e){res.json({ok:false,worker:Boolean(pipeline),bonsai,ollama:{available:false,error:e instanceof Error?e.message:String(e)}});}
  });
  app.get('/api/production',async(_req,res)=>{const gate=await productionGate(store);res.json({...store.production(),window:gate.config.window,timezone:gate.config.timezone,minimumFreeDiskBytes:gate.config.minimumFreeDiskBytes,minimumFreeMemoryBytes:gate.config.minimumFreeMemoryBytes,jobConcurrency:gate.config.jobConcurrency,canStartJob:gate.allowed,gateReason:gate.reason});});
  app.post('/api/production/pause',mutationGuard,(req,res)=>res.json(store.setPaused(true,typeof req.body?.reason==='string'?req.body.reason:'Paused by operator')));
  app.post('/api/production/resume',mutationGuard,(_req,res)=>res.json(store.setPaused(false,'Resumed by operator')));
  app.post('/api/backlog',mutationGuard,(req,res)=>res.status(201).json(backlog.upsertDraft(req.body)));
  app.get('/api/backlog',(req,res)=>res.json(backlog.list(typeof req.query.projectId==='string'?req.query.projectId:undefined)));
  app.post('/api/backlog/:id/approve',mutationGuard,async(req,res)=>{const idea=await backlog.approve(param(req.params.id));if(!idea)return res.status(404).json({error:'Not found'});res.json(idea);});
  app.post('/api/backlog/:id/reject',mutationGuard,(req,res)=>{const idea=backlog.reject(param(req.params.id));if(!idea)return res.status(404).json({error:'Not found'});res.json(idea);});
  app.post('/api/backlog/:id/produce',mutationGuard,async(req,res)=>{const job=await backlog.produce(param(req.params.id));if(!job)return res.status(404).json({error:'Not found'});res.status(202).json(job);});
  app.get('/api/events',(req,res)=>{
    let cursor=Number(req.headers['last-event-id']??req.query.after??0);if(!Number.isSafeInteger(cursor)||cursor<0)return res.status(400).json({error:'Invalid event cursor'});
    res.set({'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.flushHeaders();
    let events:NodeJS.Timeout|undefined,heartbeat:NodeJS.Timeout|undefined;
    const close=()=>{if(events)clearInterval(events);if(heartbeat)clearInterval(heartbeat);streams.delete(close);res.end();};
    const send=()=>{try{for(const e of store.events(cursor)){cursor=Number(e.id);res.write('id: '+e.id+'\nevent: '+e.type+'\ndata: '+JSON.stringify(e)+'\n\n');}}catch(e){console.error('Event stream failed:',e);close();}};
    streams.add(close);events=setInterval(send,500);heartbeat=setInterval(()=>{if(res.destroyed)close();else res.write(': heartbeat\n\n');},15_000);res.once('close',close);send();
  });
  app.post('/api/jobs',mutationGuard,async(req,res)=>{
    const input=jobInput.parse(req.body);const profile=await loadProfile(input.projectId);if(!profile.approvedContent.some((c)=>c.id===input.contentId))return res.status(400).json({error:'Content is not approved for this project'});
    const template=input.template??profile.templates[0]!;if(!profile.templates.includes(template))return res.status(400).json({error:'Template is not approved'});res.status(202).json(store.create({...input,template}));
  });
  for(const action of ['cancel','retry','approve','reject'] as const){
    app.post('/api/jobs/:id/'+action,mutationGuard,(req,res)=>{const id=z.uuid().parse(param(req.params.id));const j=action==='cancel'?(pipeline?pipeline.cancel(id):store.requestCancel(id)):action==='retry'?store.retry(id):store.review(id,action==='approve'?'APPROVED':'REJECTED',req.body?.note);if(!j)return res.status(404).json({error:'Not found'});res.json(j);});
  }
  app.post('/api/jobs/:id/regenerate',mutationGuard,async(req,res)=>{const id=z.uuid().parse(param(req.params.id)),prior=store.get(id);if(!prior)return res.status(404).json({error:'Not found'});const profile=await loadProfile(prior.projectId);if(!profile.approvedContent.some((content)=>content.id===prior.contentId))return res.status(400).json({error:'Content is no longer approved'});if(!profile.templates.includes(templateSchema.parse(prior.template)))return res.status(400).json({error:'Template is no longer approved'});res.status(202).json(store.regenerate(id,{projectId:prior.projectId,topic:prior.topic,contentId:prior.contentId,template:prior.template}));});
  app.get('/artifacts/:jobId/:filename',(req,res)=>{
    const id=param(req.params.jobId),name=param(req.params.filename);if(!uuid.test(id)||!artifactNames.has(name))return res.status(404).end();
    const job=store.get(id);if(!job||job.qaPassed!==1||!['READY_FOR_REVIEW','APPROVED','REJECTED'].includes(job.status))return res.status(404).end();
    const filename=path.join(ARTIFACTS_DIR,id,name);if(!existsSync(filename))return res.status(404).end();res.sendFile(filename);
  });
  app.use('/fonts',express.static(path.join(ROOT_DIR,'public/fonts'),{index:false}));
  const web=path.join(ROOT_DIR,'web');if(existsSync(web))app.use(express.static(web,{index:'index.html'}));
  app.use((e:unknown,_req:Request,res:Response,_next:NextFunction)=>{if(res.headersSent){res.end();return;}const msg=e instanceof Error?e.message:String(e);const status=msg.startsWith('Idempotency conflict')?409:400;res.status(status).json({error:msg});});
  return app;
}
export function startServer(){
  const store=new JobStore(DB_PATH),pipeline=new Pipeline(store),scheduler=new Scheduler(store),app=createApp(store,pipeline);
  let stopping=false,startup=Promise.resolve();
  const server=app.listen(PORT,HOST,()=>{startup=new BacklogService(store).seed().then(()=>{if(stopping)return;scheduler.start();pipeline.start();console.log('Video factory listening on http://'+HOST+':'+PORT);}).catch((error)=>{if(stopping)return;store.recordProductionTick('Startup configuration error',error instanceof Error?error.message:String(error));console.error('Factory startup failed:',error);});});
  const shutdown=async()=>{if(stopping)return;stopping=true;app.locals.closeStreams();const closed=new Promise<void>((resolve)=>server.close(()=>resolve()));await startup;await Promise.all([pipeline.stop(),scheduler.stop()]);await closed;store.close();};
  process.once('SIGINT',()=>void shutdown());process.once('SIGTERM',()=>void shutdown());
  server.once('error',(e)=>{console.error('Factory server failed:',e.message);process.exitCode=1;void shutdown();});return {server,store,pipeline,scheduler};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))startServer();
