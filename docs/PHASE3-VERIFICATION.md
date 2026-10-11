# Phase 3 verification — reviewed knowledge and Qwen ideas

Verified on October 11, 2026 in the existing working tree and local factory at http://127.0.0.1:4317.

## Resumed state and completed work

The factory was paused with the persisted reason `Phase 3 restart verification: let active inference finish`. Whodunnit's weekly run `096b08b7-9426-4137-a547-c98fc91c95a3` was complete; GigWise's weekly run `a3f5ad05-9613-4cc3-b86a-b50f961a6ec4` remained queued with zero attempts. Ollama had no loaded models.

The existing changes add a hash-pinned, explicitly reviewed local knowledge registry, three-candidate Qwen runs, deterministic evidence/duplicate checks, constrained ranking, weekly scheduling, proposal approval and backlog binding. The resumed work fixed:

- Structured inference previously returned successful output even when unload or loaded-model verification failed. Success now requires both checks, including cleanup after caller cancellation; original errors and cleanup diagnostics are retained separately.
- Generation allowed arbitrary asset strings and unavailable media templates. It now restricts both to reviewed, available production inputs and rejects empty exact-value sets before calling Qwen.
- Missing model citations caused otherwise supported text to fail. Evidence is now derived from exact selected text/kinds and the original Whodunnit before/after pair, while raw output remains in provenance. Unsupported text, unknown IDs and unapproved assets still fail validation.
- Ranking now constrains IDs and result count. Failed ranking responses remain inspectable; ranking unload/cancellation failure aborts the run without persisting partial candidates.
- Run details displayed whole model objects; the dashboard now shows model names.
- The scheduler recovery test used a daytime timestamp outside the current overnight window. It now uses an in-window timestamp and an isolated empty idea-schedule fixture.

## Real Qwen run

The paused factory LaunchAgent was restarted to load the fixes, preserving the two weekly run IDs and the pause state. Clearing the temporary verification pause let the existing GigWise run finish on attempt 1. It reached `COMPLETE` at `2026-10-11T05:55:14.239Z`, with no run or ranking error.

Both generation and ranking used the installed `qwen3:14b-q8_0`, digest `304bf7349c71ad37a07eec8be67212b3f05b0f243f4a6f7c98e90dd2f3009f48`. Generation produced 385 tokens from 671 prompt tokens; ranking produced 102 tokens. Both recorded `attempt.unload.ok=true`. A subsequent live `/api/ps` check returned `{"models":[]}`. No packages or model weights were downloaded.

| Candidate | Topic / hook | Result |
| --- | --- | --- |
| `c3b46782-6737-4c0a-83e3-559abcb46817` | Track mileage, receipts, and business expenses. / Record the date and business purpose. | Awaiting idea approval; clarity 4/5 |
| `303fa71f-2091-4414-802a-ad3721700ac4` | Keep the receipt with the expense. / same hook | Awaiting idea approval; clarity 3/5 |
| `e27800dc-beaf-41c2-8f05-b3a63c92dd59` | Recordkeeping education. Not tax advice. / same hook | Rejected by the existing broad tax-wording rule |

All three used no additional assets. The two valid proposals have exact selected-source evidence for text, audience, CTA and template. They remain unapproved, with no backlog binding or generated video. Raw generation, resolved candidates, ranking, model requests and source snapshots are retained in `data/idea-runs/a3f5ad05-9613-4cc3-b86a-b50f961a6ec4.json` and SQLite events.

The earlier Whodunnit run remains unchanged: its three proposals were rejected for missing citations, unapproved assets and duplicate content. It predates these fixes; no new Whodunnit inference was needed to resume the queued GigWise run.

## Checks

- `npm run typecheck` passed.
- Full host `npm test` passed, 43/43. Test artifacts used `DATA_DIR=/private/tmp/video-edits-phase3-tests`. Loopback adapter/API tests require host access because the filesystem sandbox denies listening sockets.
- Coverage includes exact/unsupported evidence, schema restrictions, empty usable-copy sets, ranking diagnostics/unload failures, cancellation cleanup, source hash/path protection, forged approval bindings, retries, job priority, leases, weekly timezone slots and restart deduplication.
- `git diff --check` passed.
- Playwright verified the running dashboard at 390 × 844 and 1440 × 1100. Knowledge excerpts, valid proposal evidence, ranking, rejection reasons and correct model names rendered without horizontal overflow. Incomplete projects disabled generation. Evidence refresh returned 200. Inspected API requests succeeded, with zero browser console errors.
- Screenshots were inspected: [desktop](phase3-dashboard-desktop.png), [mobile](phase3-dashboard-mobile.png).
- A final LaunchAgent restart loaded the schema safeguard and preserved both completed run IDs, attempt counts, two awaiting-approval proposals and `paused=false`, without duplicate runs. The service's short restart interval briefly refused connections; the subsequent live dashboard/API check passed with no console errors.

The final factory state is `paused=false`, `error=null`; the production window remains 22:00–06:00 America/Chicago. No public publishing or live proposal/video approval was performed. Bonsai real inference and video rendering from a newly approved proposal were not exercised in this verification; existing video artifacts remain available for review. Exact-source constraints limit variety, and the current tax-wording check also rejects disclaimers containing the word “tax”. Before/after evidence support is specific to Whodunnit's registered original pair.
