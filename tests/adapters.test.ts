import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {projectProfileSchema} from '../src/domain.js';
import {generateScript,generateStructuredQwen,type ModelAttempt} from '../src/models.js';
test('local adapter I/O: refinement, rejection, unload ordering, and cancellation',async()=>{
  const profile=projectProfileSchema.parse(JSON.parse(await readFile(new URL('../config/projects/whodunnit.json',import.meta.url),'utf8')));
  const c=profile.approvedContent[0]!;
  const script={version:1,projectId:profile.id,topic:'adapter fixture',template:'before-after',contentId:c.id,cta:profile.cta,scenes:[
    {kind:'hook',headline:c.title,body:c.body,seconds:4},{kind:'before',headline:c.before,body:c.before,seconds:4},
    {kind:'after',headline:c.after,body:c.after,seconds:4},{kind:'cta',headline:c.title,body:profile.cta,seconds:4}]};
  let mode='valid';const order:string[]=[];
  const server=http.createServer(async(req,res)=>{
    let text='';for await(const chunk of req)text+=chunk;
    const request=text?JSON.parse(text):{};order.push(req.url+(request.prompt===''?':unload':''));
    res.setHeader('Content-Type','application/json');
    if(req.url==='/api/tags')res.end(JSON.stringify({models:[{name:'qwen3:14b-q8_0',digest:'fixture',size:15_895_155_363}]}));
    else if(req.url==='/api/ps')res.end('{"models":[]}');
    else if(req.url==='/v1/models')res.end('{"data":[{"id":"fixture-bonsai"}]}');
    else if(req.url==='/api/generate'&&request.prompt===''){if(mode==='unload-failure'){res.statusCode=503;res.end('{}');}else res.end('{"done":true}');}
    else if(req.url==='/api/generate'){if(mode==='slow'){const t=setTimeout(()=>res.end(JSON.stringify({model:'qwen3:14b-q8_0',done:mode!=='incomplete',done_reason:'stop',eval_count:100,response:JSON.stringify(script)})),3000);res.on('close',()=>clearTimeout(t));}else res.end(JSON.stringify({model:'qwen3:14b-q8_0',done:mode!=='incomplete',done_reason:'stop',eval_count:100,response:JSON.stringify(script)}));}
    else if(req.url==='/v1/chat/completions'){const refined=structuredClone(script);refined.scenes[0]!.headline=mode==='invalid'?'A fabricated capability':c.hook;res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(refined)}}]}));}
    else{res.statusCode=404;res.end('{}');}
  });
  server.listen(0,'127.0.0.1');await new Promise<void>((r)=>server.once('listening',()=>r()));
  const url='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  const prior={ollama:process.env.OLLAMA_BASE_URL,bonsai:process.env.BONSAI_BASE_URL,safe:process.env.BONSAI_MEMORY_SAFE,model:process.env.BONSAI_MODEL};
  process.env.OLLAMA_BASE_URL=url;process.env.BONSAI_BASE_URL=url+'/v1';process.env.BONSAI_MEMORY_SAFE='true';delete process.env.BONSAI_MODEL;
  const input={topic:'adapter fixture',contentId:c.id,template:'before-after' as const};
  try{
    const result=await generateScript(profile,input);assert.equal(result.script.scenes[0]?.headline,c.hook);assert.equal((result.metadata.editorial as any).status,'COMPLETED');assert.ok((result.metadata.editorial as any).changes.length>0);assert.equal(result.attempts[1]?.model,'fixture-bonsai');assert.ok(order.indexOf('/api/generate:unload')<order.indexOf('/v1/chat/completions'));
    mode='invalid';const rejected=await generateScript(profile,input);assert.equal(rejected.script.scenes[0]?.headline,c.title);assert.match(rejected.warning!,/refinement failed/);assert.ok(rejected.attempts[1]?.error);
    mode='incomplete';await assert.rejects(()=>generateScript(profile,input),/complete generation/);
    mode='unload-failure';await assert.rejects(()=>generateScript(profile,input),/unload failed/);
    mode='slow';const controller=new AbortController();const promise=generateScript(profile,input,controller.signal);setTimeout(()=>controller.abort(new Error('Cancelled fixture')),30);await assert.rejects(promise,/Cancelled fixture/);
  }finally{
    for(const [name,value] of Object.entries({OLLAMA_BASE_URL:prior.ollama,BONSAI_BASE_URL:prior.bonsai,BONSAI_MEMORY_SAFE:prior.safe,BONSAI_MODEL:prior.model})){if(value===undefined)delete process.env[name];else process.env[name]=value;}
    await new Promise<void>((r)=>server.close(()=>r()));
  }
});

test('structured Qwen validates responses and verifies cleanup independently of cancellation',async()=>{
  let mode='valid',sawUnload=false,verifiedAfterUnload=false;
  const server=http.createServer(async(req,res)=>{
    let text='';for await(const chunk of req)text+=chunk;
    const request=text?JSON.parse(text):{};res.setHeader('Content-Type','application/json');
    if(req.url==='/api/tags')return res.end(JSON.stringify({models:[{name:'qwen3:14b-q8_0',digest:'fixture',size:15_895_155_363}]}));
    if(req.url==='/api/ps'){if(sawUnload)verifiedAfterUnload=true;return res.end(JSON.stringify({models:mode==='still-loaded'?[{name:'qwen3:14b-q8_0'}]:[]}));}
    if(req.url==='/api/generate'&&request.prompt===''){sawUnload=true;if(mode==='unload-http'||mode==='cancel-unload-http'){res.statusCode=503;return res.end('{}');}return res.end('{"done":true}');}
    if(req.url==='/api/generate'){
      if(mode.startsWith('cancel-')){const timer=setTimeout(()=>res.end('{}'),3_000);res.on('close',()=>clearTimeout(timer));return;}
      const response=mode==='invalid-json'?'{':JSON.stringify({answer:mode==='invalid-structure'?'unsupported':'ok'}),body={model:mode==='mismatched'?'qwen3:other':'qwen3:14b-q8_0',done:mode!=='incomplete',done_reason:'stop',eval_count:2,prompt_eval_count:3,total_duration:4,response};return res.end(JSON.stringify(body));
    }
    res.statusCode=404;return res.end('{}');
  });
  server.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const prior=process.env.OLLAMA_BASE_URL;process.env.OLLAMA_BASE_URL='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  const schema=z.object({answer:z.literal('ok')}).strict(),run=()=>generateStructuredQwen('fixture prompt',schema);
  try{
    const valid=await run();assert.deepEqual(valid.value,{answer:'ok'});assert.equal(valid.attempt.unload?.ok,true);assert.deepEqual(valid.metrics,{evalCount:2,promptEvalCount:3,totalDurationNs:4});
    for(const [failure,pattern] of [['incomplete',/complete structured generation/],['mismatched',/complete structured generation/],['invalid-json',/JSON/],['invalid-structure',/Invalid input/]] as const){mode=failure;sawUnload=false;await assert.rejects(run,pattern);assert.equal(sawUnload,true);}
    for(const failure of ['unload-http','still-loaded'] as const){mode=failure;sawUnload=false;await assert.rejects(run,(error:Error&{attempt?:ModelAttempt;raw?:unknown;prompt?:string})=>{assert.match(error.message,/unload failed/);assert.equal(error.attempt?.unload?.ok,false);assert.equal(error.prompt,'fixture prompt');assert.ok(error.raw);return true;});assert.equal(sawUnload,true);}
    mode='cancel-cleanup-success';sawUnload=false;verifiedAfterUnload=false;let controller=new AbortController(),cancelled=generateStructuredQwen('cancel prompt',schema,controller.signal);setTimeout(()=>controller.abort(new Error('Cancelled structured fixture')),30);await assert.rejects(cancelled,(error:Error&{attempt?:ModelAttempt;prompt?:string})=>{assert.match(error.message,/Cancelled structured fixture/);assert.equal(error.attempt?.error,'Cancelled structured fixture');assert.equal(error.attempt?.unload?.ok,true);assert.equal(error.prompt,'cancel prompt');return true;});assert.equal(sawUnload,true);assert.equal(verifiedAfterUnload,true);
    mode='cancel-unload-http';sawUnload=false;verifiedAfterUnload=false;controller=new AbortController();cancelled=generateStructuredQwen('cancel prompt',schema,controller.signal);setTimeout(()=>controller.abort(new Error('Cancelled structured fixture')),30);await assert.rejects(cancelled,(error:Error&{attempt?:ModelAttempt;prompt?:string})=>{assert.match(error.message,/Cancelled structured fixture/);assert.equal(error.attempt?.error,'Cancelled structured fixture');assert.equal(error.attempt?.unload?.ok,false);assert.match(error.attempt?.unload?.error??'',/503/);assert.equal(error.prompt,'cancel prompt');return true;});assert.equal(sawUnload,true);assert.equal(verifiedAfterUnload,false);
  }finally{if(prior===undefined)delete process.env.OLLAMA_BASE_URL;else process.env.OLLAMA_BASE_URL=prior;await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
