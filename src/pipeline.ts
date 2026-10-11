import {mkdir,rename,writeFile} from 'node:fs/promises';
import {copyFileSync,existsSync,renameSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {ARTIFACTS_DIR,loadProfile} from './config.js';
import {stableHash,templateSchema} from './domain.js';
import {generateScript,type ModelAttempt} from './models.js';
import {JobStore,type JobRow} from './store.js';
import {renderVideo} from './render.js';
async function atomicJson(filename:string,value:unknown){const tmp=filename+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',mode:0o600});await rename(tmp,filename);}
function message(e:unknown){return e instanceof Error?e.message:String(e);}
export class Pipeline{
  readonly owner='worker-'+process.pid+'-'+randomUUID();private active=new Map<string,AbortController>();private timer?:NodeJS.Timeout;private running=false;
  constructor(readonly store:JobStore,readonly pollMs=750){}
  start(){if(this.timer)return;this.timer=setInterval(()=>void this.tick().catch((e)=>console.error('Worker tick failed:',message(e))),this.pollMs);void this.tick().catch((e)=>console.error('Worker startup failed:',message(e)));}
  async stop(){if(this.timer)clearInterval(this.timer);this.timer=undefined;for(const controller of this.active.values())controller.abort(new Error('Worker shutting down'));while(this.running)await new Promise((r)=>setTimeout(r,25));}
  cancel(id:string){const job=this.store.requestCancel(id);this.active.get(id)?.abort(new Error('Cancelled by operator'));return job;}
  async tick(){if(this.running)return;const job=this.store.claim(this.owner);if(!job)return;this.running=true;try{await this.process(job);}finally{this.running=false;}}
  private async process(job:JobRow){
    const controller=new AbortController();this.active.set(job.id,controller);
    const canonicalDir=path.join(ARTIFACTS_DIR,job.id);
    const artifactDir=path.join(canonicalDir,'attempt-'+job.attempts+'-'+this.owner);
    let heartbeat:NodeJS.Timeout|undefined;let attempts:ModelAttempt[]=[];let phase='setup';
    const assertOwned=()=>{controller.signal.throwIfAborted();if(!this.store.owns(job.id,this.owner))throw new Error('Worker lease lost');};
    const transition=(status:'REFINING'|'RENDERING'|'VALIDATING',fields:{warning?:string|null}={})=>{assertOwned();if(!this.store.update(job.id,status,{...fields,owner:this.owner,artifactDir:canonicalDir}))throw new Error('Worker lease lost');};
    try{
      await mkdir(artifactDir,{recursive:true});assertOwned();
      heartbeat=setInterval(()=>{if(!this.store.heartbeat(job.id,this.owner))controller.abort(new Error('Worker lease lost'));if(this.store.get(job.id)?.cancelRequested)controller.abort(new Error('Cancelled by operator'));},5_000);
      const profile=await loadProfile(job.projectId);const content=profile.approvedContent.find((c)=>c.id===job.contentId);if(!content)throw new Error('Job content is not approved');
      const template=templateSchema.parse(job.template);
      await atomicJson(path.join(artifactDir,'profile.json'),profile);await atomicJson(path.join(artifactDir,'request.json'),{jobId:job.id,attempt:job.attempts,projectId:job.projectId,topic:job.topic,contentId:job.contentId,template,createdAt:job.createdAt});
      phase='script';this.store.event(job.id,'progress',{stage:'script',progress:0});
      const generated=await generateScript(profile,{topic:job.topic,contentId:job.contentId,template},controller.signal,()=>transition('REFINING'));attempts=generated.attempts;
      await atomicJson(path.join(artifactDir,'model-attempts.json'),attempts);await atomicJson(path.join(artifactDir,'script.json'),generated.script);await atomicJson(path.join(artifactDir,'model-metadata.json'),{...generated.metadata,warning:generated.warning??null,scriptHash:stableHash(generated.script)});
      transition('RENDERING',{warning:generated.warning??null});phase='render';
      let lastProgress=0,lastStage='';
      const rendered=await renderVideo({jobId:job.id,script:generated.script,profile,artifactDir,signal:controller.signal,onProgress:(update)=>{assertOwned();if(update.stage==='validate'&&phase!=='validate'){transition('VALIDATING');phase='validate';}
        const now=Date.now();if(update.stage!==lastStage||now-lastProgress>=500||update.progress===1){lastStage=update.stage??'render';lastProgress=now;this.store.event(job.id,'progress',{stage:lastStage,progress:Math.max(0,Math.min(1,update.progress))});}}});
      assertOwned();await atomicJson(path.join(artifactDir,'qa.json'),rendered.qa);
      await atomicJson(path.join(artifactDir,'metadata.json'),{jobId:job.id,attempt:job.attempts,scriptHash:stableHash(generated.script),profileHash:stableHash(profile),models:generated.metadata,attempts,render:rendered.renderMetadata,warning:generated.warning??null,approvalRequired:true,publishingImplemented:false});
      if(!(rendered.qa&&typeof rendered.qa==='object'&&'passed' in rendered.qa&&rendered.qa.passed===true))throw new Error('Rendered video failed QA');
      assertOwned();
      if(!this.store.finalize(job.id,this.owner,()=>{for(const name of ['video.mp4','poster.jpg','script.json','metadata.json','qa.json','profile.json','request.json','model-attempts.json','model-metadata.json']){const src=path.join(artifactDir,name);if(!existsSync(src))continue;const target=path.join(canonicalDir,name);copyFileSync(src,target+'.tmp');renameSync(target+'.tmp',target);}}, {artifactDir:canonicalDir,warning:generated.warning??null}))throw new Error('Worker lease lost or cancellation requested during finalization');
    }catch(error){
      attempts=(error as {attempts?:ModelAttempt[]})?.attempts??attempts;
      let failure=message(error);
      try{await mkdir(artifactDir,{recursive:true});await atomicJson(path.join(artifactDir,'failure.json'),{jobId:job.id,attempt:job.attempts,phase,error:failure,attempts,failedAt:new Date().toISOString()});await atomicJson(path.join(artifactDir,'model-attempts.json'),attempts);}catch(writeError){failure+='; failure artifact could not be saved: '+message(writeError);console.error(failure);}
      if(this.store.owns(job.id,this.owner)){
        this.store.event(job.id,'failure',{phase,error:failure,attempt:job.attempts});
        const cancelled=this.store.get(job.id)?.cancelRequested===1;const stopping=controller.signal.aborted&&message(controller.signal.reason)==='Worker shutting down';
        const status=cancelled?'CANCELLED':stopping&&job.attempts<job.maxAttempts?'QUEUED':'FAILED';
        this.store.update(job.id,status,{owner:this.owner,error:status==='QUEUED'?null:failure,artifactDir:canonicalDir,releaseLease:true});
        if(stopping)this.store.event(job.id,'interrupted',{status,attempt:job.attempts});
      }else{console.error('Worker lost ownership; isolated attempt retained:',job.id,failure);}
    }finally{if(heartbeat)clearInterval(heartbeat);this.active.delete(job.id);}
  }
}
