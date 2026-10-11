# Creative production recovery

Campaign `2026-10-12-primary-projects`, deadline October 12, 2026 at noon America/Chicago (`2026-10-12T17:00:00Z`). Starting and ending Git revision: `b6c0500463202cd53bffa2b3f71b248db4428caf`; implementation changes remain uncommitted. Command Center stays at the existing deployment; its code, lifecycle settings, model limits and scheduler were not changed.

## Initial production state

Read the live CLI status, throughput report, approved registries, source-recovery documentation, persisted drafts/critiques, scheduler, ranking and rendering before editing. Baseline captured at `2026-10-11T19:51:36Z`. Historical completed packages: Whodunnit 4, GigWise 2, Terra 0, Wand or Steel 0, Find My Needs 0. This is stored historical validation, not six distinct concepts under the stronger audit.

| Project | Awaiting approval | Revision blocked | Source/coverage blocked | Asset blocked | Failed | Pending/generating |
|---|---:|---:|---:|---:|---:|---:|
| Whodunnit | 4 | 5 | 0 | 0 | 1 | 0 |
| GigWise | 2 | 5 | 0 | 1 | 2 | 0 |
| Terra / Steam Tycoon | 0 | 0 | 7 | 2 | 0 | 1 |
| Wand or Steel (internal `angband`) | 0 | 1 | 7 | 0 | 0 | 2 |
| Find My Needs | 0 | 1 | 7 | 0 | 0 | 2 |

The versioned report's `baseline.json` preserves all 50 original slot states, exact error messages, versions and completed-record hashes. All five source packages were already explicitly human approved. Their approval bytes and notes were preserved. `config/assets.json` contains no approved product screenshot or gameplay recording.

Verified blockers:

- Whodunnit/GigWise repetitive drafts: different angle/title labels around the same protected script and rendered composition. Other failures include editorial rejection, unsupported wording/references and bounded Qwen timeout/truncation failures.
- Wand or Steel/Find My Needs: native output constrained the old renderer to static product notes; Bonsai requested visual development that those constants could not apply. Their finite approved feature coverage is three concepts each.
- Terra: the operator explicitly requires gameplay footage. The retained typography drafts do not satisfy it. No actual approved gameplay asset or matching footage composition is available.
- GigWise slot 02: the mileage storyboard requested unavailable artwork. Switching it to an unrelated expense-category feature would change its intended concept; it remains blocked.
- Ordinals 04–10 of Terra/Wand/Find retain `NEEDS_SOURCE` legacy statuses but the report/dashboard classifies the precise reason as insufficient distinct approved composition coverage, rather than falsely saying every factual document is missing.

## Implemented creative contract

A finite, project-specific direction catalog binds ten supported reviewed features: two Whodunnit writing workflows, two GigWise expense workflows, three Wand or Steel mechanics and three Find My Needs organizational workflows. It does not mechanically multiply audience/hook/template labels into extra proposals. Terra has no asset-free substitute for the human gameplay requirement.

Each direction identifies its approved content base, narrative, direct approved feature opening, visual treatment and exact evidence focus. Four render-driving scenes last 4/8/8/4 seconds. Storyboards identify narrative purpose, exact visible/spoken copy, source references, approved asset IDs, transition and coherent visual sequence. New comparison, numbered-sequence and connected-relationship layouts use explanatory text and geometry, with brand tokens and exact visible disclaimers. They are explicitly not screenshots, recorded product output or gameplay. Existing actual-media templates retain their asset checks. A required media asset cannot be assigned an explanatory renderer that would hide it. Product walkthroughs or gameplay demonstrations still need actual approved assets; these text/geometry layouts provide a limited explanatory alternative.

Qwen receives two coherent visual treatments plus openings taken verbatim from the same approved hook or workflow statement. Opening/treatment options are the same concept and are never counted as extra proposals. Persisted options can be appended only when direction identity, approved claim IDs and source snapshot still match; the previous plan is archived. A specific supported visual correction changes the actual valid example supplied for revision; retaining the original example had caused both real revisions to repeat its layout despite reporting an accepted change. Unsupported hook urgency does not change the example. Variants share one direction ID and are not distinct concepts. Specific editorial corrections may add an existing renderer layout to the same exact text pair, capped at six total options, with at most two editorial revision rounds; original options and the originating critique are archived. When Qwen explicitly accepts such a supported correction but its output still uses the earlier geometry, the factory may compile that accepted instruction into a derived renderer composition before the already-required final Bonsai review. It preserves the raw Qwen version, prior plan, derived proposal, source snapshot and accepted-change IDs in an immutable artifact, labels the transformation as factory composition, revalidates exact facts/assets, and changes neither the concept nor revision budget. A rejected, unsupported, ambiguous or conflicting correction cannot be applied. The field index must agree with any scene named in the correction; competing layouts for one target scene are rejected together. Only instructions actually represented in the derived composition are labeled applied. Raw/model output, factory transformation and independent Bonsai final review stay separately identifiable. Single relevant hashtags are allowed; repeated tags fail validation. Native output constraints supplement deterministic title/category/caption/copy/evidence/scene/storyboard/asset binding. All copy remains within one approved content record; no new claim, source approval, clinical example, tax eligibility or product feature is inferred.

Qwen draft → Bonsai critique → Qwen revision → Bonsai final review is unchanged. Maximum two revision rounds per fresh attempt. A deterministically invalid revision can be retained as an immutable rejected candidate while the prior valid candidate proceeds to the already-required final review. This is a factual validity decision, not a claim that a model score proves creative quality. Change audits are scoped to the current attempt; original versions remain available.

## Distinctness methodology

`structured-composition-v1` compares substantive middle-scene copy, hook, audience, actual render layout/asset sequence, core topic, evidence references, CTA and narrative metadata. Normalization removes case/punctuation; token overlap is Dice overlap. These are transparent heuristics, not objective quality scores or semantic truth.

- Exact: equal substantive scene copy, opening, audience and render sequence. Titles, labels, hashtags and timing do not create another concept.
- Near: at least 90% substantive script and hook overlap with equal audience and render sequence.
- Superficial: at least 75% script overlap with unchanged audience/sequence; identical substantive composition despite changing its opening/audience/treatment; or another variant of the same direction ID.
- Distinct: substantive approved explanation or viewer problem and narrative/visual sequence differ without triggering those checks. Shared verified feature words alone do not fail.
- Historical records without a complete script provide related-topic advice only. Topic similarity alone is not duplicate proof.

Comparisons include other campaign proposals and archived previous recovery proposals, plus available backlog, idea and rendered-job history. The current recovery is also compared with the exact attempt it replaces. Partial historical records are explicitly labeled as incomplete comparison evidence. Every blocking result identifies the related proposal, measurements, overlap and a concrete remedy. Subjective existing Bonsai ranking criteria remain labeled editorial judgments.

Actual production comparison: all six pairings among original completed Whodunnit slots 01/02/07/09 have identical substantive script/opening/render structure, despite differing angle labels. GigWise 04/05 are likewise exact duplicates. Their six complete records were not rewritten. The dashboard exposes the new audit separately, warns that historical validation differs, and withholds their approval controls; approval also runs fresh server-side validation.

Actual near-duplicate audit: original GigWise slots 01 and 03 have script token overlap 1.0, hook overlap 1.0 and an equal render sequence despite zero topic-token overlap. They differ in structured copy assignments, so the new check classifies them `NEAR_DUPLICATE`, not exact. Both original attempts were already blocked for other reasons; this is a new audit rejection, not an invented historical approval decision. The original records remain in `baseline.json`.

Synthetic fixtures in `tests/creative-recovery.test.ts` demonstrate a rejected near-duplicate, an opening-only rewrite, treatment-only variants, and a genuinely different approved feature composition. They are test fixtures, not generated production successes.

## Recovery and safety

`recover-creative` operates on eligible idle `NEEDS_REVISION`/`FAILED`/`NEEDS_ASSET` slots. It checks unchanged approved claims, unused supported concepts, required assets and technical blockers before submission. An asset-free alternative must preserve the intended concept. Completed, active, previously recovered, evidence-blocked or mandatory-footage slots are refused.

One fresh creative attempt is explicitly bounded and auditable: archive the complete prior slot with create-only file semantics, retain every old version, assign a stable new attempt/job ID, and record why the new renderer/direction can address the earlier failure. Revision budgets are scoped to that attempt. Compare-and-swap persistence rejects concurrent changes. Restart reuses the persisted intent; there is no campaign rebuild, completed-slot reset or independent model scheduler.

Terra's missing mandatory footage is now detected before starting another doomed model job. Existing approved production jobs and resource gates keep priority. Both models execute only through the existing local durable Command Center bridge and exclusive lifecycle lease. Cleanup blockers continue to fail closed. No live source, asset, proposal, video, rendering or publishing approval was performed.

## Measurements and real pilot

Real recovery pilot: Find My Needs slot 01, approved organizational-needs explanation. Qwen's new draft passed schema, evidence, asset, identity and distinctness validation. It used actual `qwen3:14b-q8_0`; load 21.614s, inference 122.666s, unload 0.042s, verified `STOPPED` at `2026-10-11T20:20:09.587Z`.

The first actual Bonsai critique was truncated: prompt 3,879 tokens plus 217 completion tokens filled its existing 4,096-token context. It was not a 1,300-completion-token exhaustion. The failed receipt was preserved; Bonsai load 9.388s, inference 54.488s, unload 0.399s and verified `STOPPED` at `20:21:34.385Z`. Factory-only prompt compaction removes duplicated full layout variants, retaining the complete proposal, approved copy, model role, full editorial rubric and compact supported-layout options. The existing single retry succeeded: prompt 2,357 tokens, completion 343, total 2,700; Bonsai load 5.486s, inference 48.346s, unload 0.436s, verified `STOPPED` at `20:25:33.194Z`. Prompt characters fell from 14,814 to 9,100. No context limit, model setting or review stage was removed.

The first real draft's factory timings: source preparation 1.553s; schema parsing 0.014s; asset matching 0.002s; validation 0.092s; database persistence 0.005s; export persistence 6.906s. Bridge polling latency is reported separately; it is not model inference or total queue waiting.

An isolated copy of the actual database established repeated campaign-overview processing at 1,042/1,023/1,025ms. Reusing one consistent slot snapshot for the same comparisons measured 32/39/34ms. Fresh approval/consume checks still load authoritative current state. This benchmark predates full rendered-script history loading; it is not a claim about the final full-history runtime. No source check, editorial stage or comparison was removed. The isolated benchmark performed no inference or live database mutation. Live end-to-end export timing is tracked independently.

The report separates persisted Command Center queue waits, model load/infer/unload times, retries, revision stages, new factory phase receipts and uninstrumented historical phases. Averages based on the initial 156 stage receipts: historical throughput about 0.67 stored completed packages/hour; the remaining 44 would take about 65.5 hours at that rate versus approximately 20.7 hours until the deadline. This is not a forecast of distinct quality: the historical six duplicate, Terra has a hard asset blocker and current approved creative coverage is finite. Fifty genuinely distinct validated proposals cannot be promised from these sources/assets.

## Verification

- `npm run typecheck`: passed.
- `npm test`: 86 passed, including existing tests plus distinctness classes, exact approved evidence/copy, coherent variant binding, asset rejection, protected claims, blocker classification, bounded eligibility/refusal, archives, completed preservation, stable restart IDs, revision ceilings, prior-valid candidate retention, concurrent concept reservation, local mutation guards and static render frames.
- `node --check web/app.js`: passed.
- `python3 -m py_compile scripts/report-creative-recovery.py`: passed; real metadata report executed successfully.
- Real running dashboard exercised at 1440×1000 and 390×844. Opened original proposal and distinctness details, confirmed exact-duplicate explanations and withheld approval controls. Requested-direction prompt was exercised and dismissed without submitting an operator action. Reproduced nested audit details collapsing after refresh, fixed stable detail keys, and verified that group, proposal and nested detail open states all survive an actual refresh. No horizontal overflow or dashboard console errors. Observed dashboard API responses were HTTP 200; intentionally foreign Host/Origin recovery POSTs returned 403 before mutation.
- Browser inspected eight static React frames using approved GigWise/Find My Needs copy, including the frame-zero opening, comparison/sequence/focus treatments and exact visible disclaimers. These are verification frames, not rendered or approved production videos. Temporary verification HTML was removed. Screenshot retained in the first versioned recovery report.
- All six original completed slot hashes and all three approved registry hashes matched the baseline in the first report. Final preservation verification is recorded in the final snapshot below.
- Real new output and model lifecycle receipts are distinguished from synthetic tests. No mock result is claimed as inference verification.

## Files and operation

Changed factory modules: `src/campaigns.ts`, `src/campaign-domain.ts`, `src/domain.ts`, `src/backlog.ts`, `src/cli.ts`, `src/server.ts`, `src/video/index.tsx`, `web/app.js`. Added `src/distinctness.ts`, `src/creative-directions.ts`, `src/campaign-blockers.ts`, `src/video/creative-scene.tsx`, `src/rendered-history.ts`, `scripts/report-creative-recovery.py`. Tests: `tests/creative-recovery.test.ts`, `tests/campaigns.test.ts`, `tests/server.test.ts`. This document records recovery. No Command Center or other project repository files changed.

```sh
cd ~/Projects/video-edits
npm run cli -- campaign status
npm run cli -- campaign recover-creative
npm run cli -- campaign pause
npm run cli -- campaign resume
npm run cli -- campaign export
curl -fsS http://127.0.0.1:4317/api/campaigns/2026-10-12-primary-projects -o /tmp/creative-overview.json
python3 scripts/report-creative-recovery.py --overview /tmp/creative-overview.json --baseline data/campaigns/2026-10-12-primary-projects/creative-production-recovery/2026-10-11T20-20-43-228754Z/baseline.json
npm run typecheck
npm test
```

Review location: existing dashboard `http://127.0.0.1:4317/`, campaign section. Full proposal/export links remain in that dashboard. Source/asset approvals and proposal approval are separate existing human controls. Launchd automation and the original deadline remain intact; execution windows require the machine/services to be available.

The command `recover-creative` preserves completed work and skips ineligible rows. For a specific blocked slot, its existing dashboard “Request different creative direction” control records operator instructions. It cannot manufacture additional approved copy or assets.

## Verified submission defect and recovery

A later real GigWise revision exposed a factory integration defect: expanding supported choices made its Qwen prompt 32,245 characters, beyond Command Center's unchanged 32,000-character contract (`tools/research/bridge.py`, `validate_job`). Command Center rejected the request before enqueue; this delay was not inference or model switching. Factory prompt compaction now replaces duplicate full variants and repeated full prior scripts with explicit opening/layout choices, one coherent complete storyboard example, unique substantive prior statements and their actual layouts. Full approved copy, source references, rubric, draft, critique, constrained output schema, complete structured input payload and all deterministic history checks remain preserved. New oversized prompts are refused before intent persistence.

The existing rejected intent is archived create-only at `creative-recovery/2026-10-12-primary-projects-gigwise-01-unsubmitted-intent-e72ffc60eb742f87883b.json`. Repair requires the authoritative Command Center `get` to return exactly `Unknown jobId`; transport failure or an accepted job refuses mutation. A comparison of every contract field except prompt ensures job ID, sources, schema, payload, timeout and retry budget stay unchanged. The repaired prompt is 19,538 characters. Command Center then accepted the same job ID for real execution. No model limit, lease, lifecycle or queue record was changed. This adds no collaboration stage or retry budget. Focused fixture verifies archive, identity, transport refusal and absence before repair.

Final dashboard verification again showed the provenance issue and blocked rendering readiness at mobile 390×844 and desktop 1440×1000, with no horizontal overflow or console errors. Open proposal/provenance details survived refresh; observed API responses were HTTP 200. `mobile-review-verification.png` is retained in the `2026-10-11T21-07-04-559817Z` recovery report. No proposal approval or production render was submitted.


## Coherent production assembly and provenance

Real Wand or Steel 01 raw revisions chose the approved “Two weapons, separate rolls” opening but independently selected scenes and storyboard from different supported variants. Rejection preserved both raw revisions and retained the previous valid candidate. This verified production contract defect motivated `assembleCreativeStoryboard`: it can replace only the storyboard with the exact matching persisted renderer storyboard when both independently supplied pieces are already supported. It refuses ambiguous target pairings, non-unique raw storyboard origins, invented fields, unapproved assets, unknown copy and hook/scene mismatch. It does not upgrade a headline, choose a new concept or treat layout variety as another proposal.

Specific Bonsai pacing requests can also append one source-preserving option: an unambiguous correction must explicitly name a 4–8 second middle-scene hold; conflicting requests and mismatched named scenes are refused together. The complete result stays within the existing 15–35 second constraint and six-option ceiling. Timing changes never qualify as extra concepts. Copy, assets, claims, narrative and direction ID remain unchanged. The native revision binds the selected complete timing option; invalid/conflicting critique IDs cannot be claimed accepted. Deterministic pacing fixtures pass; no completed production benefit is claimed from timing fixtures.

Every derivation preserves the model receipt/value, raw failed validation, derived validation, exact prior plan, variant indices, snapshot and hashes in a create-only artifact. Full fact, evidence, identity, asset, duration, distinctness and plan validation still runs; the resulting candidate goes to the existing Bonsai review stage. Missing proof, altered model bytes, changed plan prefix or unsupported/empty accepted-correction records fail fresh approval. Appended supported options are permitted only after the exact original plan prefix is verified. Accepted visual corrections are independently recomputed from their original plan and immutable critique/revision before being trusted. No additional model stage or revision budget was introduced.

Repeated real native-schema outputs independently chose different approved hooks, scenes and storyboards. Future writer intents now bind one coherent supported composition atomically: the same `creativeExample` supplies the full scene array, storyboard, standalone hook and duration as native constants. Specific valid Bonsai criticism still selects the next supported variant; full choices and approved evidence remain in the structured payload. This changes neither the concept catalog nor model stages/budgets. A focused fixture verifies the atomic contract and critic-selected next variant. Previously accepted durable jobs keep their original immutable contracts. The older supported-piece assembler remains a guarded compatibility path for those jobs.

The service fixture verifies raw failure preservation, unchanged non-storyboard fields, immutable artifacts, normal stage 2→3, restart without a duplicate artifact, final Bonsai PASS fixture and pending human approval. This is explicitly synthetic, not a recovered production example. No terminal pilot was reopened to apply this later fix retrospectively.

Real Wand or Steel 02's last Qwen revision selected “A skill point has prerequisites.” in the top-level hook while its renderer still opened “Explore Survival, Logistics and Fortune branches.” Its evidence IDs, direction and assets were unchanged. The factory refused the inconsistent hook and retained the prior valid candidate. The former generic identity message is now a specific hook/first-scene coherence explanation. It remains a blocker, not a successful recovery.

## Real bounded recovery results

Find My Needs 01/02, GigWise 01 and Wand or Steel 01/02 each completed the real local bounded workflow and remained NEEDS_REVISION after two revision rounds. Raw drafts, revisions, critiques, final reviews and unload receipts are preserved. Find01 includes one actual context-truncation retry; Gig01 includes the verified unsubmitted-prompt repair described above. No third revision, forced editorial verdict, approval or unapproved render was performed.

Representative production examples:

- Rejected near-duplicate: original GigWise 01/03, equal substantive script/hook overlap and render sequence; different angle labels do not distinguish them.
- Genuinely different draft: the Find My Needs 01 organizational-table explanation and Find My Needs 02 action-completion versus need-resolution explanation have different approved evidence and substantive visual sequences. Both were real new drafts that passed deterministic checks; neither obtained an editorial PASS. The stronger preservation guard separately blocks the ambiguous Find02 factory correction.
- Recovered completed proposal: none is claimed. Eight eligible fresh attempts were queued with the original attempts archived; three remain pending/in progress at the delivery checkpoint. Synthetic restart/approval fixtures demonstrate the mechanism without substituting for production success.
- Correctly blocked: Terra 01–03 still require real approved gameplay footage and matching footage composition. GigWise 02 still requires unavailable mileage artwork; an unrelated expense-category concept is not a faithful replacement.

## Remaining operator work

Use the existing source/asset approval controls to review additional distinctive, project-specific creative copy and real product/gameplay recordings. Terra's explicit footage requirement remains mandatory. Current finite coverage cannot support ten distinct concepts per brand. The five exhausted recovery pilots need human editorial/source review; their budgets were not reset. Do not approve the six historical duplicate packages to inflate counts. The existing dashboard supplies raw scripts, storyboards, source claims, critiques, related proposals and exact blocker explanations.

All changes are in the factory only. No Command Center model/lifecycle code, source approvals, game/application repositories, launchd configuration or deadline was changed. No commit or push was performed. Backend source changes are loaded at idle paused boundaries only after authoritative Command Center STOPPED/no-running/no-blocker verification, then RUNNING is restored. Verification pauses are reported rather than attributed to model time or Mac sleep.

## Verified atomic-contract inference

The actual Whodunnit 03 final authorized Qwen revision (`2026-10-12-primary-projects-whodunnit-03-creative-creative-20b86b1e6a8b96e0296e-r1-stage2-attempt0`) matched the native constants exactly for hook, scenes and storyboard. It passed all deterministic checks with no errors or duplicate IDs. The opening was “Added words are marked as additions.”; prior independent-enum revisions had disagreed between the standalone hook and renderer. Source claims and assets remained unchanged. Actual `qwen3:14b-q8_0`: load 18.552s, inference 129.829s, unload 0.069s, verified STOPPED at `2026-10-11T21:54:52.208849Z`. Exactly two revision versions exist in this fresh attempt; no budget reset or extra model stage occurred. This verifies the atomic coherence fix on real local inference; it is not a controlled runtime benchmark or an editorial PASS. Final Bonsai review determines the terminal result recorded in the delivery snapshot.

## Delivery snapshot

Captured 2026-10-11T21:58:33.585172+00:00. IMPLEMENTED: structured distinctness, source-bound creative directions and visual layouts, atomic writer contract, bounded pacing options, recovery archives, provenance/factual/asset checks and dashboard review. TESTED: 86 factory tests; TypeScript/JavaScript/Python checks; real desktop/mobile browser; six real bounded collaborative attempts and a real repaired atomic-contract revision. RUNNING: existing campaign and launchd with unchanged deadline. COMPLETED: implementation/verification/export artifacts. BLOCKED: no newly completed editorially accepted recovery proposal.

| Project | Historical stored completions | Newly completed recoveries | Currently approval eligible |
|---|---:|---:|---:|
| Whodunnit | 4 | 0 | 0 |
| GigWise | 2 | 0 | 0 |
| Terra / Steam Tycoon | 0 | 0 | 0 |
| Wand or Steel | 0 | 0 | 0 |
| Find My Needs | 0 | 0 | 0 |

All six original completed slots and all three approved registries remain hash-identical to baseline. Fifty slots and 194 stage versions remain preserved. Statuses: 13 NEEDS_REVISION, 3 GENERATING, 21 NEEDS_SOURCE (approved-composition coverage), 1 PENDING, 4 NEEDS_ASSET, 6 historical AWAITING_APPROVAL, 2 FAILED. The six stored completions are duplicates under the stronger audit; none is currently eligible for approval. Two of eight fresh creative attempts remain queued/in progress. No completed row was resubmitted.

Six fresh attempts completed their real bounded workflows and remain NEEDS_REVISION. All 37 consumed real local stage receipts across those attempts reached verified STOPPED using the registered Qwen/Bonsai models. Current in-progress inference is separately identified; its completion is not assumed. Whodunnit 03's repaired final Qwen revision passes deterministic validation, but final Bonsai says REVISE: feature-stating hook without a visual demonstration, repeated scene headline and unclear copy hierarchy. Its proposal remains auditable and unapproved. No third revision or extra editorial stage was initiated. Timing-option support is tested in fixtures and loaded for subsequent eligible jobs; no real timing recovery success is claimed at this checkpoint.

Historical throughput: 0.569 stored packages/hour, about 77.36 hours for 44 more versus 19.02 hours until deadline. This arithmetic overcounts six duplicate packages and includes verification pauses; it cannot forecast 50 distinct concepts. Source/asset limits are harder blockers. The earlier successful-only mean runtime projection of roughly 13.6 hours ignores failures, source approval, duplication and optional revisions and is optimistic.

Recorded lifecycle means: Qwen inference 99.833s, load 13.618s, unload 0.153s; Bonsai inference 49.673s, load 10.651s, unload 0.475s. Recorded queue wait means: Qwen 1.698s, Bonsai 3.389s. Known switch components sum to roughly 49.79s for four stages; uninstrumented wall-time gaps are not assigned speculative causes. Factory phase details and sample counts are in report.json. Largest demonstrated avoidable errors were context truncation, oversized unsubmitted prompt and incoherent independently selected native fields. Native coherence passed real verification; a controlled complete-proposal speed improvement is not claimed.

Review: existing dashboard `http://127.0.0.1:4317/`. Final desktop/mobile checks show pending editorial status, approved evidence, supported visual approach, precise validation/provenance failures, related proposals and withheld approval controls; no console errors or horizontal overflow. Expanded details survived refresh. This verifies running review flows; no new production render/FFmpeg QA is claimed for unapproved proposals. The eight static React layout verification frames remain explicitly synthetic verification artifacts.

Final recovery report directory: `data/campaigns/2026-10-12-primary-projects/creative-production-recovery/2026-10-11T21-58-33-585172Z`. It contains SUMMARY.md, report.json (all 50 blockers, comparisons, runtime and preservation), baseline.json, pilot-results.json, verification.json, git-status.txt and browser screenshot. Campaign review export: `data/campaigns/2026-10-12-primary-projects/exports/2026-10-11T21-58-32-722Z-f36f3232`; complete proposals, per-project lists, provenance and blockers are preserved alongside earlier exports.

Git remains on main, starting/ending revision `b6c0500463202cd53bffa2b3f71b248db4428caf`, with the listed factory edits uncommitted. No push, publication, automatic source/asset/proposal approval or unapproved render was performed. Command Center code/lifecycle/scheduler and other repositories were unchanged. Its earlier 91-test baseline was not rerun for these factory-only changes; the model verification above uses actual new local inference receipts.
