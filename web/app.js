'use strict';
const $=(id)=>document.getElementById(id);
const state={profiles:[],jobs:[],selected:null,events:new Map(),modelAvailable:false,submitting:false,previewId:null,reviewSerial:0,refreshTimer:null,production:null};
const templates={'before-after':'Writing / before & after',explainer:'Educational explainer','feature-demo':'Feature demonstration',gameplay:'Gameplay trailer',announcement:'Product announcement'};
const statuses={QUEUED:'Draft · queued',SCRIPTING:'Writing script',REFINING:'Editorial review',RENDERING:'Rendering',VALIDATING:'Technical QA',READY_FOR_REVIEW:'Ready for approval',APPROVED:'Approved',REJECTED:'Rejected',FAILED:'Failed',CANCELLED:'Cancelled'};
function text(id,value){$(id).textContent=value??'';}
function error(e){text('error',e.message??String(e));$('error').hidden=false;}
async function api(route,body){const r=await fetch('/api/'+route,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error??'Request failed');return data;}
function option(value,label){const el=document.createElement('option');el.value=value;el.textContent=label;return el;}
function profile(){return state.profiles.find((p)=>p.id===$('project').value);}
function selectedContent(){return profile()?.approvedContent.find((c)=>c.id===$('content').value);}
function updateForm(resetTopic=false){
  const p=profile();if(!p)return;
  $('template').replaceChildren(...p.templates.map((t)=>option(t,templates[t])));
  $('content').replaceChildren(...p.approvedContent.map((c)=>option(c.id,c.topic)));
  if(!p.approvedContent.length)$('content').append(option('','Awaiting approved content'));
  if(resetTopic)text('brief-hint','Local script generation. Human approval before use.');
  if(resetTopic)$('topic').value=p.approvedContent[0]?.topic??'';
  text('profile-notice',p.enabled?'Brand and content verified · '+p.name:p.restrictions[0]);
  $('profile-notice').classList.toggle('blocked',!p.enabled);
  $('topic').disabled=!p.enabled;$('template').disabled=!p.enabled;$('content').disabled=!p.enabled;
  updateCopy();updateButton();
}
function updateButton(){$('generate').disabled=state.submitting||!profile()?.enabled||!selectedContent()||!state.modelAvailable;}
function updateCopy(){
  const c=selectedContent();$('approved-copy').replaceChildren();
  if(!c){$('approved-details').hidden=true;return;}$('approved-details').hidden=false;
  for(const [label,value] of [['Before',c.before],['After',c.after],['Approved copy',c.body],['Call to action',c.cta],...((c.lessons??[]).map((l,i)=>['Lesson '+(i+1),l])),['Provenance',c.source]]){if(!value)continue;const p=document.createElement('p'),b=document.createElement('b');b.textContent=label;p.append(b,document.createTextNode(value));$('approved-copy').append(p);}
}
function name(id){return state.profiles.find((p)=>p.id===id)?.name??id;}
function formatTime(date){return new Date(date).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function renderJobs(){
  text('queue-count',state.jobs.length+' '+(state.jobs.length===1?'job':'jobs'));$('queue-empty').hidden=state.jobs.length>0;$('queue').replaceChildren();
  for(const j of state.jobs){
    const tr=document.createElement('tr');tr.classList.toggle('selected',j.id===state.selected);
    const first=document.createElement('td'),b=document.createElement('button'),sub=document.createElement('small');
    b.className='job-link';b.dataset.jobId=j.id;b.type='button';b.append(document.createTextNode(j.topic));sub.textContent=name(j.projectId)+' · '+formatTime(j.createdAt);b.append(sub);b.addEventListener('click',()=>selectJob(j.id));first.append(b);
    const second=document.createElement('td'),s=document.createElement('span');s.className='state '+(['READY_FOR_REVIEW','APPROVED'].includes(j.status)?'ready':j.status==='FAILED'?'failed':'');s.textContent=statuses[j.status]??j.status;second.append(s);
    const last=document.createElement('td');last.textContent=j.attempts+' / '+j.maxAttempts;tr.append(first,second,last);$('queue').append(tr);
  }
  const current=state.jobs.find((j)=>['SCRIPTING','REFINING','RENDERING','VALIDATING'].includes(j.status));
  text('current-state',current?statuses[current.status]:'Idle');text('current-topic',current?name(current.projectId)+' / '+current.topic:'Your next film starts with a brief.');
  const progress=current?state.events.get(current.id):null;
  const amount=progress?Math.round(progress.progress*100):0;
  $('progress').style.transform='scaleX('+(amount/100)+')';document.querySelector('[role=progressbar]').setAttribute('aria-valuenow',String(amount));
  text('progress-stage',progress?({script:'Local script generation',bundle:'Preparing composition',render:'Rendering frames',sound:'Producing original audio',validate:'Technical video validation'}[progress.stage]??progress.stage):current?'Preparing the next stage':'One job at a time · models unload before rendering');
  text('progress-number',progress?amount+'%':'—');
}
async function selectJob(id){state.selected=id;renderJobs();await renderReview();}
async function renderReview(){
  const serial=++state.reviewSerial,j=state.jobs.find((j)=>j.id===state.selected);
  if(!j){$('review-info').hidden=true;return;}
  $('review-info').hidden=false;text('review-state',statuses[j.status]);text('review-topic',name(j.projectId)+' / '+j.topic);text('review-warning',j.warning);text('review-error',j.error?(j.retryNotBefore?j.error+' · Retry after '+new Date(j.retryNotBefore).toLocaleString():j.error):'');$('review-error').classList.toggle('error',Boolean(j.error));
  const ready=j.status==='READY_FOR_REVIEW'&&j.qaPassed===1;
  $('approve').hidden=!ready;$('reject').hidden=j.status!=='READY_FOR_REVIEW';$('retry').hidden=j.status!=='FAILED'||j.attempts>=j.maxAttempts;$('regenerate').hidden=!['READY_FOR_REVIEW','APPROVED','REJECTED','FAILED'].includes(j.status);
  $('cancel').hidden=!['QUEUED','SCRIPTING','REFINING','RENDERING','VALIDATING'].includes(j.status);
  const hasVideo=j.qaPassed===1&&['READY_FOR_REVIEW','APPROVED','REJECTED'].includes(j.status);
  $('preview-empty').hidden=hasVideo;$('preview').hidden=!hasVideo;
  if(hasVideo&&state.previewId!==idOf(j)){
    state.previewId=idOf(j);$('preview').src='/artifacts/'+j.id+'/video.mp4';$('preview').poster='/artifacts/'+j.id+'/poster.jpg';$('preview').load();
  }
  if(!hasVideo&&state.previewId){$('preview').pause();$('preview').removeAttribute('src');$('preview').load();state.previewId=null;}
  $('script-details').hidden=!hasVideo;$('provenance-details').hidden=!hasVideo;
  text('review-note',j.status==='APPROVED'?'Your approval is recorded. The MP4 is ready for manual use.':ready?'Review the entire film and its wording before approving.':'Approval records your review locally.');
  $('artifact-links').replaceChildren();$('qa').replaceChildren();
  if(hasVideo){for(const [label,file] of [['Download MP4','video.mp4'],['Script','script.json'],['Metadata','metadata.json'],['QA report','qa.json']]){const a=document.createElement('a');a.href='/artifacts/'+j.id+'/'+file;a.textContent=label;a.download=file;$('artifact-links').append(a);}
    try{const [script,metadata]=await Promise.all(['script.json','metadata.json'].map(async(file)=>{const r=await fetch('/artifacts/'+j.id+'/'+file);if(!r.ok)throw new Error(file+' unavailable');return r.json();}));if(serial!==state.reviewSerial)return;renderScript(script);renderProvenance(metadata);const r=await fetch('/artifacts/'+j.id+'/qa.json');if(!r.ok)throw new Error('QA report unavailable');const qa=await r.json();if(serial!==state.reviewSerial)return;const title=document.createElement('h3');title.textContent='TECHNICAL QA / '+(qa.passed?'PASSED':'FAILED');$('qa').append(title);
      for(const check of qa.checks){const row=document.createElement('div');row.className='qa-row '+(check.passed?'':'fail');row.title=check.detail;const label=document.createElement('span'),pass=document.createElement('span');label.textContent=check.name;pass.textContent=check.passed?'PASS':'FAIL';row.append(label,pass);$('qa').append(row);}
    }catch(e){if(serial===state.reviewSerial)error(e);}
  }
}
function idOf(j){return j.id+'-'+j.attempts;}
async function refreshJobs(){
  try{state.jobs=await api('jobs');if(!state.selected&&state.jobs.length)state.selected=state.jobs[0].id;
    for(const j of state.jobs.filter((x)=>['SCRIPTING','REFINING','RENDERING','VALIDATING'].includes(x.status))){if(!state.events.has(j.id)){const detail=await api('jobs/'+j.id);const latest=detail.events.filter((e)=>e.type==='progress').at(-1);if(latest)state.events.set(j.id,latest.data);}}
    renderJobs();await renderReview();
  }catch(e){error(e);}
}
async function models(){
  try{const s=await api('status');const configured=s.qwenModel??'qwen3:14b-q8_0';state.modelAvailable=s.ollama.available&&s.ollama.tags.includes(configured);
    text('qwen-state',state.modelAvailable?(s.ollama.loaded.length?'Loaded locally':'Available locally'):'Unavailable');text('qwen-detail',s.ollama.error??configured+' · sequential execution');
    text('bonsai-state',s.bonsai?.available?(s.bonsai.memorySafe?'Available for refinement':'Available · memory policy required'):'Offline · optional');
    text('bonsai-detail',s.bonsai?.available?s.bonsai.endpoint:'Validated Qwen script is retained');updateButton();
  }catch(e){state.modelAvailable=false;text('qwen-state','Connection unavailable');updateButton();}
}
$('project').addEventListener('change',()=>updateForm(true));
$('content').addEventListener('change',()=>{updateCopy();$('topic').value=selectedContent()?.topic??'';updateButton();});
$('brief-form').addEventListener('submit',async(e)=>{
  e.preventDefault();state.submitting=true;updateButton();$('error').hidden=true;
  try{const job=await api('jobs',{projectId:profile().id,topic:$('topic').value.trim(),contentId:$('content').value,template:$('template').value,idempotencyKey:crypto.randomUUID()});state.selected=job.id;await refreshJobs();}
  catch(e){error(e);}finally{state.submitting=false;updateButton();}
});
for(const action of ['approve','reject','retry','cancel','regenerate'])$(action).addEventListener('click',async()=>{
  const b=$(action);b.disabled=true;$('error').hidden=true;try{const result=await api('jobs/'+state.selected+'/'+action,{});if(action==='regenerate')state.selected=result.id;await refreshJobs();await refreshProduction();}catch(e){error(e);}finally{b.disabled=false;}
});
function detail(parent,label,value){const p=document.createElement('p'),b=document.createElement('b');b.textContent=label+': ';p.append(b,document.createTextNode(String(value??'Not recorded')));parent.append(p);}
function renderScript(script){const parent=$('script-preview');parent.replaceChildren();script.scenes.forEach((scene,i)=>{detail(parent,(i+1)+' / '+scene.kind+' · '+scene.seconds+' seconds',scene.headline);if(scene.body!==scene.headline)detail(parent,'Copy',scene.body);});detail(parent,'CTA',script.cta);}
function renderProvenance(metadata){const parent=$('model-provenance');parent.replaceChildren();const generation=metadata.models?.generation;const q=metadata.models?.qwen??{};const attempt=metadata.attempts?.find(a=>a.provider==='ollama');detail(parent,'Script model',generation?.model??attempt?.model??q.model);detail(parent,'Digest',generation?.modelDigest??metadata.models?.modelDigest);detail(parent,'Endpoint',generation?.endpoint??'Legacy artifact: endpoint not recorded');detail(parent,'Inference',String(generation?.evalCount??q.eval_count??'?')+' tokens · structured approved copy');const editorial=metadata.models?.editorial;detail(parent,'Editorial refinement',editorial?.status??(metadata.warning?'SKIPPED / '+metadata.warning:'Legacy artifact: inspect model attempts'));if(editorial?.reason||editorial?.error)detail(parent,'Reason',editorial.reason??editorial.error);if(editorial?.changes)detail(parent,'Editorial changes',JSON.stringify(editorial.changes));detail(parent,'Publishing','Human approval required · public publishing unavailable');}
async function refreshProduction(){try{const [control,ideas]=await Promise.all([api('production'),api('backlog')]);state.production=control;text('production-state',control.paused?'Paused':control.canStartJob?'Available for production':control.gateReason);text('production-window',control.window.start+'–'+control.window.end+' / '+control.timezone+' · one job at a time'+(control.lastTick?' · checked '+formatTime(control.lastTick):''));text('scheduler-error',control.error);text('production-toggle',control.paused?'Resume production':'Pause production');$('production-toggle').disabled=false;renderBacklog(ideas);}catch(e){error(e);}}
function renderBacklog(ideas){const parent=$('backlog'),opened=new Set([...parent.querySelectorAll('details[open]')].map(row=>row.dataset.ideaId));parent.replaceChildren();if(!ideas.length){detail(parent,'Backlog','No ideas. Import approved project content as a draft using the CLI.');return;}for(const idea of ideas){const row=document.createElement('details'),summary=document.createElement('summary');row.dataset.ideaId=idea.id;row.open=opened.has(idea.id);summary.textContent=name(idea.projectId)+' / '+idea.topic+' · '+idea.status.replaceAll('_',' ');row.append(summary);for(const [label,value] of [['Audience',idea.targetAudience],['Message',idea.intendedMessage],['Hook',idea.proposedHook],['Template',templates[idea.template]],['Required assets',idea.requiredAssets.join(', ')||'No additional assets'],['Tax year',idea.taxYear??'No tax claims'],['Demonstration',idea.syntheticDemo?'Approved synthetic example':'Approved project information'],['Approval','Content and finished video require human approval']])detail(row,label,value);for(const ref of idea.sourceReferences)detail(row,'Source / '+ref.type+(ref.verified?' · operator verified':' · UNVERIFIED'),ref.source+(ref.url?' / '+ref.url:''));const actions=document.createElement('div');actions.className='review-actions';for(const action of (idea.status==='APPROVED'?['produce','reject']:idea.status==='DRAFT'?['approve','reject']:[])){const b=document.createElement('button');b.type='button';b.textContent={approve:'Approve content',reject:'Reject content',produce:'Queue film'}[action];b.onclick=async()=>{b.disabled=true;try{const result=await api('backlog/'+encodeURIComponent(idea.id)+'/'+action,{});if(action==='produce'){state.selected=result.id;await refreshJobs();}await refreshProduction();}catch(e){error(e);}finally{b.disabled=false;}};actions.append(b);}if(idea.jobId){const b=document.createElement('button');b.type='button';b.textContent='Review production';b.onclick=()=>selectJob(idea.jobId);actions.append(b);}row.append(actions);parent.append(row);}}
$('production-toggle').addEventListener('click',async()=>{if(!state.production)return;$('production-toggle').disabled=true;try{await api('production/'+(state.production.paused?'resume':'pause'),{});await refreshProduction();}catch(e){error(e);$('production-toggle').disabled=false;}});
async function init(){
  try{state.profiles=await api('projects');$('project').replaceChildren(...state.profiles.map((p)=>option(p.id,p.name+(p.enabled?'':' · awaiting approval'))));$('project').value='whodunnit';text('project-count',state.profiles.filter((p)=>p.enabled).length+' ready / '+state.profiles.length+' profiles');updateForm(true);await refreshJobs();await models();}catch(e){error(e);}
  const stream=new EventSource('/api/events');
  stream.onopen=()=>{text('connection','Studio connected');$('connection-dot').className='dot online';};
  stream.onerror=()=>{text('connection','Reconnecting to studio');$('connection-dot').className='dot offline';};
  const handle=(event)=>{try{const data=JSON.parse(event.data);text('last-event','BACKEND EVENT / '+data.type.toUpperCase()+' / '+formatTime(data.createdAt));
    if(data.type==='progress'){state.events.set(data.jobId,data.data);renderJobs();return;}
    clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(refreshJobs,150);
  }catch(e){error(e);}};
  for(const kind of ['created','claimed','status','progress','failure','retried','cancel-requested','operator-review','lease-recovered','interrupted','retry-scheduled','retry-exhausted','backlog-bound','regenerated-from'])stream.addEventListener(kind,handle);
  setInterval(models,20_000);setInterval(refreshJobs,10_000);setInterval(refreshProduction,10_000);await refreshProduction();
}
init();
