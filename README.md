# Local Video Factory

A local TypeScript queue that turns approved project briefs into 1080 × 1920, 30 fps H.264/AAC MP4s. Qwen generates a strict script on Ollama; Remotion renders the film; FFmpeg produces an original sound bed; FFprobe and full decoding validate the export. Successful jobs wait at **READY_FOR_REVIEW**. Approval is recorded locally; publishing is not implemented.

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

Default: the already-installed **qwen3:14b-q8_0**, approximately 15.9 GB. The factory never downloads models or silently substitutes one. To use a smaller Qwen deliberately, install it yourself and set QWEN_MODEL.

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

Use the model ID reported by the endpoint. BONSAI_MEMORY_SAFE=true is an operator assertion that Bonsai and the renderer fit in memory. OpenAI-compatible servers have no standard unload protocol; the factory cannot guarantee unloading Bonsai. Leave this disabled unless that service's memory lifecycle is managed. Qwen is unloaded and /api/ps checked before refinement or rendering.

Bonsai selects clearer approved hook/lesson alternatives, respects brand voice and adjusts pacing. Exact before/after copy, identity, scene kinds, assets and CTA stay protected. Unsupported editorial text is rejected, with the warning and response retained. A failed refinement retains the valid Qwen script.

Only HTTP loopback endpoints are permitted. Redirects, credentials in URLs and cloud URLs are rejected.

~~~sh
cp .env.example .env
# Edit local configuration, then:
node --env-file=.env --import tsx src/server.ts
~~~

Normal npm start uses process environment variables and does not implicitly load .env.

## launchd scheduling

The included daily schedules in config/schedules.json are disabled. The scheduler enqueues enabled slots already due today, catching late invocations after sleep. A unique schedule ID + local date key prevents duplicates. It does not backfill earlier days.

~~~sh
cd ~/Projects/video-edits
node --import tsx scripts/launchd.ts
plutil -lint config/local.video-factory.plist
plutil -lint config/local.video-factory.scheduler.plist
~~~

Review generated paths and set enabled=true for desired schedules. The server runs the queue; the scheduler enqueues every 60 seconds. Stop manually running npm start with Ctrl-C before loading its LaunchAgent:

~~~sh
mkdir -p ~/Library/LaunchAgents
cp config/local.video-factory.plist ~/Library/LaunchAgents/
cp config/local.video-factory.scheduler.plist ~/Library/LaunchAgents/
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.scheduler.plist
launchctl kickstart "gui/$(id -u)/local.video-factory"
~~~

To stop:

~~~sh
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.scheduler.plist
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/local.video-factory.plist
~~~

Logs live in data/logs/. Plists use absolute Node/repository paths and an explicit Homebrew PATH. Add optional inference settings to the server plist if needed. The generator only prepares files; it never installs or enables a LaunchAgent.

~~~sh
npm run cli -- schedule --file config/schedules.json
~~~

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
config/schedules.json  Daily slots, initially disabled
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

Immediate SQLite transactions protect state/events and claims. A global active-job guard prevents different jobs running simultaneously across factory processes. Heartbeats renew a 30-second lease; stale jobs requeue with explicit events and a three-attempt limit. Stale owners cannot alter state or promote files. Cancellation aborts model requests/renders/FFmpeg and keeps diagnostics. Failed jobs require operator retry. Crash leftovers do not become review-ready without successful finalization.

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
