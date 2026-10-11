import {z,type ZodType} from 'zod';
import {validateTrustedScript,scriptSchema,type ProjectProfile,type Template} from './domain.js';
import {CommandCenter,transientJob,type EditorialResult} from './command-center.js';
import * as fixture from './legacy-models.js';
export {assertLocalBaseUrl,selectQwenModel,checkOllama,discoverBonsai} from './legacy-models.js';
export type {ModelAttempt,ModelResult,InstalledModel,StructuredQwenResult} from './legacy-models.js';
import type {ModelAttempt,ModelResult,StructuredQwenResult} from './legacy-models.js';
function attempt(result:EditorialResult):ModelAttempt{return {provider:'command-center',model:result.contract.model,startedAt:result.createdAt,finishedAt:result.completedAt??'',request:result.contract,response:{raw:result.raw,lifecycle:result.lifecycle},unload:{ok:result.readyForConsumer}};}
function raw(result:EditorialResult){return JSON.parse(result.raw??'{}') as Record<string,unknown>;}
export async function generateStructuredQwen<T>(prompt:string,schema:ZodType<T>,signal?:AbortSignal):Promise<StructuredQwenResult<T>>{
  if(process.env.NODE_TEST_CONTEXT&&process.env.NODE_ENV!=='production')return fixture.generateStructuredQwen(prompt,schema,signal);
  const result=await new CommandCenter().execute(transientJob('factory-editorial','qwen',prompt,z.toJSONSchema(schema)),signal),response=raw(result);
  return {value:schema.parse(JSON.parse(result.result!)),attempt:attempt(result),prompt,raw:response,model:{name:response.model as string},metrics:{evalCount:Number(response.eval_count??0),promptEvalCount:Number(response.prompt_eval_count??0),totalDurationNs:Number(response.total_duration??0)}};
}
export async function generateScript(profile:ProjectProfile,input:{topic:string;contentId:string;template:Template},signal?:AbortSignal,onStage?:(stage:'REFINING')=>void):Promise<ModelResult>{
  if(process.env.NODE_TEST_CONTEXT&&process.env.NODE_ENV!=='production')return fixture.generateScript(profile,input,signal,onStage);
  const content=profile.approvedContent.find(c=>c.id===input.contentId);if(!content)throw new Error('Content is not approved');
  const prompt='Return JSON only: a four-scene vertical video script matching schema. Every headline and body must be copied EXACTLY from approved content strings. Preserve brief identity and CTA. First kind hook, last kind cta; final body exact profile CTA. before-after middle scenes must both headline/body equal exact before and after, kinds before/after. explainer middle kinds lesson and body exact lessons in order. Choose seconds 4-8. Do not add claims. '+JSON.stringify({projectId:profile.id,...input,cta:profile.cta,approved:content,voice:profile.voice});
  const center=new CommandCenter(),draft=await center.execute(transientJob(profile.id,'qwen',prompt,z.toJSONSchema(scriptSchema)),signal),script=validateTrustedScript(JSON.parse(draft.result!),profile);
  if(script.topic!==input.topic||script.contentId!==input.contentId||script.template!==input.template)throw new Error('Command Center changed brief identity');
  onStage?.('REFINING');const review=await center.execute(transientJob(profile.id,'bonsai','Review the script for clarity, timing, unsupported claims and brand fit. Return specific editorial notes as plain text; do not invent or alter approved facts. '+JSON.stringify({script,approved:content,restrictions:profile.restrictions}),null),signal);
  return {script,attempts:[attempt(draft),attempt(review)],metadata:{generation:{provider:'command-center',model:'qwen3:14b-q8_0',jobId:draft.jobId,lifecycle:draft.lifecycle},editorial:{status:'REVIEWED',model:'Ternary-Bonsai-2-27B-PQ2_0',jobId:review.jobId,notes:review.result,lifecycle:review.lifecycle},approvalRequired:true}};
}
