"""Prepare bounded local review packages. Does not approve, enable or submit anything."""
from pathlib import Path
import hashlib,json,datetime,os
ROOT=Path(__file__).resolve().parents[1]
PROJECTS=ROOT.parent
NOW=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
OUT=ROOT/'data/source-recovery/candidates'
OUT.mkdir(parents=True,exist_ok=True)
def sha(data):return hashlib.sha256(data).hexdigest()
def prepare(project,repo,identity,docs,audience,description,concepts,risks,assets=[],prohibited=[],voice='Specific, clear and restrained. Use only reviewed copy.'):
    base=(ROOT/'config/projects'/f'{project}.json').read_bytes();profile=json.loads(base);documents=[];contents=[]
    for filename in docs:
        p=PROJECTS/repo/filename
        if p.is_symlink() or p.resolve()!=p or p.stat().st_nlink!=1:raise ValueError('Unsafe source')
        data=p.read_bytes()
        if len(data)>512*1024:raise ValueError('Source too large')
        contents.append(data.decode().split('\n'))
        documents.append(dict(repository=str(PROJECTS/repo),path=filename,sha256=sha(data),modifiedAt=datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat().replace('+00:00','Z'),bytes=len(data)))
    candidateid=project+'-2026-10-11-v1';claims=[]
    def claim(kind,text,refs,verification='EDITORIAL_COPY',risk='Proposed wording requires explicit human source/copy approval.'):
        support=[dict(document=d,lines=[a,b],excerpt='\n'.join(contents[d][a-1:b]).strip()) for d,a,b in refs]
        claims.append(dict(kind=kind,text=text,support=support,verification=verification,risk=risk))
    for kind,value in [('audience',audience),('description',description),('voice',voice)]:claim(kind,value,list(dict.fromkeys(ref for concept in concepts for ref in concept[-1])) if kind=='description' else [(0,1,min(15,len(contents[0])))],'BRAND_REVIEW_REQUIRED' if kind in ['audience','voice'] else 'DOCUMENTED')
    cta=profile['cta'] if profile['enabled'] else {'terra-steam-tycoon':'Explore Terra.','angband':'Discover Wand or Steel.','find-my-needs':'Explore Find My Needs.'}[project]
    claim('cta',cta,[(0,1,min(15,len(contents[0])))],'BRAND_REVIEW_REQUIRED','Proposed generic CTA; no URL, availability, purchase or release promise.')
    claim('template','announcement',[(0,1,min(15,len(contents[0])))],'EDITORIAL_COPY','Typography only. Does not imply a screenshot, gameplay recording or synthetic patient data.')
    for restriction in prohibited:claim('prohibited',restriction,[(0,1,min(15,len(contents[0])))],'EDITORIAL_COPY')
    added=[]
    for i,(topic,title,hook,body,lesson1,lesson2,refs) in enumerate(concepts):
        disclaimer='Recordkeeping education. Not tax advice.' if project=='gigwise' else 'Product note. No gameplay footage.' if project in ['angband','terra-steam-tycoon'] else 'Synthetic workflow. No patient data.' if project=='find-my-needs' else 'Product note. Review your writing.'
        content=dict(id=f'reviewed-{candidateid}-{i+1}',topic=topic,title=title,hook=hook,body=body,cta=cta,disclaimer=disclaimer,lessons=[lesson1,lesson2],source='Pending source review: '+candidateid)
        added.append(content)
        for text in dict.fromkeys([title,hook,body,disclaimer,lesson1,lesson2]):claim('marketing',text,refs)
        claim('capability',lesson1,refs,'SOURCE_CODE_VERIFIED','Implementation inspected in source only; no live product or release test.')
    profile.update(enabled=True,cta=cta,approvedContent=profile['approvedContent']+added,templates=list(dict.fromkeys(profile['templates']+['announcement'])),brandSources=profile['brandSources']+[f'data/source-recovery/approved/{candidateid}.json'],voice=profile['voice']+[voice],restrictions=profile['restrictions']+prohibited)
    if project=='angband':profile.update(name='Wand or Steel',logo=dict(type='wordmark',value='Wand or Steel'))
    candidate=dict(version=1,id=candidateid,projectId=project,createdAt=NOW,scope='Reviewed product notes from local documentation and source; typography only, no implied recorded demonstration. '+identity,baseProfileSha256=sha(base),identity=identity,documents=documents,claims=claims,assets=assets,risks=risks,profile=profile)
    destination=OUT/f'{candidateid}.json'
    if destination.exists():
        print('Preserved existing package:',destination);return
    with destination.open('x') as handle:json.dump(candidate,handle,indent=2);handle.write('\n')
    os.chmod(destination,0o600);print(destination)
prepare('terra-steam-tycoon','steam-tycoon','City Tycoon — Terra, in the world of Locke. Distribution remains undecided.',
 ['PRODUCT.md','src/main.ts'],'Players of first-person incremental and management games.',
 'Terra is a first-person incremental city game about restoring a steampunk industrial district.',[
 ('Restoration through city eras','From Lowworks to Grand Terra','A district worth restoring.','Terra follows a steampunk district through city eras.','Begin in The Lowworks.','City eras lead toward Grand Terra.',[(0,15,19),(1,61,64)]),
 ('Physical on-site property ledgers','The ledger is in the city','Walk to the ledger.','Properties are upgraded at physical on-site brass ledgers.','A first-person city you walk through.','Property upgrades use on-site brass ledgers.',[(0,15,24),(1,64,68)]),
 ('Construction changes in the world','Watch the district change','Look what your city is becoming.','Property changes trigger city construction updates.','The city responds to property upgrades.','City construction updates follow those changes.',[(0,38,39),(1,64,68)])],
 ['Source inspection only; no live gameplay captured or verified this task.','Do not promise Steam availability or a launch date.','Floating kingdom occupation and resistance require further reviewed worldbuilding sources.','Neutral existing factory typography needs brand review; no concept art presented as gameplay.'],
 [dict(path='steam-tycoon/public/crest.svg',status='CANDIDATE_NOT_APPROVED',notes='Brand asset metadata only; no footage or screenshot approved.')],['No invented gameplay, release claims, player outcomes or footage.'])
prepare('angband','wand-or-steel','User identified wand-or-steel as campaign Angband. Public product name: Wand or Steel; internal campaign ID remains angband.',
 ['src/components/TitleScreenTransition.tsx','docs/critical-hit-foundation.md','src/game/systems/CombatSystem.ts','src/data/generalSkillTree.ts','src/game/ui/UiPanelSystem.ts','docs/visual-identity.md'],
 'Players interested in fantasy combat and character-building systems.',
 'Wand or Steel is a fantasy game with melee combat, character skill investment and discovery-based codex panels.',[
 ('Independent main-hand and offhand critical hits','Two weapons, separate rolls','Each weapon gets its own roll.','Main-hand and offhand melee critical hits roll independently.','The main hand rolls for a melee critical hit.','The offhand makes its own melee critical roll.',[(1,1,6),(2,219,223),(2,288,305)]),
 ('Skill prerequisites across three branches','Before you spend the point','A skill point has prerequisites.','General skill investment checks points, prerequisites and rank limits.','Explore Survival, Logistics and Fortune branches.','Prerequisites and rank limits gate investment.',[(3,42,62),(3,238,272)]),
 ('Discovery-based monster and artifact codex panels','Your discoveries, organized','The codex begins with discoveries.','Monster and artifact codex panels use discovered entries.','Monster entries use monster discovery IDs.','Artifact entries use artifact discovery IDs.',[(4,154,159)])],
 ['Source-level implementation verified; no live combat or save/load test.','Spell and ranged critical hits are scaffolded and disabled; claims are melee-only.','Tolkien-derived names appear in repository; selected copy avoids character, creature and location names. Asset provenance needs separate approval.','Product-specific README is absent; React/Vite template is unsuitable.','Audience, voice and generic CTA are editorial proposals requiring approval.'],
 [dict(path='wand-or-steel/public/assets/active/ui/startup/title-screen.png',status='CANDIDATE_NOT_APPROVED',notes='Referenced by title screen source. No asset promoted, viewed or licensed for campaign here.')],['No Angband legacy mechanics, unverified ranged/spell critical hits, or fabricated gameplay.'])
prepare('find-my-needs','Find-My-Needs','Organizational healthcare needs assessment, not individual patient diagnosis.',
 ['PRODUCT.md','src/pages/NeedsPage.tsx','src/pages/PlanPage.tsx'],'Healthcare organization owners, administrators and quality or operations leaders.',
 'Find My Needs organizes organizational needs, supporting evidence and next actions.',[
 ('Organizational needs table','See the need and the evidence','What does your organization need?','Review organizational needs alongside status, evidence and tracked work.','Each need shows its status and evidence.','Tracked work stays connected to the need.',[(0,11,15),(1,40,55)]),
 ('Action completion versus need resolution','Done is not the same as resolved','An action can be done. A need can remain.','Find My Needs separates tracked work from need resolution.','Track actions tied to organizational needs.','Completing work alone does not resolve a need.',[(0,35,37),(2,46,52)]),
 ('Filtering needs by status, kind and unit','Find the need you want to review','Start with the right needs.','Filter organizational needs by status, kind and unit.','Use status, kind and unit filters.','Search organizational needs by text.',[(0,11,15),(1,40,43)])],
 ['Demonstration requirement corpus is not authoritative law.','No clinical effectiveness, compliance guarantees or quantified efficiency claims.','Synthetic organizational workflow only; no private patient data read or used.','Source-level UI present; no live authentication, persistence or clinical workflow test.'],[],['No clinical outcomes, real patient information, compliance guarantees or authoritative-law claims from demonstration data.'])
prepare('whodunnit','Whodunnit','AI-assisted writing refinement; existing synthetic comparison is retained.',
 ['README.md','src/features/comparison/ChangesView.tsx','src/features/reconstruction/useWorkspace.ts'],'People refining their writing for clarity, tone and voice.',
 'Whodunnit is a writing editor with a word-level Changes view and checks for concrete text changes.',[
 ('Word-level change inspection','Look at what changed','Which words changed?','The Changes view marks additions and removals.','Added words are marked as additions.','Removed words are marked as removals.',[(0,14,19),(1,34,45),(1,59,70)]),
 ('Your manual edits as revisions','Your edits count too','Your edits are part of the revision.','Hand edits are retained as a revision with deterministic checks.','Edit the reconstructed result yourself.','Hand-edited revisions are checked against the original.',[(0,16,19),(2,231,247)])],
 ['Existing approved synthetic rewrite remains unchanged.','Meaning checks are not proof; no guaranteed fact preservation or AI-detector evasion.','Product README reports no recorded live-model evaluation; no performance claims.','Typographic feature note only; no actual UI recording approved.'],[],['No detector evasion guarantees, fabricated performance statistics or testimonials.'])
prepare('gigwise','GigWise','Recordkeeping slice only. Product positioning blueprint does not prove deduction eligibility.',
 ['docs/product-architecture.md','components/gigwise-app.tsx'],'Freelancers, contractors and gig workers organizing business records.',
 'GigWise includes business expense record entry and category-based organization.',[
 ('Business purpose in expense entry','Give the expense context','What was this expense for?','An expense entry includes a business purpose field.','Record the merchant, amount and date.','Add the business purpose to the entry.',[(0,94,104),(1,3554,3588)]),
 ('Expense category organization','Keep the category with the record','Where does this record belong?','Expense records can be grouped by category.','A category groups related expense records.','Category rows show item and receipt counts.',[(0,94,104),(1,3622,3647)])],
 ['No deduction eligibility, tax rates, savings estimates or individualized advice in this package.','Blueprint is product intent, not proof that all MVP features shipped.','Source-level form and category UI verified; persistence and accounting accuracy not tested.','No personal financial records read. Branding icons are not product screenshots.'],
 [dict(path='GigWise/public/android-chrome-512x512.png',status='CANDIDATE_NOT_APPROVED',notes='Brand icon only, not a product screenshot.')],['No unsupported tax advice, deduction eligibility, savings guarantees or fabricated receipts.'])
