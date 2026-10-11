import {z} from 'zod';

const text=z.string().trim().min(1).max(600);
const scoresSchema=z.object({hook:z.number().min(1).max(5),audience:z.number().min(1).max(5),distinctiveness:z.number().min(1).max(5),evidence:z.number().min(1).max(5),feasibility:z.number().min(1).max(5),brand:z.number().min(1).max(5)}).strict();
const correctionSchema=z.object({id:z.string().trim().min(1).max(80),field:z.string().trim().min(1).max(120),defect:text.max(240),correction:text.max(300)}).strict();

export const structuredEditorialReviewSchema=z.object({
  decision:z.enum(['ACCEPT','REVISE','RETAIN_PREVIOUS','ABSTAIN']),
  candidateId:z.string().trim().min(1).max(240),
  reasoning:text,
  evidence:z.array(z.object({reference:z.string().trim().min(1).max(160),observation:text.max(300)}).strict()).max(6),
  corrections:z.array(correctionSchema).max(3),
  provenance:z.object({reviewedProposalHash:z.string().min(8).max(128),sourceSnapshotHash:z.string().min(8).max(128),priorProposalHash:z.string().min(8).max(128).nullable()}).strict(),
  validation:z.object({candidateValid:z.boolean(),unsupportedClaims:z.array(text).max(8)}).strict(),
  scores:scoresSchema
}).strict();

const legacyReviewSchema=z.object({verdict:z.enum(['PASS','REVISE','BLOCK']),scores:scoresSchema,notes:z.array(text).min(1).max(8),changes:z.array(z.object({id:z.string(),field:text.max(80),weakness:text,correction:text}).strict()).max(6),unsupportedClaims:z.array(text).max(8)}).strict();
export const editorialReviewInputSchema=z.union([structuredEditorialReviewSchema,legacyReviewSchema]);

export type StructuredEditorialReview=z.infer<typeof structuredEditorialReviewSchema>;
export type LegacyEditorialReview=z.infer<typeof legacyReviewSchema>;
export type EditorialReview=StructuredEditorialReview & {
  verdict:'PASS'|'REVISE'|'BLOCK';
  notes:string[];
  changes:Array<{id:string;field:string;weakness:string;correction:string}>;
  legacyAdapted:boolean;
};
export type EditorialDecisionAssessment={decision:StructuredEditorialReview['decision'];actionableRevision:boolean;terminal:boolean;reason:string;candidateId:string;reviewedProposalHash:string;sourceSnapshotHash:string;priorProposalHash:string|null;legacyAdapted:boolean};

export type EditorialParseContext={candidateId:string;reviewedProposalHash:string;sourceSnapshotHash:string;priorProposalHash?:string|null;candidateValid:boolean};

const supportedField=/^(title|category|caption|hook|hashtags(?:\[\d+\])?|script\.scenes\[\d+\]\.(?:headline|body|layout|transition|seconds)|storyboard\[\d+\]\.(?:visual|transition))$/;
const genericOnly=/^(?:make it|needs? to be|more|less|improve|stronger|better|weaker|unclear|boring|generic|awkward|plain|punchier|engaging|creative|polished|dynamic|interesting|natural|specific)(?:[\s.!-]+(?:more|less|better|stronger|clearer|engaging|creative|polished|dynamic|interesting|natural|specific))*[\s.!]*$/i;
const genericPhrase=/\b(?:make (?:this|the (?:video|hook|scene|copy)) more engaging|improve the hook|more (?:engaging|creative|dynamic|interesting|polished|specific)|make it (?:better|stronger|punchier))\b/i;
const concreteAction=/['“”"].+['“”"]|\b(?:\d+(?:\.\d+)?\s*(?:seconds?|s)|layout|transition|cut|reveal|slide|replace .+ with .+|scene \d+)\b/i;

export function isSpecificEditorialCorrection(change:{field:string;defect?:string;weakness?:string;correction:string}){
  const defect=(change.defect??change.weakness??'').trim(),correction=change.correction.trim();
  return supportedField.test(change.field)&&defect.length>=12&&correction.length>=12&&!genericOnly.test(defect)&&!genericOnly.test(correction)&&(!genericPhrase.test(correction)||concreteAction.test(correction))&&defect.toLowerCase()!==correction.toLowerCase();
}

export function parseEditorialReview(raw:unknown,context:EditorialParseContext):EditorialReview{
  const parsed=editorialReviewInputSchema.parse(raw);
  if('decision' in parsed){
    if(parsed.candidateId!==context.candidateId)throw new Error('Editorial candidate ID differs from the reviewed proposal');
    if(parsed.provenance.reviewedProposalHash!==context.reviewedProposalHash||parsed.provenance.sourceSnapshotHash!==context.sourceSnapshotHash||parsed.provenance.priorProposalHash!==(context.priorProposalHash??null))throw new Error('Editorial provenance differs from the submitted candidate');
    if(parsed.validation.candidateValid!==context.candidateValid)throw new Error('Editorial validation acknowledgement differs from deterministic validation');
    return {...parsed,verdict:parsed.decision==='ACCEPT'?'PASS':parsed.decision==='REVISE'?'REVISE':'BLOCK',notes:[parsed.reasoning,...parsed.evidence.map(item=>item.observation)].slice(0,8),changes:parsed.corrections.map(item=>({id:item.id,field:item.field,weakness:item.defect,correction:item.correction})),legacyAdapted:false};
  }
  const decision=parsed.verdict==='PASS'?'ACCEPT':parsed.verdict==='REVISE'?'REVISE':'ABSTAIN';
  return {decision,candidateId:context.candidateId,reasoning:'Legacy review adaptation: '+parsed.notes.join(' '),evidence:[...parsed.changes.map(item=>({reference:item.field,observation:'Legacy review adaptation: '+item.weakness+' Correction: '+item.correction})),...parsed.notes.map((observation,index)=>({reference:'legacy-note-'+(index+1),observation}))],corrections:parsed.changes.map(item=>({id:item.id,field:item.field,defect:item.weakness,correction:item.correction})),provenance:{reviewedProposalHash:context.reviewedProposalHash,sourceSnapshotHash:context.sourceSnapshotHash,priorProposalHash:context.priorProposalHash??null},validation:{candidateValid:context.candidateValid,unsupportedClaims:parsed.unsupportedClaims},scores:parsed.scores,verdict:parsed.verdict,notes:parsed.notes,changes:parsed.changes,legacyAdapted:true};
}

export function assessEditorialDecision(review:EditorialReview):EditorialDecisionAssessment{
  const cited=new Set(review.evidence.map(item=>item.reference));
  const actionableRevision=review.decision==='REVISE'&&review.validation.unsupportedClaims.length===0&&review.corrections.some(change=>isSpecificEditorialCorrection(change)&&[change.field,'candidate','scene'].some(reference=>[...cited].some(value=>value===reference||value.startsWith(reference+':'))));
  const reason=review.decision==='REVISE'&&!actionableRevision?'Revision feedback lacked a supported field, concrete defect, and concrete correction':review.reasoning;
  return {decision:review.decision,actionableRevision,terminal:review.decision==='ABSTAIN'||review.decision==='RETAIN_PREVIOUS'||review.decision==='REVISE'&&!actionableRevision,reason,candidateId:review.candidateId,reviewedProposalHash:review.provenance.reviewedProposalHash,sourceSnapshotHash:review.provenance.sourceSnapshotHash,priorProposalHash:review.provenance.priorProposalHash,legacyAdapted:review.legacyAdapted};
}

function field(value:unknown,name:string){if(!supportedField.test(name))return undefined;let result:any=value;for(const part of name.replace(/\[(\d+)\]/g,'.$1').split('.')){if(result===null||typeof result!=='object'||!Object.hasOwn(result,part))return undefined;result=result[part];}return result;}

export function revisionMeaningfullyAddresses(previous:unknown,candidate:unknown,review:EditorialReview){
  if(JSON.stringify(previous)===JSON.stringify(candidate))return false;
  return review.corrections.filter(isSpecificEditorialCorrection).some(change=>{const before=field(previous,change.field),after=field(candidate,change.field);return before!==undefined&&after!==undefined&&JSON.stringify(before)!==JSON.stringify(after);});
}

export function editorialReviewJsonSchema(){return z.toJSONSchema(structuredEditorialReviewSchema);}

// Exact data differences are comparison evidence, never a creative-quality score.
export function exactEditorialChanges(before:unknown,after:unknown,field=''):Array<{field:string;before:unknown;after:unknown}>{
  if(JSON.stringify(before)===JSON.stringify(after))return [];
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&Array.isArray(before)===Array.isArray(after)){
    const keys=new Set([...Object.keys(before),...Object.keys(after)]);
    return [...keys].flatMap(key=>exactEditorialChanges((before as Record<string,unknown>)[key],(after as Record<string,unknown>)[key],Array.isArray(before)?field+'['+key+']':field?field+'.'+key:key));
  }
  return [{field,before:before??null,after:after??null}];
}
