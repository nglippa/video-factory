import test from 'node:test';
import assert from 'node:assert/strict';
import {projectProfileSchema,validateTrustedScript,type ProjectProfile} from '../src/domain.js';

const profile:ProjectProfile=projectProfileSchema.parse({
  id:'whodunnit',name:'Whodunnit',enabled:true,
  colors:{background:'#ffffff',ink:'#111111',accent:'#ff0000',muted:'#777777'},typography:{display:'A',body:'B',mono:'C'},
  logo:{type:'wordmark',value:'Whodunnit'},voice:['clear'],templates:['before-after','explainer'],restrictions:[],
  cta:'Find your voice with Whodunnit.',assetDirectories:[],output:{width:1080,height:1920,fps:30},brandSources:['local'],
  approvedContent:[{id:'clear-writing',topic:'clear writing',title:'Your thoughts. Your voice.',hook:'Make room for your voice.',body:'Less clutter. The same idea.',cta:'Find your voice with Whodunnit.',before:'At this point in time, we are making plans to begin the project.',after:'We’re planning to start the project.',source:'approved example'}]
});
const valid={version:1,projectId:'whodunnit',topic:'clear writing',template:'before-after',contentId:'clear-writing',cta:profile.cta,scenes:[
  {kind:'hook',headline:'Make room for your voice.',body:'Less clutter. The same idea.',seconds:4},
  {kind:'before',headline:'At this point in time, we are making plans to begin the project.',body:'At this point in time, we are making plans to begin the project.',seconds:5},
  {kind:'after',headline:'We’re planning to start the project.',body:'We’re planning to start the project.',seconds:5},
  {kind:'cta',headline:profile.cta,body:profile.cta,seconds:4},
]};

test('accepts exact approved before/after wording',()=>assert.equal(validateTrustedScript(valid,profile).contentId,'clear-writing'));
test('rejects model hallucination or paraphrase',()=>assert.throws(()=>validateTrustedScript({...valid,scenes:valid.scenes.map((s,i)=>i===2?{...s,body:'Start the project soon.'}:s)},profile),/outside the approved/));
test('rejects cross-project output',()=>assert.throws(()=>validateTrustedScript({...valid,projectId:'other'},profile),/projectId/));
test('rejects mismatched approved pair despite allowed wording',()=>assert.throws(()=>validateTrustedScript({...valid,scenes:valid.scenes.map((s,i)=>i===1?{...s,headline:'Less clutter. The same idea.'}:s)},profile),/exact approved pair/));
