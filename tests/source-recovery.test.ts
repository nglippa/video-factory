import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SourceRecovery,readSourceApprovals} from '../src/source-recovery.js';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');

async function fixture(){
  const root=await mkdtemp(path.join(os.tmpdir(),'source-recovery-'));
  const configDir=path.join(root,'config'), projectsDir=path.join(root,'projects'), dataDir=path.join(root,'data');
  const repo=path.join(projectsDir,'steam-tycoon');
  await mkdir(repo,{recursive:true}); await mkdir(path.join(configDir,'projects'),{recursive:true});
  const base={enabled:false,colors:{background:'#161715',ink:'#f4f1ea',accent:'#bca383',muted:'#888a83'},typography:{display:'Newsreader',body:'Instrument Sans',mono:'IBM Plex Mono'},logo:{type:'wordmark',value:'Terra / Steam Tycoon'},voice:['Use only approved content.'],templates:['gameplay','announcement'],restrictions:['Awaiting verified Terra / Steam Tycoon brand and approved gameplay footage.'],cta:'Brand approval required.',assetDirectories:['public/assets/terra-steam-tycoon'],output:{width:1080,height:1920,fps:30},approvedContent:[],brandSources:[],id:'terra-steam-tycoon',name:'Terra / Steam Tycoon'};
  const baseBytes=JSON.stringify(base); await writeFile(path.join(configDir,'projects/terra-steam-tycoon.json'),baseBytes);
  const product='## Product\n\nA local city game.\n'; await writeFile(path.join(repo,'PRODUCT.md'),product);
  const recovery=new SourceRecovery(root,configDir,dataDir,projectsDir);
  const profile={...base,enabled:true,cta:'Play Terra locally.'};
  const candidate={version:1,id:'terra-steam-tycoon-review',projectId:'terra-steam-tycoon',createdAt:'2026-10-11T00:00:00.000Z',scope:'public product review',baseProfileSha256:sha(baseBytes),identity:'Terra / Steam Tycoon',documents:[{repository:repo,path:'PRODUCT.md',sha256:sha(product),modifiedAt:'2026-10-11T00:00:00.000Z',bytes:Buffer.byteLength(product)}],claims:[{kind:'description',text:'A local city game.',support:[{document:0,lines:[1,3],excerpt:product.trim()}],verification:'DOCUMENTED',risk:'Confirm product wording.'}],assets:[],risks:['Brand review required.'],profile};
  await mkdir(path.join(dataDir,'source-recovery','candidates'),{recursive:true});
  const candidateBytes=JSON.stringify(candidate); await writeFile(path.join(dataDir,'source-recovery','candidates',candidate.id+'.json'),candidateBytes);
  return {root,configDir,dataDir,recovery,candidateId:candidate.id,candidateSha:sha(candidateBytes),repo};
}

test('pending candidates are not trusted before explicit approval',async()=>{const f=await fixture();try{const result=await f.recovery.inspect(f.candidateId);assert.equal(result.status,'PENDING_APPROVAL');assert.equal((await readSourceApprovals(f.configDir)).length,0);}finally{await rm(f.root,{recursive:true,force:true});}});

test('approval requires the exact candidate hash and rejects changed origins',async()=>{const f=await fixture();try{await assert.rejects(()=>f.recovery.decide(f.candidateId,'approve',{sha256:'0'.repeat(64),confirmClaimsAndCopy:true,reason:'reviewed'}),/changed since review/);await assert.rejects(()=>f.recovery.decide(f.candidateId,'approve',{sha256:f.candidateSha,confirmClaimsAndCopy:false,reason:'not confirmed'}));await writeFile(path.join(f.repo,'PRODUCT.md'),'changed\n');await assert.rejects(()=>f.recovery.decide(f.candidateId,'approve',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'reviewed'}),/origin changed/);assert.equal((await f.recovery.inspect(f.candidateId)).status,'PENDING_APPROVAL');}finally{await rm(f.root,{recursive:true,force:true});}});

test('successful approval creates an overlay and preserves candidate/base hashes',async()=>{const f=await fixture();try{const result=await f.recovery.decide(f.candidateId,'approve',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'reviewed'});assert.equal(result.status,'APPROVED');const approvals=await readSourceApprovals(f.configDir);assert.equal(approvals.length,1);assert.equal(approvals[0]!.candidateSha256,f.candidateSha);assert.equal(approvals[0]!.baseProfileSha256,sha(await readFile(path.join(f.configDir,'projects/terra-steam-tycoon.json'))));const overlay=JSON.parse(await readFile(path.join(f.configDir,'source-approvals.json'),'utf8'));assert.equal(overlay.approvals[0].source.reviewedSha256,f.candidateSha);}finally{await rm(f.root,{recursive:true,force:true});}});

test('rejected candidates remain excluded from trusted approvals',async()=>{const f=await fixture();try{const result=await f.recovery.decide(f.candidateId,'reject',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'insufficient evidence'});assert.equal(result.status,'REJECTED');assert.deepEqual(await readSourceApprovals(f.configDir),[]);}finally{await rm(f.root,{recursive:true,force:true});}});

test('duplicate decisions are refused after approval',async()=>{const f=await fixture();try{await f.recovery.decide(f.candidateId,'approve',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'reviewed'});await assert.rejects(()=>f.recovery.decide(f.candidateId,'reject',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'too late'}),/already been decided/);}finally{await rm(f.root,{recursive:true,force:true});}});

test('candidate symlinks are rejected by secure reads',async()=>{const f=await fixture();try{const candidate=path.join(f.dataDir,'source-recovery','candidates',f.candidateId+'.json'),outside=path.join(f.root,'outside.json');await writeFile(outside,'outside');await rm(candidate);await symlink(outside,candidate);await assert.rejects(()=>f.recovery.inspect(f.candidateId),/Source path escapes boundary|symlink/);}finally{await rm(f.root,{recursive:true,force:true});}});


test('approval audit survives without a second decision file and corrupted selectors fail closed',async()=>{const f=await fixture();try{await f.recovery.decide(f.candidateId,'approve',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'Exact human review note'});const result=await f.recovery.inspect(f.candidateId);assert.equal(result.status,'APPROVED');assert.equal(result.decision.reason,'Exact human review note');assert.equal(result.decision.confirmClaimsAndCopy,true);const filename=path.join(f.configDir,'source-approvals.json'),overlay=JSON.parse(await readFile(filename,'utf8'));overlay.approvals[0].source.selectors[0].kind='capability';await writeFile(filename,JSON.stringify(overlay));await assert.rejects(()=>readSourceApprovals(f.configDir),/differs from reviewed immutable package/);}finally{await rm(f.root,{recursive:true,force:true});}});

test('oversized candidate cannot be approved into the smaller trusted registry',async()=>{const f=await fixture();try{const filename=path.join(f.dataDir,'source-recovery/candidates',f.candidateId+'.json'),candidate=JSON.parse(await readFile(filename,'utf8'));candidate.risks.push('x'.repeat(256*1024));await writeFile(filename,JSON.stringify(candidate));await assert.rejects(()=>f.recovery.inspect(f.candidateId),/bounded regular/);assert.deepEqual(await readSourceApprovals(f.configDir),[]);}finally{await rm(f.root,{recursive:true,force:true});}});


test('changed implementation origin after approval blocks future source use',async()=>{const f=await fixture();try{await f.recovery.decide(f.candidateId,'approve',{sha256:f.candidateSha,confirmClaimsAndCopy:true,reason:'reviewed'});await writeFile(path.join(f.repo,'PRODUCT.md'),'Product has changed.\n');await assert.rejects(()=>readSourceApprovals(f.configDir),/origin changed/);}finally{await rm(f.root,{recursive:true,force:true});}});

test('a separately reviewed amendment preserves prior approved content and appends provenance',async()=>{const f=await fixture();try{
 const directory=path.join(f.dataDir,'source-recovery/candidates'),file=path.join(directory,f.candidateId+'.json'),first=JSON.parse(await readFile(file,'utf8'));first.profile.approvedContent=[{id:'reviewed-fixture-first',topic:'First fixture note',title:'First note',hook:'First hook',body:'First body',cta:first.profile.cta,source:'Pending source review: first fixture'}];const firstBytes=JSON.stringify(first);await writeFile(file,firstBytes);await f.recovery.decide(f.candidateId,'approve',{sha256:sha(firstBytes),confirmClaimsAndCopy:true,reason:'First explicit review'});
 const prior=(await readSourceApprovals(f.configDir))[0]!,second={...first,id:f.candidateId+'-v2',profile:structuredClone(prior.profile)},secondFile=path.join(directory,second.id+'.json');second.profile.approvedContent=[];let bytes=JSON.stringify(second);await writeFile(secondFile,bytes);await assert.rejects(()=>f.recovery.decide(second.id,'approve',{sha256:sha(bytes),confirmClaimsAndCopy:true,reason:'Attempted replacement'}),/preserve existing approved CTA and content/);assert.equal((await readSourceApprovals(f.configDir)).length,1);
 second.profile=structuredClone(prior.profile);second.profile.approvedContent.push({...second.profile.approvedContent[0],id:'reviewed-fixture-second',topic:'Second fixture note',source:'Pending source review: second fixture'});bytes=JSON.stringify(second);await writeFile(secondFile,bytes);await f.recovery.decide(second.id,'approve',{sha256:sha(bytes),confirmClaimsAndCopy:true,reason:'Explicit additive amendment'});const approvals=await readSourceApprovals(f.configDir);assert.equal(approvals.length,2);assert.deepEqual(approvals[1]!.profile.approvedContent[0],prior.profile.approvedContent[0]);assert.equal(approvals[0]!.candidateSha256,prior.candidateSha256);
 }finally{await rm(f.root,{recursive:true,force:true});}});
