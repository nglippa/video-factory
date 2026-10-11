# Editorial convergence

Implemented on October 11, 2026 in Video Factory, on the existing uncommitted recovery work. Git HEAD remains `b6c0500463202cd53bffa2b3f71b248db4428caf`. No commit or push was performed. Command Center code, model configuration, lifecycle, exclusive inference leasing and launchd schedules were unchanged. Only the related Video Factory application was reloaded, after confirming zero active campaign slots, zero factory operation leases and a verified STOPPED Command Center session. Existing queued production jobs were preserved.

The workflow now separates deterministic factual/asset checks, distinctness heuristics, subjective editorial judgments and authoritative human approval. Passing validation does not establish creative excellence. Neither subjective disagreement nor an exhausted revision budget automatically destroys a compliant candidate.

## Implementation

- `src/editorial.ts`: ACCEPT, REVISE, RETAIN_PREVIOUS and ABSTAIN parsing; candidate/source/prior hashes; concrete field/defect/correction requirements; applicable observations; exact comparison differences; explicit legacy adaptation.
- `src/campaign-domain.ts`: compatible review parsing and separate core hard-validation assessment, alongside distinctness and overall readiness. Historical validation objects remain unchanged.
- `src/campaigns.ts`: persisted decisions with actual model identifiers, reasoning, evidence, corrections and validation status; previously selected valid candidate tracking; fresh validation before retaining/approving; bounded targeted revisions; immutable creative-review handoffs; comparison artifacts; separate fresh and historical totals.
- `src/distinctness.ts`: `structured-composition-v2`, explained below.
- `src/campaign-blockers.ts`: evidence and human creative-review classifications.
- `src/server.ts`: existing proposal-review endpoint accepts `creative-review` handoff.
- `web/app.js`: original/revised/selected scripts, exact changes, Bonsai feedback, validation, distinctness, assets and human review states in existing expandable proposal details. Uncertain candidates require an individual explicit approval reason and are excluded from bulk approval.
- `scripts/evaluate-editorial.ts`: representative Whodunnit/GigWise analysis and optional bounded real inference through the existing Command Center bridge. It uses an isolated SQLite backup and defers for active campaigns, production demand or resource gates. No automatic approval/render/publication.
- `tests/editorial.test.ts` and `tests/creative-recovery.test.ts`: contract and integration coverage.

Pre-existing changes to backlog, CLI, domain, rendering and other tests were preserved; they were not rebuilt as part of this task. The final Git status below includes those earlier changes.

## Decision and revision behavior

Every new critic response identifies the candidate, exact source snapshot and prior candidate, its decision, specific reasoning, observations and required corrections. Host persistence adds the real model family/identifier and deterministic validation status from the immutable result. A model cannot change factual validity by asserting a different validation acknowledgement.

REVISE requires a supported field, observable defect, concrete correction and applicable observation. Generic engagement requests do not start another writer round. New ACCEPT or non-actionable REVISE skips the unnecessary Qwen round and proceeds to independent final Bonsai review. Legacy queued response shapes remain parseable and their original receipts remain immutable. A legacy factual BLOCK also stops rather than starting an editorial loop.

Writer revisions constrain unrelated metadata to its previous value; existing supported scene/storyboard binding preserves approved wording and assets. Full JSON remains the existing transport format, but unrelated script regeneration is not requested. A changed field is comparison evidence, not proof of improvement. Claiming an accepted correction without changing it does not establish improvement. The existing guarded factory assembler can apply only independently validated, supported renderer corrections, with its original immutable provenance requirements intact.

A rejected factual revision or unchanged targeted revision preserves the prior valid candidate and the raw rejected output. Final Bonsai sees the previously selected valid candidate, rather than an arbitrary invalid raw revision. Tracked hashes survive SQLite restart and are checked before comparison. RETAIN_PREVIOUS revalidates the earlier candidate before selecting it; it does not label it editorially accepted. ABSTAIN and unsupported-claim concerns stop in NEEDS_EVIDENCE and cannot be approved through the subjective override path. Missing assets and other hard failures remain blocked.

Maximum two revision rounds per attempt remains unchanged. Concrete final REVISE may use remaining budget; exhausted/non-actionable subjective feedback stops in NEEDS_HUMAN_CREATIVE_REVIEW. Hard-valid human-review candidates are not counted as editorially accepted. Explicit human approval remains necessary and performs fresh source, fact, asset, distinctness and derivation checks.

## Distinctness audit

The six historical completions were examined directly from campaign slots, not inferred from rendered-video filenames. Whodunnit 01/02/07/09 have identical substantive copy, opening and rendered composition; their core hash, excluding timing, is `ad218d87dc2c9194`. GigWise 04/05 likewise share core hash `5bb32ceca528ca9b`. Titles/angle labels did not establish different narratives. Shared hooks, evidence and composition occur together here; evidence reuse alone was not the reason for rejection. These six original audit failures remain justified.

Version 1 had two specific defects: creative-direction ID equality could reject substantively different stories by itself, and visual sequence compared layout names without actual asset IDs. Version 2 requires substantial script similarity and the same content base before direction identity contributes to blocking, and compares actual approved asset sequence. It still rejects exact/near copies, superficial rewrites, opening-only rewrites and decorative same-script layout variants. Different audience labels or narrative metadata alone do not prove distinctness. Same feature/evidence can support distinct execution when substantive explanation and storytelling differ. Actual media identity contributes to comparison; changing an asset is not factual or creative approval.

Synthetic fixtures cover exact, near, superficial, same-feature/different-script, same-direction/different-story, actual asset sequence and genuinely different approved compositions. They are explicitly synthetic, not newly successful production proposals. This remains a conservative lexical/composition heuristic, not semantic truth or a creative-quality score. Human comparison is still needed in borderline cases.

Previous `structured-composition-v1` outcomes are retained in their historical reports and stored validation. Fresh dashboard/report views carry v2 separately. No historical validation was silently replaced.

## Actual creative comparison and review outcomes

Whodunnit 03: original concept “Word-level change inspection”; original hook “Added words are marked as additions.” The actual recovery draft already uses headline/comparison/relationship/headline. Later Qwen outputs are retained and compared exactly; valid original selection is distinguished from raw incoherent revisions. Final Bonsai REVISE cites feature-stating hook, repeated scene-two headline and scene-three copy hierarchy. Fresh evidence, assets, creative binding, provenance and distinctness passed. The original slot was archived before an explicit human creative-review handoff.

GigWise 01: original concept “Business purpose in expense entry”; hook “Give the expense context”; headline/sequence/relationship/headline. Final Bonsai REVISE cites hook context, overlap between middle scenes and static-text engagement. Available approved explanatory geometry is distinguished from unavailable product UI footage. Fresh evidence/assets/distinctness checks passed and the original slot was archived before handoff.

Both now have NEEDS_HUMAN_CREATIVE_REVIEW, deterministicallyValid=true, editoriallyAccepted=false, approved=false. No new editorial ACCEPT was observed under the new contract. None was automatically approved, rendered or published. Six historical duplicate packages retain their original slot states and records; fresh approval controls and completion counts exclude them.

Compact comparisons for every proposal include original concept/script, revised script, selected script, exact field differences, Bonsai feedback, final decision, factual validation, v2 distinctness, assets and human eligibility. Available at the running existing dashboard, `http://127.0.0.1:4317/`, and in the versioned JSON artifacts.

## Real inference and throughput

A real-inference preflight was executed through the existing integration for Whodunnit 03 and GigWise 01. Both were deferred because two queued production jobs have priority. No model job was submitted by this task. The temporary runner’s initial ES-module error happened before submission and was corrected; the corrected runner also deferred. The checked-in evaluator records the same priority refusal. No stale PID/lease marker was cleared, no active campaign interrupted and no resource-manager setting changed.

The campaign's last already-active Bonsai review finished normally during inspection, with verified unload. Its receipt belongs to the earlier recovery attempt, not a new-contract success. The eight completed recovery attempts below use actual persisted records, including the two that finished after the earlier six-attempt checkpoint.

| Metric | Actual historical result |
|---|---:|
| Completed recovery attempts | 8 |
| Revision attempts | 16 |
| Editorial acceptances | 0 |
| Editorial acceptance rate | 0% |
| Exact original-candidate retention | 25% (2/8; all proposal fields equal) |
| Exact original-script retention | 75% (6/8) |
| Attempts with retained previous candidate | 25% (2/8; four recorded hard-rejection events) |
| Abstentions | 0% under historical PASS/REVISE/BLOCK vocabulary |
| Known hard revision rejection events | 4 |
| Recorded parse/truncation failures | 1 |
| Mean wall time per candidate | 838.290 s |
| Mean recorded load/infer/unload per candidate | 628.365 s |
| Time per accepted candidate | Undefined: zero accepted |
| Verified STOPPED stage receipts | 49 |
| New-contract real inference receipts | 0 |

Wall time includes actual queue/verification gaps between first receipt creation and final completion; it is not presented as pure model latency. Known rejection events are a lower bound on factual validation failures, not a complete retrospective rescore of all model outputs. Retaining a previous candidate is not always retaining the first draft; both rates are defined separately above.

The fixtures demonstrate avoiding a writer inference for accepted/non-actionable criticism and preserving candidates rather than generating unrelated changes. A production throughput improvement or stronger new-model editorial acceptance has not been demonstrated. Real comparative evaluation remains deferred behind production priority; no speedup, acceptance gain or forecast is fabricated.

## Verification and preservation

Baseline: 86 existing tests passed. Final: 99/99 tests passed with `npm test`. `npm run typecheck`, `node --check web/app.js` and `git diff --check` passed. Tests cover decision parsing/provenance, specific revision requirements, generic feedback skipping, retention, abstention, budget exhaustion, unsupported-claim rejection, fresh human eligibility, v2 audit versioning, reopening SQLite, immutable originals, guarded legacy assembly and dashboard comparison payloads.

Real Playwright verification used the running factory after an idle related-app reload. Desktop 1440×1000 and mobile 390×844: expanded original/revision and review-state explanations render; safe candidates show individual creative-review approval, with no bulk checkbox; six duplicates have no eligible approval controls. No horizontal overflow or console errors; observed API requests returned HTTP 200. Expanded details persist through polling. No approval or rendering action was exercised. Screenshots include visibly opened project/proposal sections, not just hidden DOM content.

All 2,455 files in the task preservation baseline retain their original SHA-256. All six original completed campaign records match their previous canonical hashes. Source registries, approved assets, launchd scheduling, historical exports/audits, model receipts and original versions were preserved. Two handoff artifacts contain the complete original slots and fresh validation, created with exclusive-write semantics. Existing campaign history was appended, not rebuilt. The original candidate outputs were not rewritten.

Artifacts: `data/editorial-convergence/2026-10-11T22-44-38-286Z/`: comparison.json, evaluation.json, report.json, final-state.json, browser screenshots and Git status. Handoff originals are under `data/campaigns/2026-10-12-primary-projects/editorial-handoffs/`. `data/editorial-convergence/baseline.json` records the preservation file hashes. Earlier artifacts remain unchanged; final-state.json records the newer fresh approval count separately from report.json's earlier checkpoint.

Remaining blockers: production queue prevents new local inference evaluation; the real new contract and comparative creative-quality/throughput benefit remain unverified. Approved footage/evidence coverage still limits Terra and further concepts for the other projects. Human creative review of the two valid candidates is outstanding. Six historical completions are still duplicates. No 50-proposal completion claim is made.

The optional independent Claude review was rejected by automatic approval review because sending repository source to Anthropic lacked explicit authorization. The user chose local review only; no paid review ran and that rejection was not bypassed. The attempted workflow used the [Claude review skill](/Users/nicholaslippa/.codex-account-2/plugins/cache/claude-in-codex/claude-in-codex/0.10.0/skills/collaborating-with-claude/SKILL.md).

## Final Git state

No commit or push. Existing dirty work remains intact.

```text
 M src/backlog.ts
 M src/campaign-domain.ts
 M src/campaigns.ts
 M src/cli.ts
 M src/domain.ts
 M src/server.ts
 M src/video/index.tsx
 M tests/campaigns.test.ts
 M tests/server.test.ts
 M web/app.js
?? docs/CREATIVE-PRODUCTION-RECOVERY.md
?? docs/EDITORIAL-CONVERGENCE.md
?? scripts/evaluate-editorial.ts
?? scripts/report-creative-recovery.py
?? src/campaign-blockers.ts
?? src/creative-directions.ts
?? src/distinctness.ts
?? src/editorial.ts
?? src/rendered-history.ts
?? src/video/creative-scene.tsx
?? tests/creative-recovery.test.ts
?? tests/editorial.test.ts
```
