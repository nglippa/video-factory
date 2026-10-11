import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import type {AddressInfo} from 'node:net';
import {createApp} from '../src/server.js';
import {JobStore} from '../src/store.js';
import {PORT} from '../src/config.js';

test('knowledge and idea routes enforce mutation guards and expose reviewed evidence',async()=>{
  const store=new JobStore(':memory:'),app=createApp(store),server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  const request=(route:string,method='GET',body?:unknown,headers:Record<string,string>={})=>new Promise<{status:number;body:any}>((resolve,reject)=>{
    const req=http.request(base+route,{method,headers:{host:'127.0.0.1:'+PORT,...body===undefined?{}:{'content-type':'application/json'},...headers}},response=>{let raw='';response.on('data',chunk=>raw+=chunk);response.on('end',()=>resolve({status:response.statusCode!,body:raw?JSON.parse(raw):null}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  try{
    const knowledge=await request('/api/knowledge');assert.equal(knowledge.status,200);assert.ok(knowledge.body.some((project:any)=>project.projectId==='whodunnit'&&project.claims.some((claim:any)=>claim.sourceId&&claim.locator&&claim.sha256&&claim.text)));
    assert.equal((await request('/api/knowledge/register','POST',{}, {origin:'https://evil.example'})).status,403);
    assert.equal((await request('/api/knowledge/register','POST',{id:'bad'})).status,400);
    assert.equal((await request('/api/ideas/'+randomUUID()+'/approve','POST',{})).status,404);
    const queued=await request('/api/idea-runs','POST',{projectId:'whodunnit',idempotencyKey:'api-idea-run',count:3});assert.equal(queued.status,202);assert.equal(queued.body.status,'QUEUED');
    const detail=await request('/api/idea-runs/'+queued.body.id);assert.equal(detail.status,200);assert.deepEqual(detail.body.candidates,[]);assert.equal(detail.body.provenance,null);
    assert.equal((await request('/api/idea-runs','POST',{projectId:'whodunnit',idempotencyKey:'api-idea-run',count:2})).status,400);
  }finally{app.locals.closeStreams();await new Promise<void>(resolve=>server.close(()=>resolve()));store.close();}
});
