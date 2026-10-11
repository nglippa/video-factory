# Local Video Factory

A local TypeScript queue that turns approved project briefs into 1080 × 1920, 30 fps H.264/AAC MP4s. Qwen generates a strict script on Ollama; Remotion renders the film; FFmpeg produces an original sound bed; FFprobe and full decoding validate the export. Successful jobs wait at **READY_FOR_REVIEW**. Approval is recorded locally; publishing is not implemented.

Phase 2 adds a persistent content backlog, automatic daily selection of approved ideas, pause/resume, production windows, resource gates, automatic bounded retries, and script/model review in the dashboard. See [Phase 2 verification](docs/PHASE2-VERIFICATION.md). Public publishing is unavailable.

The active local LaunchAgents run the factory (with its integrated scheduler) and Ollama. Open **http://127.0.0.1:4317**. The factory runs after login without an open terminal, while the Mac is awake. Sleep settings are unchanged.

## Startup

~~~sh
cd ~/Projects/video-edits
npm start
~~~

Open **http://127.0.0.1:4317**. Select a project, enter a topic, choose approved content and a composition, then press **Generate film**. Review the finished video and QA before choosing **Approve for use** or **Reject**. Download approved films for manual use.

The topic guides selection and pacing within approved content; it does not authorize new claims. Browser activity is backed by persistent queue events. Closing the browser does not stop production.

## Installation

Inspection found M4 Pro / 24 GB, macOS 27.0, Node 26.9.0, npm 11.19.1, FFmpeg/FFprobe 9.0.2, Ollama 0.34.4 and Chrome 154.0.8037.99. Existing system tools and Qwen were reused. No Remotion project was found among the inspected project manifests. Only this repository's missing npm packages were installed.

Requirements: Node ≥22.5 (26 tested), npm, FFmpeg/FFprobe on PATH, Ollama and Chrome. SQLite is built into Node. No Python runtime, cloud service or API account is required.

~~~sh
cd ~/Projects/video-edits
# Fresh checkout only:
test -d node_modules || npm ci
npm run cli -- doctor
npm run typecheck
npm test
~~~

If doctor reports missing system tools, install only those tools. For example, run **brew install ffmpeg** only if FFmpeg is missing. On another machine, run **ollama serve** only if Ollama is unavailable; **ollama list** shows installed models.

When QWEN_MODEL is unset, the factory selects the smallest installed text Qwen with a reported positive size ≤16 GB. Coder, vision and embedding variants are excluded. On this Mac, that selects **qwen3:14b-q8_0**, 15,895,155,363 bytes. An explicit QWEN_MODEL must be installed and pass the same gate. No model downloads or fixture fallback are implemented. Incomplete responses, model identity mismatches, invalid JSON and unapproved wording fail the job; raw responses and errors are retained.

Remotion is pinned to 4.0.534. Its [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) permits free commercial video creation for individuals and qualifying small organizations; organizations outside those terms need a license. No paid cloud service is required. Existing Whodunnit fonts are local, with SIL Open Font License notices in public/fonts/.

## CLI

~~~sh
cd ~/Projects/video-edits

npm run cli -- generate \
  --project whodunnit \
  --topic "Clearer writing, same meaning" \
  --content clear-writing \
  --template before-after

npm run cli -- generate \
  --project gigwise \
  --topic "Organize your business records" \
  --content recordkeeping \
  --template explainer

npm run cli -- jobs

npm run cli -- enqueue \
  --project whodunnit \
  --topic "Clearer writing, same meaning" \
  --content clear-writing \
  --template before-after \
  --key "whodunnit-manual-001"

npm run cli -- cancel --id JOB_UUID
npm run cli -- retry --id JOB_UUID
npm run cli -- approve --id JOB_UUID
npm run cli -- reject --id JOB_UUID
~~~

Replace JOB_UUID with the printed ID. Approve only after watching the film. Failed or invalid exports cannot be approved.

The CLI uses the live server when available. If unavailable, generate runs a local worker against the same database. A polling interruption never creates a new job. Enqueue only persists a job; a running worker must produce it. Both worker paths share the exclusive lease.

## Bonsai

Discovery probes local /v1/models on ports 8000, 8080, 1234 and 8001. No Bonsai endpoint was available during inspection. Its absence is explicitly recorded; validated Qwen output proceeds.

~~~sh
BONSAI_BASE_URL=http://127.0.0.1:8000 \
BONSAI_MODEL=your-local-model-id \
BONSAI_MEMORY_SAFE=true \
npm start
~~~

Use the exact model ID reported by `/v1/models`. The adapter sends a POST to `/v1/chat/completions` with model, temperature 0, system/user messages, and `response_format: {type: "json_object"}`. Set BONSAI_JSON_MODE=false only for compatible servers without JSON mode. Auto-discovery selects a Bonsai-named model; an unrelated model is not substituted. No Ollama assumption is made for Bonsai. BONSAI_MEMORY_SAFE=true is an operator assertion that Bonsai and the renderer fit in memory. OpenAI-compatible servers have no standard unload protocol; the factory cannot guarantee unloading Bonsai. Leave this disabled unless that service's memory lifecycle is managed. Qwen is unloaded and /api/ps checked before refinement or rendering.

Bonsai selects clearer approved hook/lesson alternatives, respects brand voice and adjusts pacing. Exact before/after copy, identity, scene kinds, assets and CTA stay protected. Unsupported editorial text is rejected, with the warning and response retained. A failed refinement retains the valid Qwen script.

Only HTTP loopback endpoints are permitted. Redirects, credentials in URLs and cloud URLs are rejected.

~~~sh
cp .env.example .env
# Edit local configuration, then:
node --env-file=.env --import tsx src/server.ts
~~~

Normal npm start uses process environment variables and does not implicitly load .env.

## Unattended operation and launchd

The server runs the scheduler every 60 seconds and the queue worker. `config/schedules.json` enables daily backlog slots at 09:00 for Whodunnit and 09:10 for GigWise, America/Chicago. `config/production.json` permits new work from **08:00 until 22:00**. A late invocation catches up today's due slots; earlier days are not backfilled. Overnight windows are supported (start later than end). Jobs in progress may finish after the window closes.

Each slot atomically binds one approved, unused content idea to a unique schedule ID + local date job key. Reruns and restarts return the same job. A used idea is never consumed again automatically. An empty/blocked backlog is reported for the relevant slot; other valid slots continue. Import and approve additional ideas to keep production supplied.

Pause is persistent and stops new claims and scheduled enqueues. It permits active work to finish. Cancel an individual job to abort production. Retry backoff is 30 seconds and then 60 seconds, with at most three total attempts. Failures and cancellation retain diagnostics. After the cap, correct the cause and use regeneration to create a new draft; approval never transfers.

~~~sh
cd ~/Projects/video-edits
npm run cli -- production status
npm run cli -- production pause
npm run cli -- production resume
npm run cli -- backlog list
npm run cli -- regenerate --id JOB_UUID
~~~

The active factory LaunchAgent includes the integrated scheduler, so the separate one-shot scheduler plist is optional and is **not installed**. Ollama is managed by its own LaunchAgent using the existing model files on port 11434, with one parallel inference and one loaded model. Bonsai is a separate optional service.

Prepare or refresh plists (absolute Node/repository paths; regenerate after a Node installation moves):

~~~sh
node --env-file-if-exists=.env --import tsx scripts/launchd.ts
plutil -lint config/local.video-factory.plist config/local.video-factory.scheduler.plist config/local.video-factory.ollama.plist
~~~

On a fresh machine, ensure a manually launched factory or Ollama is stopped before loading agents that use the same ports. Install:

~~~sh
mkdir -p ~/Library/LaunchAgents
cp config/local.video-factory.plist ~/Library/LaunchAgents/
cp config/local.video-factory.ollama.plist ~/Library/LaunchAgents/
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.ollama.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.plist
~~~

For the already installed service, restart and inspect:

~~~sh
launchctl kickstart -k "gui/$(id -u)/local.video-factory"
launchctl print "gui/$(id -u)/local.video-factory"
launchctl print "gui/$(id -u)/local.video-factory.ollama"
~~~

To stop and unload (pause/drain first if preserving an active attempt):

~~~sh
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.plist
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.ollama.plist
~~~

Logs live in `data/logs/`. Plists set a Homebrew PATH and private umask. The generator only writes repository plists, and never changes sleep/security settings or installs agents itself. If optional `.env` exists, the factory LaunchAgent reads it; it must contain only operator configuration. The Ollama plist gets its loopback address from OLLAMA_BASE_URL when generated, with OLLAMA_BIN configurable for other installations.

The optional one-shot command uses the same pause/window gate:

~~~sh
npm run cli -- schedule --file config/schedules.json
~~~

## Structured content backlog

`config/backlog.json` seeds two approved ideas from the already approved project content, idempotently. SQLite is authoritative after import. Each idea includes project, topic, audience, message, hook, required approved asset IDs, source references and verification labels, template, content ID, content/publishing approval requirements, status, tax year/claim flags, and synthetic-demo/provenance fields.

Import a JSON object or array using the same fields as the seed entries **without `status`** and with new unique IDs. Imports always become DRAFT, including Qwen proposals supplied by an operator; no external research is enabled. They must be inspected and approved before scheduling. Proposals cannot introduce copy outside the project profile's approved topic, hook and message. This release does not automate research or idea-proposal inference; Qwen generates the video script after an approved idea is selected.

~~~sh
npm run cli -- backlog import --file /absolute/path/ideas.json
npm run cli -- backlog approve --id IDEA_ID
npm run cli -- backlog reject --id IDEA_ID
npm run cli -- backlog produce --id IDEA_ID
~~~

Approve content in the dashboard or CLI only after checking its sources. Ideas bound to a job cannot be edited. Their status follows technical completion and human video review. Whodunnit examples must be labeled synthetic and use the exact approved pair. GigWise ideas with tax claims require a tax year and operator-verified authoritative IRS references, and remain blocked until explicitly approved tax-specific project copy is supported. Existing GigWise content makes only recordkeeping/product claims. No scraping, fabricated research, guaranteed detector evasion, or automatic public publishing is implemented.

## Projects and approved assets

Profiles in config/projects/ have colors, typography, logo, voice, templates, restrictions, CTA, asset directories, fixed output settings, approved content and brand references.

- Whodunnit uses existing paper/ink/oxblood tokens, fingerprint mark, Newsreader, Instrument Sans and IBM Plex Mono. The original synthetic pair was explicitly approved by the user and labeled “Example rewrite.”
- GigWise uses its existing dark green/mint palette and product logo. Copy is based on documented mileage, receipt and expense tracking. No tax rates, eligibility rules or savings claims are included.
- Terra / Steam Tycoon, Angband and Find My Needs are registered and visible, with generation disabled pending verified branding and approved content/assets. Their placeholder colors are not asserted as branding. Healthcare demonstrations must be synthetic.

Add a project:

1. Copy a profile; set its unique lowercase ID, verified brand values and brandSources.
2. Add approved entries with id, topic, title, hook, body, cta and source. Comparisons need an exact before/after pair; use a relevant disclaimer. Educational entries should add lessons with two distinct approved strings, in scene order.
3. Provide headlines under 80 characters and body copy under 240. CTA must equal the project CTA. Add approved wording alternatives when editorial changes are wanted.
4. Put owned/licensed assets in approved assetDirectories. Logos must be local. Initial templates load the bundled fonts; add font loading/provenance if using different font families.
5. Choose approved templates and set enabled=true.
6. Restart for code changes. Profiles are loaded per job and preserved in snapshots.

Compositions: **BeforeAfter, Explainer, FeatureDemo, Gameplay, Announcement**. BeforeAfter and Explainer are the verified MVP flows. FeatureDemo requires approved screenshots in both middle scenes. Gameplay requires actual approved video in both middle scenes, long enough for each scene. These media templates are implemented but have not been visually certified with gameplay in this checkout.

Example config/assets.json entry:

~~~json
[
  {
    "id": "real-gameplay-01",
    "projectId": "angband",
    "path": "public/assets/angband/gameplay-01.mp4",
    "kind": "gameplay",
    "approved": true,
    "source": "Developer capture; record build and capture date",
    "license": "Owned footage approved for promotional reuse",
    "sha256": "REPLACE_WITH_64_CHARACTER_SHA256"
  }
]
~~~

Compute checksums with **shasum -a 256 PATH**. Kind is gameplay or screenshot. Entries must match the project, approved directory and pinned checksum. The model receives only approved asset identifiers. Never add patient records, unlicensed media or scraped media.

## Persistence, resource policy and boundaries

~~~text
config/projects/       Brand profiles and approved copy
config/assets.json     Explicit visual approvals
config/schedules.json  Daily slots selecting approved backlog ideas
config/production.json Window and resource settings
config/backlog.json    Initial approved content ideas
src/models.ts          Local adapters and content gates
src/store.ts           SQLite queue, exclusive claims and events
src/pipeline.ts        Sequential production and isolated attempts
src/render.ts          Remotion, audio, assets and QA
src/video/index.tsx    Five deterministic compositions
web/                   Dashboard
data/factory.sqlite    Persistent WAL database
data/artifacts/<job>/  Export and production metadata
~~~

Each attempt has an isolated directory. Failures retain failure.json and raw attempts. Success promotes video.mp4, poster.jpg, script.json, profile.json, request.json, model-attempts.json, model-metadata.json, metadata.json and qa.json. Metadata includes model request/response/digest/seed, render settings, code and asset hashes, audio provenance and output checksum.

QA checks dimensions, H.264, yuv420p, 30 fps, duration, exact frame count, stereo AAC, file size and complete decoding. Technical QA never replaces human visual/editorial review.

Immediate SQLite transactions protect state/events and claims. A global active-job guard prevents different jobs running simultaneously across factory processes. Heartbeats renew a 30-second lease; stale jobs requeue with explicit events and a three-attempt limit. Stale owners cannot alter state or promote files. Cancellation aborts model requests/renders/FFmpeg and keeps diagnostics. Ordinary failures automatically retry within the three-attempt cap; exhausted jobs require corrected inputs and a new regeneration. Crash leftovers do not become review-ready without successful finalization.

Memory policy: Qwen context 4096, seed 42, temperature 0, sequential models, unload before render, concurrency 1–2, at least 2 GB free disk. Other loaded Ollama models are not evicted; production fails with a resource-busy message. Other applications/model processes are outside factory control.

The server binds 127.0.0.1 only. Local Host/Origin checks, JSON/body limits and fixed artifact names protect the local workflow. It is a single-user application, not an authenticated multi-user service. Models cannot execute commands or select executables. There is no scraping, publishing, downloaded stock media, cloud fallback or analytics.

## Verification

~~~sh
npm run typecheck
npm test
npm run cli -- doctor
~~~

See docs/VERIFICATION.md for actual job IDs, output inspection, QA and browser evidence. Watch each whole film and review its wording before approval. New product claims require approved content updates.
# video-factory
