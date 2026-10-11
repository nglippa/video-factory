import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {readFile} from 'node:fs/promises';
import {projectProfileSchema} from '../src/domain.js';
import {generateScript} from '../src/models.js';
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
