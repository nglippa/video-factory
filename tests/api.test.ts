import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type {AddressInfo} from 'node:net';
import {createApp} from '../src/server.js';
import {JobStore} from '../src/store.js';
import {PORT} from '../src/config.js';
test('live API protects host, origin, approval, cursor, and idempotency',async()=>{
  const store=new JobStore(':memory:'),app=createApp(store);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>((r)=>server.once('listening',()=>r()));const url='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  async function request(route:string,body?:unknown,headers:Record<string,string>={}):Promise<{status:number;json:()=>Promise<any>}>{
    return new Promise((resolve,reject)=>{const req=http.request(url+route,{method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:'+PORT,...body===undefined?{}:{'Content-Type':'application/json'},...headers}},(res)=>{let raw='';res.on('data',(b)=>raw+=b);res.on('end',()=>resolve({status:res.statusCode!,json:async()=>JSON.parse(raw)}));});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});
  }
  try{
    assert.equal((await request('/api/jobs',undefined,{host:'evil.example'})).status,403);
    assert.equal((await request('/api/jobs',{},{origin:'https://evil.example'})).status,403);
    assert.equal((await request('/api/events?after=-1')).status,400);
    assert.equal((await request('/api/jobs?limit=-1')).status,400);
    const input={projectId:'whodunnit',topic:'A custom approved-content direction',contentId:'clear-writing',template:'before-after',idempotencyKey:'integration'};
    const response=await request('/api/jobs',input);assert.equal(response.status,202);const job=await response.json();
    assert.equal((await request('/api/jobs',input)).status,202);assert.equal(store.list().length,1);
    assert.equal((await request('/api/jobs',{...input,topic:'changed'})).status,409);
    assert.equal((await request('/api/jobs/'+job.id+'/approve',{})).status,400);
    assert.equal((await request('/api/jobs',{...input,idempotencyKey:'new',projectId:'find-my-needs'})).status,400);
    assert.equal((await request('/artifacts/'+job.id+'/profile.json')).status,404);
    assert.equal((await request('/api/jobs/'+job.id+'/cancel',{})).status,200);
    await new Promise<void>((resolve,reject)=>{const req=http.get(url+'/api/events',{headers:{host:'127.0.0.1:'+PORT}},(res)=>{res.once('data',(b)=>{try{assert.match(b.toString(),/event: created/);resolve();}catch(e){reject(e);}res.destroy();});});req.on('error',reject);});app.locals.closeStreams();
  }finally{app.locals.closeStreams();await new Promise<void>((r)=>server.close(()=>r()));store.close();}
});
