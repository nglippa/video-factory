import express,{type NextFunction,type Request,type Response} from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {readFile,readdir,realpath} from 'node:fs/promises';
import {z} from 'zod';
import {ARTIFACTS_DIR,CONFIG_DIR,DATA_DIR,DB_PATH,HOST,PORT,ROOT_DIR,loadProfile,loadProfiles} from './config.js';
import {templateSchema} from './domain.js';
import {SourceRecovery,sourceDecisionSchema} from './source-recovery.js';
import {checkOllama,discoverBonsai} from './models.js';
import {Pipeline} from './pipeline.js';
import {JobStore} from './store.js';
import {BacklogService} from './backlog.js';
import {productionGate,Scheduler} from './scheduler.js';
import {IdeaService} from './ideas.js';
import {CampaignService} from './campaigns.js';
import {CommandCenter} from './command-center.js';
import {campaignId} from './campaign-domain.js';
import {KnowledgeRegistry} from './knowledge.js';
const artifactNames=new Set(['video.mp4','poster.jpg','script.json','metadata.json','qa.json']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const jobInput=z.object({projectId:z.string().min(1),topic:z.string().trim().min(1).max(300),contentId:z.string().min(1),template:templateSchema.optional(),idempotencyKey:z.string().min(1).max(200).optional()}).strict();
const ideaRunInput=z.object({projectId:z.string().min(1),idempotencyKey:z.string().min(1).max(200),count:z.literal(3).default(3)}).strict();
const ideaRejectInput=z.object({note:z.string().trim().min(1).max(500).optional()}).strict();
const ideaRegenerateInput=z.object({idempotencyKey:z.string().min(1).max(200)}).strict();
export function createApp(store:JobStore,pipeline?:Pipeline){
  const sources=new SourceRecovery(ROOT_DIR,CONFIG_DIR,DATA_DIR);
  const app=express(),backlog=new BacklogService(store),ideas=pipeline?.ideas??new IdeaService(store),knowledge=new KnowledgeRegistry(),campaigns=pipeline?.campaigns??new CampaignService(store);app.disable('x-powered-by');const streams=new Set<()=>void>();app.locals.closeStreams=()=>{for(const close of streams)close();};
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
  app.get('/api/command-center/status',async(_req,res)=>res.json(await new CommandCenter().status()));
  app.get('/api/campaigns',(_req,res)=>res.json(campaigns.list().map(s=>campaigns.overview(s.id))));
  app.get('/api/campaigns/:id',(req,res)=>{const id=z.literal(campaignId).parse(param(req.params.id)),result=campaigns.overview(id);if(!result)return res.status(404).json({error:'Campaign not initialized'});res.json(result);});
  app.get('/api/campaigns/:id/exports/:filename',(req,res)=>{const id=z.literal(campaignId).parse(param(req.params.id)),filename=z.enum(['SUMMARY.md','proposals.json','blockers.json','whodunnit.md','gigwise.md','terra-steam-tycoon.md','angband.md','find-my-needs.md']).parse(param(req.params.filename)),directory=campaigns.state(id)?.lastExport;if(!directory)return res.status(404).end();const root=path.join(DATA_DIR,'campaigns',id,'exports'),relative=path.relative(root,directory);if(!relative||relative.startsWith('..')||path.isAbsolute(relative))return res.status(404).end();res.download(path.join(directory,filename),filename);});
  app.post('/api/campaigns',mutationGuard,async(req,res)=>{z.object({id:z.literal(campaignId)}).strict().parse(req.body);campaigns.initialize();await campaigns.refreshSources();await campaigns.export();res.status(201).json(campaigns.overview());});
  app.post('/api/campaigns/:id/:action',mutationGuard,async(req,res)=>{const id=z.literal(campaignId).parse(param(req.params.id)),action=z.enum(['start','pause','resume','refresh-sources','retry-pilot','export']).parse(param(req.params.action));z.object({}).strict().parse(req.body);if(action==='export')return res.json({directory:await campaigns.export(id)});res.json(await campaigns.control(action,id));});
  app.post('/api/campaigns/:campaignId/proposals/:id/:action',mutationGuard,async(req,res)=>{z.literal(campaignId).parse(param(req.params.campaignId));const id=z.string().regex(/^[a-z0-9-]+$/).parse(param(req.params.id)),action=z.enum(['approve','reject','revise']).parse(param(req.params.action)),body=z.object({reason:z.string().trim().min(1).max(2000).optional(),contentBaseId:z.string().regex(/^[a-z0-9-]+$/).optional(),gameplayAssetIds:z.tuple([z.string().regex(/^[a-z0-9-]+$/),z.string().regex(/^[a-z0-9-]+$/)]).optional()}).strict().refine(v=>Boolean(v.contentBaseId)===Boolean(v.gameplayAssetIds),'Content and gameplay asset selection must be provided together').parse(req.body);if(campaigns.slot(id)?.campaignId!==campaignId)return res.status(404).json({error:'Proposal not found'});res.json(await campaigns.review(id,action,body.reason,body.contentBaseId&&body.gameplayAssetIds?{contentBaseId:body.contentBaseId,gameplayAssetIds:body.gameplayAssetIds}:undefined));});
  app.get('/api/projects',async(_req,res)=>res.json(await loadProfiles()));
  const recoveryReports=path.join(DATA_DIR,'campaigns',campaignId,'source-recovery');
  async function latestRecoveryReport(){try{const entries=(await readdir(recoveryReports,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d{4}-\d{2}-\d{2}T[\d-Z]+$/.test(e.name)).map(e=>e.name).sort().reverse();for(const name of entries){const directory=path.join(recoveryReports,name);if(await realpath(directory)!==directory)continue;if(existsSync(path.join(directory,'SUMMARY.md'))&&existsSync(path.join(directory,'throughput.json')))return directory;}return null;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
  app.get('/api/source-recovery/report',async(_req,res)=>{const directory=await latestRecoveryReport();res.json({available:Boolean(directory),directory});});
  app.get('/api/source-recovery/report/:filename',async(req,res)=>{const filename=z.enum(['SUMMARY.md','throughput.json']).parse(param(req.params.filename)),directory=await latestRecoveryReport();if(!directory)return res.status(404).end();const file=path.join(directory,filename);if(await realpath(file)!==file)return res.status(404).end();res.download(file,filename);});
  app.get('/api/source-candidates',async(_req,res)=>res.json(await sources.list()));
  app.post('/api/source-candidates/:id/:action',mutationGuard,async(req,res)=>{const action=z.enum(['approve','reject']).parse(param(req.params.action)),result=await sources.decide(param(req.params.id),action,sourceDecisionSchema.parse(req.body));let refreshError:string|null=null;if(action==='approve'){try{await campaigns.refreshSources([result.candidate.projectId]);await campaigns.revalidateProductionRequirements([result.candidate.projectId]);await campaigns.export();}catch(error){refreshError=error instanceof Error?error.message:String(error);}}res.json({...result,refreshError});});
  app.get('/api/knowledge',async(_req,res)=>res.json(await knowledge.refresh()));
  app.get('/api/knowledge/sources/:id',async(req,res)=>res.json(await knowledge.inspectSource(param(req.params.id))));
  app.post('/api/knowledge/refresh',mutationGuard,async(_req,res)=>res.json(await knowledge.refresh()));
  app.post('/api/knowledge/register',mutationGuard,(_req,res)=>res.status(400).json({error:'New knowledge requires explicit source candidate review. Use Source approval in the existing dashboard.'}));
  app.get('/api/ideas',(req,res)=>res.json(ideas.list(typeof req.query.projectId==='string'?req.query.projectId:undefined)));
  app.get('/api/idea-runs',(_req,res)=>res.json(ideas.runs()));
  app.get('/api/idea-runs/:id',async(req,res)=>{const id=z.uuid().parse(param(req.params.id)),run=ideas.getRun(id);if(!run)return res.status(404).json({error:'Not found'});const events=(store.db.prepare('SELECT id,type,data,created_at FROM idea_events WHERE run_id=? ORDER BY id').all(id) as Array<{id:number;type:string;data:string;created_at:string}>).map(event=>({...event,data:JSON.parse(event.data),createdAt:event.created_at}));let provenance:unknown=null;try{provenance=JSON.parse(await readFile(path.join(DATA_DIR,'idea-runs',id+'.json'),'utf8'));}catch{/* queued, failed, or legacy run */}res.json({...run,candidates:ideas.list(run.projectId).filter(idea=>idea.runId===id),events,provenance});});
  app.post('/api/idea-runs',mutationGuard,async(req,res)=>{const input=ideaRunInput.parse(req.body);res.status(202).json(await ideas.enqueue(input.projectId,input.idempotencyKey,input.count));});
  app.post('/api/ideas/:id/approve',mutationGuard,async(req,res)=>{const idea=await ideas.approve(z.uuid().parse(param(req.params.id)));if(!idea)return res.status(404).json({error:'Not found'});res.json(idea);});
  app.post('/api/ideas/:id/reject',mutationGuard,(req,res)=>{const input=ideaRejectInput.parse(req.body),idea=ideas.reject(z.uuid().parse(param(req.params.id)),input.note);if(!idea)return res.status(404).json({error:'Not found'});res.json(idea);});
  app.post('/api/ideas/:id/regenerate',mutationGuard,async(req,res)=>{const input=ideaRegenerateInput.parse(req.body);res.status(202).json(await ideas.regenerate(z.uuid().parse(param(req.params.id)),input.idempotencyKey));});
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
  app.post('/api/jobs/:id/regenerate',mutationGuard,async(req,res)=>{const id=z.uuid().parse(param(req.params.id)),prior=store.get(id);if(!prior)return res.status(404).json({error:'Not found'});let profile=await loadProfile(prior.projectId);if(!profile.approvedContent.some(content=>content.id===prior.contentId)){const bound=backlog.list(prior.projectId).find(idea=>idea.contentId===prior.contentId);if(!bound)return res.status(400).json({error:'Content is no longer approved'});const validated=await backlog.validateForProduction(bound);if(validated.content.topic!==prior.topic)return res.status(400).json({error:'Proposal content identity changed'});profile=validated.profile;}if(!profile.approvedContent.some(content=>content.id===prior.contentId))return res.status(400).json({error:'Content is no longer approved'});if(!profile.templates.includes(templateSchema.parse(prior.template)))return res.status(400).json({error:'Template is no longer approved'});res.status(202).json(store.regenerate(id,{projectId:prior.projectId,topic:prior.topic,contentId:prior.contentId,template:prior.template}));});
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
