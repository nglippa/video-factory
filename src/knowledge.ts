import {lstat,open,readFile,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {CONFIG_DIR,ROOT_DIR,loadProfile} from './config.js';

import {kindSchema,knowledgeSourceSchema,knowledgeRegistrySchema} from './knowledge-schema.js';
export {knowledgeSourceSchema,knowledgeRegistrySchema} from './knowledge-schema.js';
import {readSourceApprovals} from './source-recovery.js';
export type KnowledgeClaim={id:string;projectId:string;kind:z.infer<typeof kindSchema>;sourceId:string;path:string;locator:string;sha256:string;text:string};
export type ProjectKnowledge={projectId:string;status:'COMPLETE'|'INCOMPLETE';scope:string;refreshReasons:string[];claims:KnowledgeClaim[];description:string[];audience:string[];verifiedCapabilities:string[];approvedMarketing:string[];prohibitedClaims:string[];voice:string[];assets:string[];templates:string[];ctas:string[];snapshotHash:string;refreshedAt:string};
const denied=/(^|\/)(?:\.env(?:\.|$)|credentials?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|customers?(?:[-_.][^/]*)?|private(?:[-_.][^/]*)?)(?:\/|$)/i;
function pointer(value:unknown,raw:string){return raw.slice(1).split('/').map(v=>v.replace(/~1/g,'/').replace(/~0/g,'~')).reduce<unknown>((current,key)=>{if(Array.isArray(current))return /^\d+$/.test(key)?current[Number(key)]:undefined;if(current&&typeof current==='object'&&Object.prototype.hasOwnProperty.call(current,key))return (current as Record<string,unknown>)[key];return undefined;},value);}
function scalar(value:unknown){if(typeof value!=='string'||!value.trim())throw new Error('Knowledge selector must resolve to nonempty exact text');return value;}
export class KnowledgeRegistry{
  constructor(readonly root=ROOT_DIR,readonly registryFile=path.join(CONFIG_DIR,'knowledge.json'),readonly profileLoader=loadProfile){}
  private async config(){const config=knowledgeRegistrySchema.parse(JSON.parse(await readFile(this.registryFile,'utf8')));for(const approval of await readSourceApprovals(path.dirname(this.registryFile))){config.sources.push(approval.source);const project=config.projects.find(p=>p.id===approval.profile.id);if(!project)throw new Error('Approved source references unknown project');project.enabled=true;project.scope=approval.scope;}const unique=(values:string[],label:string)=>{if(new Set(values).size!==values.length)throw new Error(label+' must be unique');};unique(config.sources.map(v=>v.id),'Knowledge source IDs');unique(config.projects.map(v=>v.id),'Knowledge project IDs');unique(config.sources.flatMap(v=>v.selectors.map(s=>s.claimId)),'Knowledge claim IDs');const projects=new Set(config.projects.map(v=>v.id));if(config.sources.some(source=>source.selectors.some(selector=>!projects.has(selector.projectId))))throw new Error('Knowledge selector references unknown project');return config;}
  async list(){return (await this.config()).projects;}
  private async safeRead(relative:string){
    if(path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..')||relative.split(/[\\/]/).some(part=>part.startsWith('.'))||denied.test(relative))throw new Error('Knowledge source path is denied');
    if(!/\.(?:json|md)$/i.test(relative))throw new Error('Knowledge sources must be JSON or Markdown');
    const target=path.resolve(this.root,relative),rootReal=await realpath(this.root),targetReal=await realpath(target);if(targetReal!==path.join(rootReal,path.relative(this.root,target))||!targetReal.startsWith(rootReal+path.sep))throw new Error('Knowledge source escapes workspace or uses a symlink');
    const checked=await lstat(target);if(!checked.isFile()||checked.isSymbolicLink()||checked.nlink!==1)throw new Error('Knowledge source must be one regular non-hardlinked file');if(checked.size>256*1024)throw new Error('Knowledge source exceeds 256KB');
    const handle=await open(target,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await handle.stat();if(!stat.isFile()||stat.nlink!==1||stat.dev!==checked.dev||stat.ino!==checked.ino||stat.size>256*1024)throw new Error('Knowledge source changed during secure open');const data=await handle.readFile();return {text:data.toString('utf8'),sha256:createHash('sha256').update(data).digest('hex')};}finally{await handle.close();}
  }
  private extract(source:z.infer<typeof knowledgeSourceSchema>,file:{text:string;sha256:string}){if(file.sha256!==source.reviewedSha256)throw new Error('Knowledge source changed since operator review: '+source.id);const json=/\.json$/i.test(source.path)?JSON.parse(file.text):undefined,lines=file.text.split(/\r?\n/);return source.selectors.map(selector=>{if(selector.lines&&(selector.lines[0]>selector.lines[1]||selector.lines[1]>lines.length))throw new Error('Markdown line range is outside reviewed source');const text=selector.pointer?scalar(pointer(json,selector.pointer)):lines.slice(selector.lines![0]-1,selector.lines![1]).join('\n').trim();if(!text)throw new Error('Knowledge selector produced empty text');return {id:selector.claimId,projectId:selector.projectId,kind:selector.kind,sourceId:source.id,path:source.path,locator:selector.pointer??`lines:${selector.lines![0]}-${selector.lines![1]}`,sha256:file.sha256,text} satisfies KnowledgeClaim;});}
  async inspectSource(sourceId:string){const config=await this.config(),source=config.sources.find(v=>v.id===sourceId);if(!source)throw new Error('Unknown knowledge source');const file=await this.safeRead(source.path);return {sourceId:source.id,path:source.path,category:source.category,sha256:file.sha256,claims:this.extract(source,file)};}
  async registerSource(value:unknown){const source=knowledgeSourceSchema.parse(value),file=await this.safeRead(source.path);if(file.sha256!==source.reviewedSha256)throw new Error('Reviewed source hash does not match exact file bytes');this.extract(source,file);return source;}
  async refresh(){
    const config=await this.config(),claims:KnowledgeClaim[]=[],failures=new Map<string,string[]>();
    for(const source of config.sources){try{claims.push(...this.extract(source,await this.safeRead(source.path)));}catch(error){for(const projectId of new Set(source.selectors.map(v=>v.projectId)))failures.set(projectId,[...(failures.get(projectId)??[]),error instanceof Error?error.message:String(error)]);}}
    return Promise.all(config.projects.map(async project=>{const selected=claims.filter(c=>c.projectId===project.id),by=(kind:KnowledgeClaim['kind'])=>selected.filter(c=>c.kind===kind).map(c=>c.text),refreshReasons=failures.get(project.id)??[];let enabled=false;try{enabled=(await this.profileLoader(project.id)).enabled;}catch{/* incomplete profile */}const complete=!refreshReasons.length&&project.enabled&&enabled&&by('description').length>0&&by('audience').length>0&&(by('marketing').length+by('demo').length+by('capability').length)>0&&by('cta').length>0&&by('template').length>0;return {projectId:project.id,status:complete?'COMPLETE':'INCOMPLETE',scope:project.scope,refreshReasons,claims:selected,description:by('description'),audience:by('audience'),verifiedCapabilities:by('capability'),approvedMarketing:[...by('marketing'),...by('demo'),...by('capability')],prohibitedClaims:by('prohibited'),voice:by('voice'),assets:by('asset'),templates:by('template'),ctas:by('cta'),snapshotHash:createHash('sha256').update(JSON.stringify({project,complete,claims:selected.map(c=>[c.id,c.kind,c.sourceId,c.path,c.locator,c.sha256,c.text])})).digest('hex'),refreshedAt:new Date().toISOString()} satisfies ProjectKnowledge;}));
  }
  async load(projectId:string){const found=(await this.refresh()).find(project=>project.projectId===projectId);if(!found)throw new Error('Unknown knowledge project: '+projectId);return found;}
}
export const loadKnowledge=(projectId:string)=>new KnowledgeRegistry().load(projectId);
export {KnowledgeRegistry as SourceRegistry};

// Additions are allowed only while every originally reviewed claim remains byte-identical.
export function assertKnowledgeStillApproved(snapshot:ProjectKnowledge,current:ProjectKnowledge){
  if(snapshot.projectId!==current.projectId||current.status!=='COMPLETE'||snapshot.status!=='COMPLETE'||snapshot.claims.some(old=>!current.claims.some(now=>JSON.stringify(old)===JSON.stringify(now))))throw new Error('Source snapshot changed; approval blocked');
}
