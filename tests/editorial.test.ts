import test from 'node:test';
import assert from 'node:assert/strict';
import {assessEditorialDecision,isSpecificEditorialCorrection,parseEditorialReview,revisionMeaningfullyAddresses,structuredEditorialReviewSchema} from '../src/editorial.js';

const context={candidateId:'campaign-slot-01',reviewedProposalHash:'candidate-hash-123',sourceSnapshotHash:'snapshot-hash-123',priorProposalHash:'prior-hash-123',candidateValid:true};
const review={decision:'REVISE' as const,candidateId:context.candidateId,reasoning:'Scene two repeats the opening without advancing the explanation.',evidence:[{reference:'storyboard[1].visual',observation:'Scene two uses the same text reveal as scene one.'}],corrections:[{id:'c1',field:'storyboard[1].visual',defect:'The repeated reveal does not show the relationship.',correction:'Use the supported relationship layout for scene 2.'}],provenance:{reviewedProposalHash:context.reviewedProposalHash,sourceSnapshotHash:context.sourceSnapshotHash,priorProposalHash:context.priorProposalHash},validation:{candidateValid:true,unsupportedClaims:[]},scores:{hook:4,audience:4,distinctiveness:3,evidence:5,feasibility:5,brand:4}};

test('structured reviews bind candidate, validation and provenance',()=>{
  const parsed=parseEditorialReview(review,context);assert.equal(parsed.legacyAdapted,false);assert.equal(assessEditorialDecision(parsed).actionableRevision,true);
  assert.throws(()=>parseEditorialReview({...review,candidateId:'other'},context),/candidate ID/);
  assert.equal(structuredEditorialReviewSchema.safeParse({...review,decision:'PASS'}).success,false);
});

test('revision requires a field, concrete defect, correction and matching evidence',()=>{
  assert.equal(isSpecificEditorialCorrection({field:'hook',defect:'The opening lacks a specific subject.',correction:'Make this video more engaging'}),false);
  const generic=parseEditorialReview({...review,evidence:[],corrections:[{id:'c1',field:'hook',defect:'The opening lacks a specific subject.',correction:'Improve the hook to be more engaging.'}]},context);
  assert.equal(assessEditorialDecision(generic).actionableRevision,false);
  const uncited=parseEditorialReview({...review,evidence:[{reference:'caption',observation:'Caption observation.'}]},context);
  assert.equal(assessEditorialDecision(uncited).actionableRevision,false);
});

test('legacy reviews adapt without changing old queued output shape',()=>{
  const parsed=parseEditorialReview({verdict:'REVISE',scores:review.scores,notes:['Scene two repeats the opening.'],changes:[{id:'legacy-1',field:'storyboard[1].visual',weakness:'The repeated reveal does not show the relationship.',correction:'Use the supported relationship layout for scene 2.'}],unsupportedClaims:[]},context);
  assert.equal(parsed.legacyAdapted,true);assert.equal(parsed.decision,'REVISE');assert.equal(assessEditorialDecision(parsed).actionableRevision,true);assert.match(parsed.reasoning,/Legacy review adaptation/);
  const blocked=parseEditorialReview({verdict:'BLOCK',scores:review.scores,notes:['Evidence is insufficient.'],changes:[],unsupportedClaims:[]},context);assert.equal(blocked.decision,'ABSTAIN');
});

test('identical or unrelated revisions retain the prior candidate for final comparison',()=>{
  const parsed=parseEditorialReview(review,context),prior={storyboard:[{}, {visual:'Plain reveal'}],caption:'Approved'},corrected={storyboard:[{}, {visual:'Supported relationship layout'}],caption:'Approved'};
  assert.equal(revisionMeaningfullyAddresses(prior,prior,parsed),false);
  assert.equal(revisionMeaningfullyAddresses(prior,{...prior,caption:'Different'},parsed),false);
  assert.equal(revisionMeaningfullyAddresses(prior,corrected,parsed),true);
});

test('abstain and retain-previous are terminal and never accepted',()=>{
  for(const decision of ['ABSTAIN','RETAIN_PREVIOUS'] as const){const parsed=parseEditorialReview({...review,decision,corrections:[]},context),assessment=assessEditorialDecision(parsed);assert.equal(assessment.terminal,true);assert.equal(assessment.actionableRevision,false);}
});

test('claiming a change was accepted does not establish that it changed the candidate',()=>{const parsed=parseEditorialReview(review,context),prior={storyboard:[{}, {visual:'Plain reveal'}],acceptedChanges:[]};assert.equal(revisionMeaningfullyAddresses(prior,{...prior,acceptedChanges:['c1']},parsed),false);});
