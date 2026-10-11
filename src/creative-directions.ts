import {stableHash,type ProjectProfile,type VideoScript} from './domain.js';
import type {CampaignProposal} from './campaign-domain.js';
import type {ProjectKnowledge} from './knowledge.js';

export type CreativeApproach={version:1;directionId:string;contentBaseId:string;narrative:string;hookStructure:string;visualTreatment:string;evidenceFocusIds:string[]};
export type CreativeBeat={scene:number;purpose:'introduce'|'compare'|'explain'|'connect'|'invite';visual:string;visualType:'typography'|'approved-asset'|'needs-original-art';assetIds:string[];evidenceClaimIds:string[];transition:'cut'|'reveal'|'slide';onScreenText:string[]};
export type CreativePlan={approach:CreativeApproach;concept:string;hook:string;template:'announcement';caption:string;requiredAssets:string[];variants:Array<{scenes:VideoScript['scenes'];storyboard:CreativeBeat[];durationSeconds:number}>;sourceClaimIds:string[];snapshotHash:string};
const roles:Record<string,{narrative:string;layout:'comparison'|'sequence'|'relationship';purpose:'compare'|'explain'|'connect'}>={
 'Word-level change inspection':{narrative:'visual comparison',layout:'comparison',purpose:'compare'},
 'Your manual edits as revisions':{narrative:'user workflow',layout:'sequence',purpose:'explain'},
 'Business purpose in expense entry':{narrative:'user workflow',layout:'sequence',purpose:'explain'},
 'Expense category organization':{narrative:'feature spotlight',layout:'relationship',purpose:'connect'},
 'Independent main-hand and offhand critical hits':{narrative:'visual comparison',layout:'comparison',purpose:'compare'},
 'Skill prerequisites across three branches':{narrative:'progression explanation',layout:'sequence',purpose:'explain'},
 'Discovery-based monster and artifact codex panels':{narrative:'discovery explanation',layout:'relationship',purpose:'connect'},
 'Organizational needs table':{narrative:'workflow explanation',layout:'relationship',purpose:'connect'},
 'Action completion versus need resolution':{narrative:'common misconception',layout:'comparison',purpose:'compare'},
 'Filtering needs by status, kind and unit':{narrative:'user workflow',layout:'sequence',purpose:'explain'},
};
export function creativePlans(profile:ProjectProfile,knowledge:ProjectKnowledge):CreativePlan[]{
 if(knowledge.status!=='COMPLETE'||!profile.enabled||!profile.templates.includes('announcement'))return [];
 return profile.approvedContent.flatMap(c=>{
  const role=roles[c.topic];if(!role||!c.id.startsWith('reviewed-')||!c.lessons?.[0]||!c.lessons[1]||!c.disclaimer||c.title.length>80||c.lessons.some(t=>t.length>80))return [];
  // A finite, purpose-built composition per reviewed feature. No Cartesian product
  // of labels, invented examples, cross-record copy or extra marketing claims.
  const texts=[c.title,c.hook,c.body,c.lessons[0],c.lessons[1],c.disclaimer,profile.cta];
  const claims=texts.map(text=>knowledge.claims.find(claim=>['marketing','demo','capability','cta'].includes(claim.kind)&&claim.text===text));
  if(claims.some(claim=>!claim))return [];
  const unique=[...new Map(claims.map(claim=>[claim!.text,claim!])).values()],ids=(texts:string[])=>unique.filter(claim=>texts.includes(claim.text)).map(claim=>claim.id);
  const directionId='creative-'+stableHash({projectId:profile.id,base:c.id,texts,narrative:role.narrative,layout:role.layout}).slice(0,20);
  const approach:CreativeApproach={version:1,directionId,contentBaseId:c.id,narrative:role.narrative,hookStructure:'direct approved feature opening',visualTreatment:role.layout==='comparison'?'split-screen text comparison':role.layout==='sequence'?'annotated text workflow':'evidence relationship diagram',evidenceFocusIds:ids([c.body,...c.lessons])};
  const variants=[false,true].map(alternate=>{
   const scenes:VideoScript['scenes']=[
    {kind:'hook',headline:c.title,body:c.hook,seconds:4,layout:'headline',displayTexts:[c.title,c.hook],transition:'cut'},
    {kind:'lesson',headline:c.lessons![0]!,body:c.lessons![0]!,seconds:8,layout:role.layout,displayTexts:[c.lessons![0]!,c.lessons![1]!],transition:alternate?'slide':'reveal'},
    {kind:'lesson',headline:c.lessons![1]!,body:c.body,seconds:8,layout:alternate?'relationship':'focus',displayTexts:alternate?[c.lessons![1]!,c.body]:[c.body],transition:alternate?'reveal':'slide'},
    {kind:'cta',headline:c.title,body:profile.cta,seconds:4,layout:'headline',displayTexts:[profile.cta,c.title],transition:'cut'},
   ];
   scenes.forEach(scene=>{scene.disclaimer=c.disclaimer;});
   const storyboard:CreativeBeat[]=scenes.map((scene,i)=>({scene:i+1,purpose:i===0?'introduce':i===1?role.purpose:i===2?'explain':'invite',visual:i===0?'Immediate approved headline at frame zero; brand wordmark and approved subline.':i===3?'Hold exact approved CTA and title; retain the source disclaimer.':scene.layout==='comparison'?'Two equal text panels compare the exact approved statements; this is an explanatory diagram, not recorded product output.':scene.layout==='sequence'?'Two numbered steps connect exact approved statements with an animated line; an explanatory workflow, not a fabricated interface.':scene.layout==='relationship'?'Connected text nodes show the approved relationship; preserve exact wording and the visible source disclaimer.':'A focused approved statement with an accent rule and a readable hold; retain the visible source disclaimer.',visualType:'typography',assetIds:[],evidenceClaimIds:ids([scene.headline,scene.body,scene.disclaimer!,...scene.displayTexts!]),transition:scene.transition!,onScreenText:scene.displayTexts!}));
   return {scenes,storyboard,durationSeconds:24};
  });
  const operational=structuredClone(variants[1]!);operational.scenes[0]!.headline=c.lessons[0];operational.scenes[0]!.displayTexts=[c.lessons[0],c.hook];operational.storyboard[0]!.onScreenText=operational.scenes[0]!.displayTexts!;operational.storyboard[0]!.evidenceClaimIds=ids([c.lessons[0],c.hook,c.disclaimer]);if(c.lessons[0]!==c.title)variants.push(operational);
  if(c.hook.length<=80&&c.hook!==c.title){const opening=structuredClone(variants[1]!);opening.scenes[0]!.headline=c.hook;opening.scenes[0]!.body=c.title;opening.scenes[0]!.displayTexts=[c.hook,c.title];opening.storyboard[0]!.onScreenText=opening.scenes[0]!.displayTexts!;opening.storyboard[0]!.evidenceClaimIds=ids([c.hook,c.title,c.disclaimer]);variants.push(opening);}
  return [{approach,concept:c.topic,hook:c.title,template:'announcement' as const,caption:c.body,requiredAssets:[],variants,sourceClaimIds:unique.map(c=>c.id),snapshotHash:knowledge.snapshotHash}];
 });
}
export function refreshCreativeOptions(plan:CreativePlan,approvedPlan?:CreativePlan){
 if(!approvedPlan||bindingHash(plan.approach)!==bindingHash(approvedPlan.approach)||plan.snapshotHash!==approvedPlan.snapshotHash||bindingHash(plan.sourceClaimIds)!==bindingHash(approvedPlan.sourceClaimIds))return plan;
 const additions=approvedPlan.variants.filter(v=>!plan.variants.some(prior=>bindingHash(prior)===bindingHash(v)));return additions.length?{...plan,variants:[...plan.variants,...additions].slice(0,6)}:plan;
}
export function planAssetBlocker(profile:ProjectProfile,plan:CreativePlan){return profile.restrictions.includes('HUMAN_REQUIRES_GAMEPLAY_FOOTAGE')?'Human-approved gameplay footage and a footage-driven composition remain required.':null;}
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
const bindingHash=(value:unknown)=>stableHash(canonical(value));
export function validateCreativeBinding(proposal:{title:string;category:string;caption:string;creativeApproach?:CreativeApproach;script:VideoScript;storyboard:unknown[];sourceClaimIds:string[];hook:string;contentAngle:string;requiredAssets:string[];durationSeconds:number},plan:CreativePlan){
 const errors:string[]=[];if(proposal.title!==plan.hook||proposal.category!==plan.approach.narrative||proposal.caption!==plan.caption)errors.push('Creative title, category and caption must match the approved-evidence plan');if(bindingHash(proposal.creativeApproach??null)!==bindingHash(plan.approach))errors.push('Creative direction differs from its persisted approved-evidence plan');
 if(proposal.hook!==proposal.script.scenes[0]?.headline)errors.push('Opening hook must match the first render-driving scene; selecting two supported openings does not make them coherent');
 if(proposal.script.template!==plan.template||proposal.contentAngle!==plan.concept||bindingHash(proposal.requiredAssets)!==bindingHash(plan.requiredAssets)||bindingHash(proposal.sourceClaimIds)!==bindingHash(plan.sourceClaimIds))errors.push('Creative plan identity, assets or approved evidence changed');
 if(!plan.variants.some(v=>bindingHash(v.scenes)===bindingHash(proposal.script.scenes)&&bindingHash(v.storyboard)===bindingHash(proposal.storyboard)&&v.durationSeconds===proposal.durationSeconds))errors.push('Storyboard and render-driving scenes must match one supported composition variant');
 return errors;
}

// Select a concrete supported example for a specific visual correction. The
// original candidate and both variants remain available; no factual copy changes.
type VisualChange={id?:string;field:string;weakness:string;correction:string};
export function inspectVisualChanges(changes:VisualChange[]){
 const parsed=changes.flatMap(change=>{
  const match=/^(?:storyboard|script\.scenes)\[([12])\]\.(?:visual|layout)$/.exec(change.field);if(!match)return [];
  const index=Number(match[1]),copy=change.correction.toLowerCase(),mentioned=[...(`${change.weakness} ${change.correction}`).matchAll(/scene\s*(\d+)/gi)].map(m=>Number(m[1]));
  const layouts=(['relationship','comparison','sequence'] as const).filter(layout=>layout==='relationship'?/relationship|connected (?:nodes|text)/.test(copy):layout==='comparison'?/split[- ]screen|comparison/.test(copy):/numbered|sequence/.test(copy));
  const error=mentioned.some(n=>n!==index+1)?'Field index and named scene disagree':layouts.length!==1?'Correction does not identify exactly one supported layout':null;
  return [{change,index,layout:layouts[0],error}];
 });
 const conflicts=new Set(parsed.filter(p=>!p.error&&new Set(parsed.filter(q=>q.index===p.index&&!q.error).map(q=>q.layout)).size>1).map(p=>p.index));for(const request of parsed)if(conflicts.has(request.index))request.error='Conflicting accepted layouts for one scene';
 return {requests:parsed.filter(p=>!p.error&&p.layout).map(p=>({index:p.index,layout:p.layout!,change:p.change})),issues:parsed.filter(p=>p.error).map(p=>({id:p.change.id,field:p.change.field,reason:p.error!}))};
}
function requestedVisual(critique?:{changes:VisualChange[]}){return inspectVisualChanges(critique?.changes??[]).requests;}
export function inspectTimingChanges(changes:VisualChange[]){
 const parsed=changes.flatMap(change=>{const field=/^script\.scenes\[([12])\]\.seconds$/.exec(change.field);if(!field)return [];const index=Number(field[1]),amounts=[...change.correction.matchAll(/(?:to\s+)(\d+)\s*(?:seconds?|s\b)/gi)].map(m=>Number(m[1])),named=[...(`${change.weakness} ${change.correction}`).matchAll(/scene\s*(\d+)/gi)].map(m=>Number(m[1]));return [{index,seconds:amounts[0],change,error:named.some(n=>n!==index+1)?'Field index and named scene disagree':amounts.length!==1||amounts[0]!<4||amounts[0]!>8?'Correction must name one 4–8 second hold':null}];});
 const conflicts=new Set(parsed.filter(p=>!p.error&&new Set(parsed.filter(q=>q.index===p.index&&!q.error).map(q=>q.seconds)).size>1).map(p=>p.index));for(const request of parsed)if(conflicts.has(request.index))request.error='Conflicting durations for one scene';
 return {requests:parsed.filter(p=>!p.error).map(p=>({index:p.index,seconds:p.seconds!,change:p.change})),issues:parsed.filter(p=>p.error).map(p=>({id:p.change.id,field:p.change.field,reason:p.error!}))};
}
export function extendCreativePlan(plan:CreativePlan,critique?:{changes:Array<{field:string;weakness:string;correction:string}>},previousScenes?:VideoScript['scenes']):CreativePlan{
 const requests=requestedVisual(critique),timing=inspectTimingChanges(critique?.changes??[]).requests;if((!requests.length&&!timing.length)||plan.variants.length>=6)return plan;
 const base=timing.length?creativeExample(plan,previousScenes,critique):plan.variants.find(v=>previousScenes&&bindingHash(v.scenes)===bindingHash(previousScenes))??plan.variants.at(-1)!,variant=structuredClone(base);
 for(const {index,layout}of requests){const scene=variant.scenes[index]!,beat=variant.storyboard[index]!;if(!scene.displayTexts||scene.displayTexts.length!==2)continue;scene.layout=layout;beat.purpose=layout==='comparison'?'compare':layout==='relationship'?'connect':'explain';beat.visual=layout==='comparison'?'Two equal text panels compare the exact approved statements; this is an explanatory diagram, not recorded product output.':layout==='relationship'?'Connected text nodes show the approved relationship; preserve exact wording and the visible source disclaimer.':'Two numbered steps connect exact approved statements with an animated line; an explanatory workflow, not a fabricated interface.';}
 for(const {index,seconds}of timing)variant.scenes[index]!.seconds=seconds;variant.durationSeconds=variant.scenes.reduce((sum,s)=>sum+s.seconds,0);if(variant.durationSeconds<15||variant.durationSeconds>35||plan.variants.some(v=>bindingHash(v)===bindingHash(variant)))return plan;
 return {...plan,variants:[...plan.variants,variant]};
}
export function creativeExample(plan:CreativePlan,previousScenes?:VideoScript['scenes'],critique?:{changes:Array<{field:string;weakness:string;correction:string}>}){
 const opening=critique?.changes.find(c=>/^(hook|script\.scenes\[0\]\.(headline|body))$/.test(c.field)),requests=requestedVisual(critique),timing=inspectTimingChanges(critique?.changes??[]).requests,supportedOpening=opening?plan.variants.filter(v=>opening.correction.includes(v.scenes[0]!.headline)):[],matches=(v:CreativePlan['variants'][number])=>requests.every(r=>v.scenes[r.index]?.layout===r.layout)&&timing.every(r=>v.scenes[r.index]?.seconds===r.seconds);
 if(opening&&supportedOpening.length){const match=supportedOpening.find(matches);if(match)return match;return supportedOpening[0]!;}
 if(requests.length||timing.length){const match=plan.variants.find(matches);if(match)return match;}
 if(previousScenes)return plan.variants.find(v=>bindingHash(v.scenes)===bindingHash(previousScenes))??plan.variants[0]!;
 const operational=plan.variants.at(-1)!;return operational.scenes[0]!.headline!==operational.scenes[0]!.disclaimer?operational:plan.variants[0]!;
}

export function compileAcceptedVisualChanges(plan:CreativePlan,proposal:CampaignProposal,critique:{changes:Array<{id:string;field:string;weakness:string;correction:string}>}){
 if(validateCreativeBinding(proposal,plan).length)return null;
 const accepted=critique.changes.filter(c=>proposal.acceptedChanges.includes(c.id)),requests=inspectVisualChanges(accepted).requests,changes=requests.map(r=>r.change),extended=extendCreativePlan(plan,{changes},proposal.script.scenes);
 if(extended===plan)return null;const variant=extended.variants.at(-1)!;
 return {plan:extended,proposal:{...proposal,script:{...proposal.script,scenes:variant.scenes},storyboard:variant.storyboard},acceptedChangeIds:requests.filter(r=>variant.scenes[r.index]?.layout===r.layout&&proposal.script.scenes[r.index]?.layout!==r.layout).map(r=>r.change.id!)};
}


// Compile only independently supported pieces into the storyboard that actually
// describes the selected renderer. Never repair invented copy, assets or directions.
export function assembleCreativeStoryboard(proposal:CampaignProposal,plan:CreativePlan){
 const matches=plan.variants.filter(v=>bindingHash(v.scenes)===bindingHash(proposal.script.scenes)&&v.durationSeconds===proposal.durationSeconds);if(new Set(matches.map(v=>bindingHash(v.storyboard))).size>1)return null;const variant=matches[0];
 const rawMatches=plan.variants.map((v,index)=>({v,index})).filter(({v})=>bindingHash(v.storyboard)===bindingHash(proposal.storyboard));
 if(!variant||bindingHash(variant.storyboard)===bindingHash(proposal.storyboard)||rawMatches.length!==1)return null;
 const assembled={...proposal,storyboard:structuredClone(variant.storyboard)};return validateCreativeBinding(assembled,plan).length?null:{proposal:assembled,variantIndex:plan.variants.indexOf(variant),rawStoryboardVariantIndex:rawMatches[0]!.index};
}

export function creativeIdentityHash(plan:CreativePlan){return bindingHash({...plan,variants:[]});}
