# Local Video Factory — Phase 2 verification

This records Phase 2 behavior at verification time. The current source-grounded idea workflow and overnight production window are documented in [Phase 3 verification](PHASE3-VERIFICATION.md).

Verified on October 10–11, 2026, America/Chicago. The implementation extended the existing TypeScript/SQLite/Remotion application. No public publishing was performed.

## Revisions and starting state

Starting git revision: `82a4a0fcef997d011154858c4858fc00f180cefe`.

The final revision is the commit containing this report, reported explicitly in the completion response; obtain it with `git rev-parse HEAD`. Existing untracked `.serena/` and `graft/` directories were preserved and excluded from the change.

Phase A finished before production behavior changed. README.md, docs/VERIFICATION.md, the model/pipeline/store/render paths, compositions, dashboard, schedules, tests and actual artifacts were inspected. Graph coverage had no recorded issues for the existing source paths; authoritative source was also read. Baseline TypeScript validation and 19/19 tests passed on the host. Sandbox-only HTTP checks initially failed because loopback access was prohibited; host checks established actual availability.

The documented Whodunnit job `31d7c691-098b-4a8f-ab16-f61a5f3dd639` and GigWise job `b5fd55b1-5d1c-4d4a-8fa0-e136f3045da9` were each confirmed as 1080×1920, H.264/yuv420p, 30 fps, stereo AAC 48 kHz, 20 seconds / 600 frames. Full decoding passed. Recomputed video, composition and renderer hashes matched their stored metadata. Their stored Ollama responses contain the installed Qwen identity, positive token counts, generation timings and valid structured scripts. Both played through to ended=true in the running browser.

Baseline production calls Ollama, validates JSON and restricts wording to approved project copy. No production fixture, mock response or fixture fallback was found in src/ or web/. Tests intentionally use isolated HTTP fixtures. The approved synthetic Whodunnit example is content, not a mock model response. The original scheduler only enqueued fixed daily content; it lacked a structured backlog, production windows, persistent pause and automatic ordinary-failure retry backoff.

## Implemented behavior

- Installed-model discovery selects the smallest text Qwen with a known positive size ≤16 GB unless explicitly configured. Missing, unsuitable or oversized explicit models fail clearly; no downloads occur.
- Qwen requests structured JSON with constrained approved strings, followed by Zod and project/content validation. Incomplete responses and mismatched model identity fail. Endpoint, digest, size, request/response, options, inference counts/timings and unload outcomes are retained.
- Bonsai availability, skipped/failed/completed editorial state and accepted editorial changes are explicit. Auto-discovery never silently substitutes a different model. Refinement cannot add new words or alter protected identities, ordered lessons, the synthetic pair or CTA.
- SQLite adds production control, retry deadlines and a strict backlog with atomic idea/job bindings. New imports become DRAFT. Content approval and completed-video approval are separate. Bound ideas cannot be edited; regenerated jobs inherit no approval.
- Per-project daily schedules select approved unused ideas. Schedule ID + local date keys prevent duplicate jobs or consuming a second idea for the same slot. Other valid slots continue when one slot fails. Errors persist and appear in the dashboard.
- New work respects persistent pause, an explicit production window, disk reserve and memory pressure. One job runs globally; rendering concurrency is at most two. Active jobs may finish after pause/window closure. Cancellation aborts factory requests/rendering and is terminal.
- Ordinary failures retry after 30 and then 60 seconds, with at most three total attempts. Stale leases recover after restart; stale owners cannot alter or finalize reclaimed jobs. Failed attempts retain diagnostics. Exhausted jobs can be regenerated after their cause is corrected.
- Dashboard adds backlog review, pause/resume, script preview, model provenance, explicit editorial results and regeneration. Labels distinguish draft, scripting, rendering, technical QA, editorial review, ready for approval, approved, rejected, failed and cancelled. No publishing route exists.

## Exact model and tool configuration

| Setting | Verified configuration |
| --- | --- |
| Ollama URL | `http://127.0.0.1:11434/` |
| Selected model | `qwen3:14b-q8_0` |
| Selection | QWEN_MODEL unset; only installed eligible text Qwen |
| Weight size | 15,895,155,363 bytes |
| Digest | `304bf7349c71ad37a07eec8be67212b3f05b0f243f4a6f7c98e90dd2f3009f48` |
| Generation | `/api/generate`, stream=false, JSON schema, think=false |
| Options | temperature=0, seed=42, num_ctx=4096, num_predict=1400 |
| Lifecycle | keep_alive=0, explicit unload, then `/api/ps` check before rendering |
| Managed Ollama | OLLAMA_NUM_PARALLEL=1, OLLAMA_MAX_LOADED_MODELS=1, OLLAMA_HOST=127.0.0.1:11434 |
| Render | Remotion 4.0.534; concurrency=2; Chrome; FFmpeg/FFprobe 9.0.2 |
| Runtime | Node 26.9.0; Ollama 0.34.4; M4 Pro; 25,769,803,776 bytes unified memory |
| Bonsai | unavailable; BONSAI_MEMORY_SAFE unset/false; refinement SKIPPED |

The existing Qwen weights were reused. Other installed models include a larger Qwen coder, which is excluded, and non-Qwen models, which are not substituted. Final doctor found no loaded Ollama models. Machine-readable doctor output is in `data/phase2-doctor.json`.

Bonsai adapter contract: GET `/v1/models`; configured `BONSAI_MODEL` must match a returned ID, otherwise discovery requires a Bonsai-named ID. POST `/v1/chat/completions` uses model, temperature=0, system/user messages and JSON response format (disable with BONSAI_JSON_MODE=false only when the compatible server requires it). BONSAI_BASE_URL is HTTP loopback, with optional /v1 prefix. No actual usable model identifier was reported by a server. No Ollama assumption is made.

Discovery found no listener on ports 8000, 8080, 1234 or 8001. The inspected Hugging Face `prism-ml/Ternary-Bonsai-2-27B-gguf` and `...-mlx-2bit` cache directories contain only refs, approximately 4 KB each, and no snapshots/blobs/weights. No matching weights were found in the inspected model/Downloads directories. No `llama-server` or `mlx_lm.server` executable was on PATH; the inspected Python environment lacks mlx_lm, llama_cpp and vllm. This is bounded discovery, not a claim about every file/environment on the Mac. No Bonsai packages or weights were downloaded. Real Bonsai inference remains unverified; successful Qwen production explicitly skipped refinement.

## Real Phase 2 production artifacts

Both jobs were selected by the live server's scheduler from the two approved backlog entries. They were not submitted as fixture jobs. The factory process was already managed by launchd. Their stored creation keys are `schedule:whodunnit-daily:2026-10-10` and `schedule:gigwise-daily:2026-10-10`. A temporary explicit 22:00–06:00 window allowed this late-night verification; the final configuration restores 08:00–22:00.

| Project | Job ID | Duration / frames | Bytes | Qwen tokens |
| --- | --- | --- | --- | --- |
| Whodunnit | `3d582c94-7540-41cc-a359-ce037c5a6cc5` | 18 seconds / 540 | 1,001,332 | 258 |
| GigWise | `4656d25a-b4a0-4f0a-a428-71042e142753` | 20 seconds / 600 | 1,108,530 | 240 |

Both completed on attempt 1 and remain `READY_FOR_REVIEW` (dashboard: Ready for approval), qaPassed=1, with linked backlog ideas `READY_FOR_APPROVAL`. Neither was approved or published. Qwen chose the scene durations; duration QA checks their actual sum, not a hardcoded 20 seconds.

Each `data/artifacts/JOB_ID/` contains video.mp4, poster.jpg, script.json, profile.json, request.json, model-attempts.json, model-metadata.json, metadata.json and qa.json, plus its isolated attempt directory. Metadata retains the originating structured content idea and human approval requirements.

Video SHA-256:

- Whodunnit: `07719e55cee14ebdf0b9c504767101b2fc115038b08b781206b1c4c99eaa11a6`
- GigWise: `a6e136dd0bee1190f3c301b86613837e665260550b1102865858c5899cbe9fa3`

Hashes were recomputed and matched metadata. Composition hashes also match final source. Both passed nine checks: dimensions, codec, pixel format, frame rate, duration, frame count, stereo AAC, nonempty size and complete FFmpeg decode.

## Visual and browser verification

The original and new MP4s were inspected from actual decoded frames. Typography, hierarchy, margins, brand identity, synthetic labels, lesson copy and CTA were checked. Primary headlines remain readable; secondary text/disclaimers were enlarged. Whodunnit's crossed-out original now has more contrast, its closing brand mark is visible, and the CTA remains visible at the final frame. GigWise's second lesson now uses a receipt-to-expense relationship rather than repeating the first lesson's list. No product screenshot, capability, tax rule, detector result or gameplay asset was fabricated. Motion uses brief reveals and a drawn relationship, followed by readable holds. Brand colors and local fonts are preserved. Hook wording is approved brand copy; effectiveness has not been measured by a marketing experiment.

Both new videos played through in the actual dashboard with ended=true and correct dimensions/durations. One automation attempt changed preview selection and timed out; retrying with an explicit job identity successfully completed GigWise playback. No underlying media error was observed. Playback checks were muted; audible subjective audio quality was not independently certified. Audio passed full decoding and technical QA.

Browser checks exercised pause/resume, script/provenance previews, QA, backlog details and regeneration/cancellation. Regeneration created job `74c0d0d7-5029-4b7c-a6ce-c13b2e4256b1`, QUEUED with qaPassed=null; it was cancelled before any inference (attempts=0). Its original parent remains review-ready. Backlog details stay open across polling refresh.

Final desktop 1440×1000 and mobile 390×844 views had no horizontal overflow. Final navigation had zero console errors/warnings and all captured requests were HTTP 200 or video-range 206. Final-source service restart retained previews, jobs, pause settings and backlog bindings. Production approval remains the human operator's action; approval/rejection guards were tested in isolated databases/HTTP tests rather than approving these real films.

Evidence: [Whodunnit scenes](phase2-whodunnit-review.jpg), [GigWise scenes](phase2-gigwise-review.jpg), [desktop dashboard](phase2-dashboard-desktop.png), [mobile dashboard](phase2-dashboard-mobile.png).

## Scheduler and launchd verification

The scheduler autonomously created the two real production jobs without an open factory terminal. Reruns of the same daily slots returned the same jobs. The database restart test preserved pause state and idea/job bindings. Simulated invalid scheduler JSON persisted an error; after reopening the database and correcting the file, the scheduler recovered and cleared the error without duplication. A simulated crashed worker lease was reclaimed as attempt 2; stale-owner writes were rejected. Tests also cover 30/60-second backoff, retry exhaustion, queued cancellation and blocked tax ideas.

Live pause/resume was verified in the browser; pausing did not abort an active render. Memory pressure during Qwen loading blocked new work; Qwen was unloaded before rendering. The late-night test window was restored to 08:00–22:00 and the live API now correctly reports Outside production window, paused=false, error=null. Disk reserve is 2 GiB; on macOS memory_pressure -Q must report >10% available, with a 1 GiB free-memory fallback on other hosts. Resource observations are cached for 10 seconds; pause and window settings are checked fresh.

Installed agents: `local.video-factory` and `local.video-factory.ollama`, both confirmed running under launchd. The originally shell-started, idle Ollama endpoint was handed over to its LaunchAgent using the same port and installed weights. The separate one-shot scheduler plist is prepared and valid but not installed because the server already includes scheduling. All three plists passed plutil -lint. No sleep or macOS security settings were changed. Agents operate after user login while the machine is awake; they do not wake the machine.

## Final tests, limitations and operation

Final `npm run typecheck`, `node --check web/app.js`, `git diff --check`, and `npm test` passed. Test count: **27/27**. API/adapter tests were run on the host with actual local HTTP fixture servers because the sandbox prohibits binding/accessing loopback. Passing tests are supplemented by the real model/render/playback evidence above.

Limitations: Bonsai real inference is unavailable. The two seeded ideas are consumed and need replenishment for future production. Script copy is deliberately restricted to approved project wording; automated research and Qwen idea-proposal inference are not enabled. Tax claims are blocked until tax-specific approved copy/evidence support is added. The other three projects and unverified media templates remain gated by approved branding/assets. No automatic public publishing exists. User login, awake time, installed tool paths and model availability are required; regenerate plists if Node/tool paths move. External model processes are outside factory control.

A requested external Claude diff review was rejected by automatic approval review because it would export repository code to Anthropic without explicit authorization. No diff was sent through that tool. Source review and acceptance were completed locally.

Exact commands (run from the repository):

```sh
cd ~/Projects/video-edits
open http://127.0.0.1:4317
npm run cli -- doctor
npm run cli -- production status
npm run cli -- production pause
npm run cli -- production resume
npm run cli -- backlog list
npm run cli -- jobs
npm run cli -- backlog import --file /absolute/path/ideas.json
npm run cli -- backlog approve --id IDEA_ID
npm run cli -- backlog produce --id IDEA_ID
npm run cli -- regenerate --id JOB_UUID
npm run cli -- cancel --id JOB_UUID
npm run cli -- approve --id JOB_UUID
npm run cli -- reject --id JOB_UUID
npm run typecheck
npm test
launchctl print "gui/$(id -u)/local.video-factory"
launchctl print "gui/$(id -u)/local.video-factory.ollama"
launchctl kickstart -k "gui/$(id -u)/local.video-factory"
```

IDEA_ID is a configured backlog slug; JOB_UUID is a printed job ID. Import fields match config/backlog.json without status and use a new unique ID. Imported content always waits for human approval. Add genuinely new topics/copy through reviewed project profiles first. Approve a film only after watching and reviewing it. README.md contains complete configuration, installation and stop commands, including `.env` handling.
