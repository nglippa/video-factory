import {constants} from 'node:fs';
import {lstat,open,readFile,readdir,realpath,mkdir,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {projectProfileSchema} from './domain.js';
import {kindSchema,knowledgeSourceSchema} from './knowledge-schema.js';
const hash=(bytes:string|Buffer)=>createHash('sha256').update(bytes).digest('hex');
const id=z.string().regex(/^[a-z0-9-]+$/),sha=z.string().regex(/^[a-f0-9]{64}$/);
export const sourceCandidateSchema=z.object({version:z.literal(1),id,projectId:id,createdAt:z.iso.datetime(),scope:z.string().min(1),baseProfileSha256:sha,identity:z.string().min(1),documents:z.array(z.object({repository:z.string(),path:z.string(),sha256:sha,modifiedAt:z.iso.datetime(),bytes:z.number().int().positive()}).strict()).min(1),claims:z.array(z.object({kind:kindSchema,text:z.string().trim().min(1),support:z.array(z.object({document:z.number().int().nonnegative(),lines:z.tuple([z.number().int().positive(),z.number().int().positive()]),excerpt:z.string().min(1)}).strict()).min(1),verification:z.enum(['SOURCE_CODE_VERIFIED','DOCUMENTED','EDITORIAL_COPY','BRAND_REVIEW_REQUIRED']),risk:z.string()}).strict()).min(1),assets:z.array(z.object({path:z.string(),status:z.string(),notes:z.string()}).strict()),risks:z.array(z.string()).min(1),profile:projectProfileSchema}).strict().refine(c=>c.profile.id===c.projectId&&c.profile.enabled&&c.claims.every(claim=>claim.support.every(s=>s.document<c.documents.length)),'Candidate project or supporting document differs');
export type SourceCandidate=z.infer<typeof sourceCandidateSchema>;
const approvalSchema=z.object({candidateId:id,candidateSha256:sha,approvedAt:z.iso.datetime(),actor:z.literal('local-human'),reason:z.string().trim().min(1).max(1000),confirmClaimsAndCopy:z.literal(true),baseProfileSha256:sha,scope:z.string(),profile:projectProfileSchema,source:knowledgeSourceSchema}).strict();
const overlaySchema=z.object({version:z.literal(1),approvals:z.array(approvalSchema)}).strict();
function approvedProfile(candidate:SourceCandidate){return {...candidate.profile,approvedContent:candidate.profile.approvedContent.map(c=>c.source.startsWith('Pending source review: ')?{...c,source:'Human-approved source recovery package '+candidate.id}:c)};}
function candidateSource(candidate:SourceCandidate,relative:string,candidateHash:string){return knowledgeSourceSchema.parse({id:'recovery-'+candidate.id,path:relative,category:'feature-doc',reviewed:true,reviewedSha256:candidateHash,selectors:candidate.claims.map((c,i)=>({claimId:'recovery-'+candidate.id+'-'+i,projectId:candidate.projectId,kind:c.kind,pointer:'/claims/'+i+'/text'}))});}
export async function readSourceApprovals(configDir:string){
 const filename=path.join(configDir,'source-approvals.json');if(!(await fileExists(filename)))return [];
 const overlay=overlaySchema.parse(JSON.parse(await readFile(filename,'utf8')));
 if(new Set(overlay.approvals.map(a=>a.candidateId)).size!==overlay.approvals.length)throw new Error('Duplicate source approval candidate');
 const root=path.dirname(configDir);
 for(const a of overlay.approvals){
  const base=await readFile(path.join(configDir,'projects',a.profile.id+'.json'));if(hash(base)!==a.baseProfileSha256)throw new Error('Base project profile changed after source approval: '+a.profile.id);
  const file=path.resolve(root,a.source.path),canonical=await realpath(file),rootReal=await realpath(root),stat=await lstat(file);if(canonical!==path.join(rootReal,path.relative(root,file))||!canonical.startsWith(rootReal+path.sep)||!stat.isFile()||stat.nlink!==1||stat.size>256*1024)throw new Error('Approved source storage is unsafe or exceeds 256KB');
  const bytes=await readFile(file),candidate=sourceCandidateSchema.parse(JSON.parse(bytes.toString('utf8')));
  const relative=path.relative(root,file),expected=candidateSource(candidate,relative,a.candidateSha256);
  if(hash(bytes)!==a.candidateSha256||candidate.id!==a.candidateId||candidate.baseProfileSha256!==a.baseProfileSha256||candidate.scope!==a.scope||JSON.stringify(expected)!==JSON.stringify(a.source)||JSON.stringify(approvedProfile(candidate))!==JSON.stringify(a.profile))throw new Error('Approval differs from reviewed immutable package');
  await new SourceRecovery(root,configDir,path.join(root,'data'),path.dirname(candidate.documents[0]!.repository)).verifyCandidateOrigins(candidate);
 }
 return overlay.approvals;
}
async function durableWrite(file:string,bytes:string|Buffer){const handle=await open(file,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}}
async function atomicJson(file:string,value:unknown){const temporary=file+'.tmp-'+randomUUID();await durableWrite(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,file);const directory=await open(path.dirname(file),'r');try{await directory.sync();}finally{await directory.close();}}
async function fileExists(file:string){try{await lstat(file);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
export const sourceDecisionSchema=z.object({sha256:sha,confirmClaimsAndCopy:z.literal(true),reason:z.string().trim().min(1).max(1000)}).strict();
// Only these product/code documents may be read on approval. No arbitrary repository paths.
const allowed:Record<string,{repo:string;files:string[]}>= {
  'terra-steam-tycoon':{repo:'steam-tycoon',files:['PRODUCT.md','README.md','src/main.ts','src/game/city.ts','src/game/economy.ts']},
  'angband':{repo:'wand-or-steel',files:['PRODUCT.md','README.md','docs/product-architecture.md','docs/critical-hit-foundation.md','docs/visual-identity.md','src/components/TitleScreenTransition.tsx','src/game/systems/CombatSystem.ts','src/data/generalSkillTree.ts','src/game/ui/UiPanelSystem.ts']},
  'find-my-needs':{repo:'Find-My-Needs',files:['PRODUCT.md','README.md','src/App.tsx','src/pages/NeedsPage.tsx','src/pages/NeedDetailPage.tsx','src/pages/PlanPage.tsx']},
  'whodunnit':{repo:'Whodunnit',files:['README.md','src/features/comparison/ChangesView.tsx','src/lib/reconstruction/pipeline.ts','src/features/reconstruction/useWorkspace.ts']},
  'gigwise':{repo:'GigWise',files:['docs/product-architecture.md','components/gigwise-app.tsx','components/mileage/ManualMileageForm.tsx','components/mileage/RecentMileageTrips.tsx']}
};
export class SourceRecovery {
  readonly directory:string;
  constructor(readonly root:string,readonly configDir:string,readonly dataDir:string,readonly projectsDir=path.dirname(root)){this.directory=path.join(dataDir,'source-recovery');}
  private candidatePath(candidateId:string){return path.join(this.directory,'candidates',id.parse(candidateId)+'.json');}
  private async safeBytes(file:string,boundary:string,maximum=512*1024){const root=await realpath(boundary),canonical=await realpath(file);if(canonical!==path.join(root,path.relative(boundary,file))||!canonical.startsWith(root+path.sep))throw new Error('Source path escapes boundary or uses a symlink');const before=await lstat(file);if(!before.isFile()||before.nlink!==1||before.size>maximum)throw new Error('Source must be a bounded regular non-hardlinked file');const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await handle.stat();if(stat.ino!==before.ino||stat.dev!==before.dev||stat.size>maximum||stat.nlink!==1)throw new Error('Source changed during secure open');return await handle.readFile();}finally{await handle.close();}}
  async inspect(candidateId:string){const bytes=await this.safeBytes(this.candidatePath(candidateId),this.directory,256*1024),candidate=sourceCandidateSchema.parse(JSON.parse(bytes.toString('utf8')));if(candidate.id!==candidateId)throw new Error('Candidate identity differs');const approvals=await readSourceApprovals(this.configDir),approval=approvals.find(a=>a.candidateId===candidateId);let decision=null;try{decision=JSON.parse(await readFile(path.join(this.directory,'decisions',candidateId+'.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}return {candidate,sha256:hash(bytes),status:approval?'APPROVED':decision?.status==='REJECTED'?'REJECTED':'PENDING_APPROVAL',decision:approval??decision};}
  async list(){let files:string[];try{files=await readdir(path.join(this.directory,'candidates'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e;}return Promise.all(files.filter(f=>/^[a-z0-9-]+\.json$/.test(f)).sort().map(f=>this.inspect(f.slice(0,-5))));}
  async verifyCandidateOrigins(candidate:SourceCandidate){const policy=allowed[candidate.projectId];if(!policy)throw new Error('Unknown source project');const repo=path.join(this.projectsDir,policy.repo);for(const doc of candidate.documents){if(doc.repository!==repo||!policy.files.includes(doc.path))throw new Error('Source document is outside approved discovery scope');const bytes=await this.safeBytes(path.join(repo,doc.path),repo);if(hash(bytes)!==doc.sha256)throw new Error('Candidate origin changed; prepare a new review package: '+doc.path);}
    for(const claim of candidate.claims)for(const s of claim.support){const doc=candidate.documents[s.document]!,bytes=await this.safeBytes(path.join(repo,doc.path),repo),lines=bytes.toString('utf8').split(/\r?\n/);if(s.lines[0]>s.lines[1]||s.lines[1]>lines.length||lines.slice(s.lines[0]-1,s.lines[1]).join('\n').trim()!==s.excerpt.trim())throw new Error('Supporting excerpt differs from origin');}
  }
  async decide(candidateId:string,action:'approve'|'reject',input:unknown){const body=sourceDecisionSchema.parse(input);await mkdir(this.directory,{recursive:true});const lock=path.join(this.directory,'approval.lock');const handle=await open(lock,'wx',0o600).catch(()=>{throw new Error('Source approval busy or interrupted; inspect approval.lock before safe recovery');});try{
    const reviewed=await this.inspect(candidateId);if(body.sha256!==reviewed.sha256)throw new Error('Candidate changed since review');if(reviewed.status!=='PENDING_APPROVAL')throw new Error('Source has already been decided');
    await mkdir(path.join(this.directory,'decisions'),{recursive:true});const candidate=reviewed.candidate;
    if(action==='approve'){
      await this.verifyCandidateOrigins(candidate);const base=await readFile(path.join(this.configDir,'projects',candidate.projectId+'.json'));if(hash(base)!==candidate.baseProfileSha256)throw new Error('Base profile changed since candidate preparation');const approvals=await readSourceApprovals(this.configDir),baseProfile=approvals.filter(a=>a.profile.id===candidate.projectId).at(-1)?.profile??projectProfileSchema.parse(JSON.parse(base.toString('utf8')));
      // Additive approval cannot silently replace established brand/CTA/content or claims.
      if(baseProfile.approvedContent.some(c=>!candidate.profile.approvedContent.some(n=>JSON.stringify(c)===JSON.stringify(n)))||((baseProfile.enabled||baseProfile.approvedContent.length>0)&&candidate.profile.cta!==baseProfile.cta))throw new Error('Source approval must preserve existing approved CTA and content');
      if(baseProfile.enabled&&(['name','colors','typography','logo','assetDirectories','output'] as const).some(key=>JSON.stringify(baseProfile[key])!==JSON.stringify(candidate.profile[key])))throw new Error('Source recovery must preserve established brand fields');
      const destination=path.join(this.directory,'approved',candidateId+'.json');await mkdir(path.dirname(destination),{recursive:true});const bytes=await this.safeBytes(this.candidatePath(candidateId),this.directory,256*1024);if(hash(bytes)!==body.sha256)throw new Error('Candidate changed during approval');try{await durableWrite(destination,bytes);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST'||hash(await this.safeBytes(destination,this.directory))!==body.sha256)throw e;}
      const relative=path.relative(this.root,destination);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Approved source storage must be inside Factory workspace');const source=candidateSource(candidate,relative,body.sha256);
      const approval=approvalSchema.parse({candidateId,candidateSha256:body.sha256,approvedAt:new Date().toISOString(),actor:'local-human',reason:body.reason,confirmClaimsAndCopy:true,baseProfileSha256:candidate.baseProfileSha256,scope:candidate.scope,profile:approvedProfile(candidate),source});const file=path.join(this.configDir,'source-approvals.json');await atomicJson(file,{version:1,approvals:[...approvals,approval]});
    }
    if(action==='reject')await durableWrite(path.join(this.directory,'decisions',candidateId+'.json'),JSON.stringify({status:'REJECTED',candidateSha256:body.sha256,reason:body.reason,actor:'local-human',at:new Date().toISOString()},null,2)+'\n');return this.inspect(candidateId);
  }finally{await handle.close();await unlink(lock);}}
}
