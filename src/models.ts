import {approvedAssets} from './assets.js';
import {templateSchema, validateTrustedScript, type ProjectProfile, type Template, type VideoScript} from './domain.js';
import {z,type ZodType} from 'zod';

export type ModelAttempt = {provider:string;model?:string;startedAt:string;finishedAt:string;request:unknown;response?:unknown;error?:string;unload?:{ok:boolean;error?:string}};
export type ModelResult = {script:VideoScript;attempts:ModelAttempt[];warning?:string;metadata:Record<string,unknown>};
export type InstalledModel={name:string;digest?:string;size?:number};
export function selectQwenModel(models:InstalledModel[],configured=process.env.QWEN_MODEL):InstalledModel {
  const suitable=(model:InstalledModel)=>/^qwen/i.test(model.name)&&!/(coder|embed|vl|vision)/i.test(model.name)&&(typeof model.size==='number'&&Number.isFinite(model.size)&&model.size>0&&model.size<=16_000_000_000);
  if(configured){const model=models.find(m=>m.name===configured);if(!model)throw new Error(`Configured Qwen model is not installed: ${configured}. No model will be downloaded.`);if(!suitable(model))throw new Error('Configured model is not a text Qwen model within the 16 GB model-size budget');return model;}
  const candidates=models.filter(suitable).sort((a,b)=>(a.size??Infinity)-(b.size??Infinity)||a.name.localeCompare(b.name));
  const selected=candidates[0];if(!selected)throw new Error('No installed text Qwen model fits the 16 GB model-size budget. Configure an installed Qwen model; downloads are never automatic.');return selected;
}

export function assertLocalBaseUrl(raw:string): URL {
  let url:URL;try{url=new URL(raw);}catch{throw new Error('Invalid local model URL');}
  if (url.protocol!=='http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username!==''||url.password!=='') {
    throw new Error('Model URL must be HTTP loopback without credentials');
  }
  url.hash='';url.search='';url.pathname=url.pathname.replace(/\/$/,'');
  return url;
}
function combinedSignal(signal:AbortSignal|undefined,timeoutMs:number) {
  const timeout=AbortSignal.timeout(timeoutMs);
  return signal?AbortSignal.any([signal,timeout]):timeout;
}
async function localFetch(base:URL,pathname:string,init:RequestInit={},timeoutMs=120_000) {
  const url=new URL(base); url.pathname=(base.pathname+(base.pathname.endsWith('/v1')&&pathname.startsWith('/v1/')?pathname.slice(3):pathname)).replace(/\/+/g,'/');
  const response=await fetch(url,{...init,redirect:'error',signal:combinedSignal(init.signal as AbortSignal|undefined,timeoutMs)});
  if(!response.ok) throw new Error(`${pathname} returned ${response.status}`);
  return response;
}

const outputJsonSchema={
  type:'object',additionalProperties:false,required:['version','projectId','topic','template','contentId','scenes','cta'],
  properties:{version:{const:1},projectId:{type:'string'},topic:{type:'string'},template:{enum:templateSchema.options},contentId:{type:'string'},
    scenes:{type:'array',minItems:4,maxItems:4,items:{type:'object',additionalProperties:false,required:['kind','headline','body','seconds'],properties:{kind:{enum:['hook','before','after','lesson','cta']},headline:{type:'string',maxLength:80},body:{type:'string',maxLength:240},seconds:{type:'integer',minimum:4,maximum:8},assetId:{type:'string'}}}},
    cta:{type:'string'}}};

function buildPrompt(profile:ProjectProfile,input:{topic:string;contentId:string;template:Template},assetIds:string[]=[]) {
  const content=profile.approvedContent.find((item)=>item.id===input.contentId);
  if(!content) throw new Error('Requested content is not approved for this project/topic');
  return `Create one four-scene vertical video script. Output JSON only. You may choose timing from 4 to 8 seconds, scene arrangement allowed by the template, and approved asset IDs. Copy every headline and body exactly from the APPROVED_STRINGS array. Do not invent, paraphrase, combine, or add words. CTA must exactly equal PROJECT_CTA.\nINPUT=${JSON.stringify({projectId:profile.id,...input})}\nPROJECT_CTA=${JSON.stringify(profile.cta)}\nAPPROVED_STRINGS=${JSON.stringify([content.title,content.hook,content.body,content.before,content.after,content.cta,content.disclaimer,profile.cta,...(content.lessons??[])].filter(Boolean))}\nCONTENT=${JSON.stringify(content)}\nFor before-after: kinds exactly hook,before,after,cta; both headline and body of before must equal CONTENT.before, and both fields of after must equal CONTENT.after. For explainer: kinds exactly hook,lesson,lesson,cta. When CONTENT.lessons exists, scene 2 body exactly CONTENT.lessons[0] and scene 3 body exactly CONTENT.lessons[1]; use a matching lesson headline. Choose readable timing; 5-6 seconds per lesson. For media templates, both middle scenes must set assetId from ${JSON.stringify(assetIds)}. Final scene body exactly PROJECT_CTA. For all templates first scene is hook and final scene is cta. Use INPUT.topic exactly. Brand voice=${JSON.stringify(profile.voice)} Restrictions=${JSON.stringify(profile.restrictions)}`;
}

export async function checkOllama(signal?:AbortSignal) {
  const base=assertLocalBaseUrl(process.env.OLLAMA_BASE_URL??'http://127.0.0.1:11434');
  const tags=await (await localFetch(base,'/api/tags',{signal},5_000)).json() as {models?:Array<{name:string;digest?:string;size?:number}>};
  const ps=await (await localFetch(base,'/api/ps',{signal},5_000)).json() as {models?:Array<{name:string;digest?:string;size?:number}>};
  const selected=selectQwenModel(tags.models??[]);
  const loaded=(ps.models??[]).map((m)=>m.name);
  const unfamiliar=loaded.filter((name)=>name!==selected.name);
  if(unfamiliar.length) throw new Error(`Ollama resource busy: unfamiliar model(s) loaded: ${unfamiliar.join(', ')}`);
  return {base,selected,tags:(tags.models??[]).map((m)=>m.name),loaded,modelDetails:tags.models??[]};
}

export type StructuredQwenResult<T>={value:T;attempt:ModelAttempt;prompt:string;raw:Record<string,unknown>;model:{name:string;digest?:string;size?:number};metrics:{evalCount:number;promptEvalCount:number|null;totalDurationNs:number|null}};
export async function generateStructuredQwen<T>(prompt:string,schema:ZodType<T>,signal?:AbortSignal):Promise<StructuredQwenResult<T>>{
  const health=await checkOllama(signal),model=health.selected.name,request={model,prompt,stream:false,format:z.toJSONSchema(schema),think:false,options:{temperature:0,seed:42,num_ctx:4096,num_predict:2400},keep_alive:0};
  const attempt:ModelAttempt={provider:'ollama',model,startedAt:new Date().toISOString(),finishedAt:'',request};let raw:Record<string,unknown>={},value:T|undefined,primaryError:Error|undefined;
  try{raw=await (await localFetch(health.base,'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal},180_000)).json() as Record<string,unknown>;attempt.response=raw;if(raw.done!==true||raw.done_reason==='length'||raw.model!==model||typeof raw.eval_count!=='number'||raw.eval_count<1)throw new Error('Ollama did not return a complete structured generation with the selected model identity and metrics');if(typeof raw.response!=='string')throw new Error('Ollama response did not contain JSON text');value=schema.parse(JSON.parse(raw.response));
  }catch(error){primaryError=error instanceof Error?error:new Error(String(error));attempt.error=primaryError.message;
  }finally{attempt.finishedAt=new Date().toISOString();try{await localFetch(health.base,'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,prompt:'',keep_alive:0,stream:false})},10_000);const after=await checkOllama();if(after.loaded.length)throw new Error('Qwen remained loaded after structured generation');attempt.unload={ok:true};}catch(error){attempt.unload={ok:false,error:error instanceof Error?error.message:String(error)};}}
  const attach=(error:Error)=>Object.assign(error,{attempt,raw,prompt});
  if(primaryError)throw attach(primaryError);
  if(attempt.unload?.ok!==true){const error=new Error('Qwen unload failed after structured generation: '+(attempt.unload?.error??'unknown cleanup failure'));attempt.error=error.message;throw attach(error);}
  return {value:value!,attempt,prompt,raw,model:health.selected,metrics:{evalCount:raw.eval_count as number,promptEvalCount:typeof raw.prompt_eval_count==='number'?raw.prompt_eval_count:null,totalDurationNs:typeof raw.total_duration==='number'?raw.total_duration:null}};
}

async function qwen(profile:ProjectProfile,input:{topic:string;contentId:string;template:Template},signal?:AbortSignal) {
  const attempts:ModelAttempt[]=[]; const health=await checkOllama(signal); const assets=await approvedAssets(profile.id);const assetIds=assets.filter(a=>input.template==='gameplay'?a.kind==='gameplay':input.template==='feature-demo'?a.kind==='screenshot':false).map(a=>a.id);if(['gameplay','feature-demo'].includes(input.template)&&!assetIds.length)throw new Error('No approved visual assets for this media template');const prompt=buildPrompt(profile,input,assetIds);
  const model=health.selected.name;
  const request={model,prompt,stream:false,format:{...outputJsonSchema,properties:{...outputJsonSchema.properties,projectId:{const:profile.id},topic:{const:input.topic},contentId:{const:input.contentId},template:{const:input.template},cta:{const:profile.cta},scenes:{...outputJsonSchema.properties.scenes,items:{...outputJsonSchema.properties.scenes.items,properties:{...outputJsonSchema.properties.scenes.items.properties,headline:{enum:profile.approvedContent.filter(c=>c.id===input.contentId).flatMap(c=>[c.title,c.hook,c.body,c.before,c.after,c.cta,c.disclaimer,profile.cta,...(c.lessons??[])]).filter((v):v is string=>Boolean(v)&&v!.length<=80)},body:{enum:profile.approvedContent.filter(c=>c.id===input.contentId).flatMap(c=>[c.title,c.hook,c.body,c.before,c.after,c.cta,c.disclaimer,profile.cta,...(c.lessons??[])]).filter(Boolean)}}}}}},think:false,
    options:{temperature:0,seed:42,num_ctx:4096,num_predict:1400},keep_alive:0};
  if(assetIds.length)request.format.properties.scenes.items.properties.assetId={enum:assetIds} as unknown as typeof outputJsonSchema.properties.scenes.items.properties.assetId;
  else Reflect.deleteProperty(request.format.properties.scenes.items.properties,'assetId');
  const attempt:ModelAttempt={provider:'ollama',model,startedAt:new Date().toISOString(),finishedAt:'',request}; attempts.push(attempt);
  try {
    const raw=await (await localFetch(health.base,'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal},180_000)).json() as {response?:string;[key:string]:unknown};
    attempt.response=raw;
    if(raw.done!==true||raw.done_reason==='length'||raw.model!==model||typeof raw.eval_count!=='number'||raw.eval_count<1)throw new Error('Ollama did not return a complete generation with the selected model identity and inference metrics');
    if(typeof raw.response!=='string') throw new Error('Ollama response did not contain JSON text');
    const script=validateTrustedScript(JSON.parse(raw.response),profile);
    if(script.topic!==input.topic||script.contentId!==input.contentId||script.template!==input.template) throw new Error('Qwen changed the requested brief identity');
    attempt.finishedAt=new Date().toISOString();
    return {script,attempts,prompt,raw,health};
  } catch(error) {
    attempt.error=error instanceof Error?error.message:String(error); attempt.finishedAt=new Date().toISOString(); throw Object.assign(error instanceof Error?error:new Error(String(error)),{attempts,prompt});
  } finally {
    try { await localFetch(health.base,'/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,prompt:'',keep_alive:0,stream:false})},10_000); attempt.unload={ok:true}; }
    catch(error) { attempt.unload={ok:false,error:error instanceof Error?error.message:String(error)}; }
  }
}

export async function discoverBonsai(signal?:AbortSignal):Promise<{base?:URL;reason?:string;models?:unknown;model?:string}> {
  const candidates=process.env.BONSAI_BASE_URL?[process.env.BONSAI_BASE_URL]:[8000,8080,1234,8001].map((p)=>`http://127.0.0.1:${p}`);
  if(process.env.BONSAI_BASE_URL)assertLocalBaseUrl(process.env.BONSAI_BASE_URL);
  for(const candidate of candidates) {
    try { const base=assertLocalBaseUrl(candidate); const models=await (await localFetch(base,'/v1/models',{signal},1_500)).json() as {data?:Array<{id?:string}>};const ids=(models.data??[]).map(m=>m.id).filter((id):id is string=>typeof id==='string'&&id.length>0);const model=process.env.BONSAI_MODEL?ids.find(id=>id===process.env.BONSAI_MODEL):ids.find(id=>/bonsai/i.test(id));if(model)return {base,models,model}; } catch(error) { if(signal?.aborted)throw signal.reason; /* unavailable port */ }
  }
  return {reason:'Bonsai unavailable on configured/local discovery endpoints'};
}

export async function generateScript(profile:ProjectProfile,input:{topic:string;contentId:string;template:Template},signal?:AbortSignal,onStage?:(stage:'REFINING')=>void):Promise<ModelResult> {
  let base:Awaited<ReturnType<typeof qwen>>;
  try{base=await qwen(profile,input,signal);}catch(error){if(error instanceof Error&&!(error as Error&{attempts?:unknown}).attempts)Object.assign(error,{attempts:[{provider:'ollama-preflight',model:process.env.QWEN_MODEL,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),request:input,error:error.message}]});throw error;}
  if(base.attempts.some((a)=>a.unload?.ok!==true))throw Object.assign(new Error('Qwen unload failed; refusing overlapping model/render execution'),{attempts:base.attempts});
  const afterUnload=await checkOllama(signal);
  if(afterUnload.loaded.length)throw Object.assign(new Error('Qwen is still loaded; refusing render'),{attempts:base.attempts});
  const metadata=(editorial:Record<string,unknown>)=>({promptVersion:'approved-script-v2',modelDigest:base.health.selected.digest,prompt:base.prompt,qwen:base.raw,generation:{provider:'ollama',model:base.health.selected.name,modelSize:base.health.selected.size,modelDigest:base.health.selected.digest,endpoint:base.health.base.href,structuredOutput:true,approvedCopyOnly:true,startedAt:base.attempts[0]?.startedAt,finishedAt:base.attempts[0]?.finishedAt,evalCount:base.raw.eval_count,promptEvalCount:base.raw.prompt_eval_count,totalDurationNs:base.raw.total_duration},editorial});
  const discovered=await discoverBonsai(signal);
  if(!discovered.base) return {script:base.script,attempts:base.attempts,warning:'Editorial refinement skipped: '+discovered.reason,metadata:metadata({status:'SKIPPED',available:false,reason:discovered.reason})};
  if(process.env.BONSAI_MEMORY_SAFE!=='true') return {script:base.script,attempts:base.attempts,warning:'Editorial refinement skipped: Bonsai available but memory lifecycle has not been approved by the operator',metadata:metadata({status:'SKIPPED',available:true,endpoint:discovered.base.href,model:discovered.model,reason:'resource-policy'})};
  onStage?.('REFINING');
  const request={model:discovered.model!,temperature:0,...(process.env.BONSAI_JSON_MODE==='false'?{}:{response_format:{type:'json_object'}}),messages:[{role:'system',content:'Return JSON only. Refine wording by selecting suitable alternatives ONLY from the approved strings provided by the user message. Never add or paraphrase wording. Preserve projectId, contentId, topic, template, scene kinds, assetIds and CTA. Preserve exact before/after pair and final CTA body. You may improve timing and select the clearest approved hook/lesson wording.'},{role:'user',content:JSON.stringify({script:base.script,approved:profile.approvedContent.find(c=>c.id===input.contentId),voice:profile.voice})}]};
  const attempt:ModelAttempt={provider:'bonsai',model:request.model,startedAt:new Date().toISOString(),finishedAt:'',request}; base.attempts.push(attempt);
  try {
    const raw=await (await localFetch(discovered.base,'/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request),signal},60_000)).json() as {choices?:Array<{message?:{content?:string}}>};
    attempt.response=raw; attempt.finishedAt=new Date().toISOString();
    const text=raw.choices?.[0]?.message?.content; if(!text) throw new Error('Bonsai returned no content');
    const refined=validateTrustedScript(JSON.parse(text),profile);
    const preserved=(['version','projectId','topic','template','contentId','cta'] as const).every((key)=>refined[key]===base.script[key]) && refined.scenes.every((scene,i)=>{
      const prior=base.script.scenes[i]; return prior && scene.kind===prior.kind&&scene.assetId===prior.assetId;
    });
    if(!preserved) throw new Error('Bonsai changed a protected structural or wording field');
    return {script:validateTrustedScript(refined,profile),attempts:base.attempts,metadata:metadata({status:'COMPLETED',available:true,endpoint:discovered.base.href,model:discovered.model,response:raw,changes:refined.scenes.flatMap((scene,i)=>Object.entries(scene).filter(([key,value])=>value!==base.script.scenes[i]?.[key as keyof typeof scene]).map(([field,after])=>({scene:i+1,field,before:base.script.scenes[i]?.[field as keyof typeof scene],after}))),meaningCheck:'Exact approved-copy allowlist, ordered lessons, protected synthetic pair, identity and CTA'})};
  } catch(error) {
    attempt.error=error instanceof Error?error.message:String(error); attempt.finishedAt=new Date().toISOString();
    return {script:validateTrustedScript(base.script,profile),attempts:base.attempts,warning:`Bonsai refinement failed; retained validated Qwen script: ${attempt.error}`,metadata:metadata({status:'FAILED',available:true,endpoint:discovered.base.href,model:discovered.model,error:attempt.error,changes:[]})};
  }
}
