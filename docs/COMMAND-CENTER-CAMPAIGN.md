# Local Command Center campaign integration

The factory owns project evidence, creative briefs, deterministic validation, ranking,
explicit human approval and the production backlog. Command Center owns every real
model execution through its existing durable queue, worker, immutable model registry
snapshots and exclusive heavy-model lease. Communication is a versioned JSON
subprocess interface into Command Center's public `tools/research/bridge.py`; the
TypeScript runtime does not import Python internals or manage model processes.

Campaign: `2026-10-12-primary-projects`. Deadline: October 12, 2026, 12:00 PM
America/Chicago (`2026-10-12T17:00:00Z`). Target: 50 slots, 10 per project.
Slots without approved evidence are `NEEDS_SOURCE`, not completed proposals.
Current source coverage supports only the existing Whodunnit synthetic rewrite
and GigWise recordkeeping material. Terra, Angband and Find My Needs profiles are
disabled and have no approved project-specific evidence/footage in the registry.
Their documents, identity, assets and composition requirements need source review.
CTA URLs are not registered; the approved in-video CTA text implies no external link.

## Operation

From `~/Projects/video-edits`:

```sh
npm start                                  # existing dashboard and pipeline
npm run cli -- campaign init               # idempotent; pilot-only initially
npm run cli -- campaign status
npm run cli -- campaign start              # requires a real validated pilot
npm run cli -- campaign pause
npm run cli -- campaign resume             # resumes pilot if not yet verified
npm run cli -- campaign refresh-sources
npm run cli -- campaign export
npm run cli -- production status
npm run typecheck
DATA_DIR=/private/tmp/video-factory-campaign-tests npm test
```

Review at `http://127.0.0.1:4317/`, in Primary projects campaign. Expand a project
and proposal to inspect the complete script, storyboard, exact evidence, model
versions, critique decisions, assets and lifecycle receipts. Explicit approval
atomically freezes the package in the existing backlog. The production pipeline
uses that approved script; it does not regenerate a different package. Finished
videos retain the existing separate review. No social publishing is implemented.

Exports are available in the dashboard and under:

```
data/campaigns/2026-10-12-primary-projects/
  starting-state.json
  preservation-verification.json
  versions/<job-id>.json
  exports/<timestamp-and-unique-id>/
    SUMMARY.md
    proposals.json
    blockers.json
    whodunnit.md
    gigwise.md
    terra-steam-tycoon.md
    angband.md
    find-my-needs.md
```

Every export and completed model receipt is an immutable new artifact. SQLite is
the durable current projection. A model-job intent is persisted before submission;
a restart reuses the same job ID and exact contract. Raw failed outputs remain
available. Original research tasks, video jobs and idea records are preserved.

## Bounds and resource safety

Each proposal uses Qwen draft, Bonsai specific critique, Qwen revision and Bonsai
final review. At most two successful revision rounds are allowed; each stage has
one retry. Pilot slots are bounded to four attempts, with every earlier attempt
preserved. Native Qwen decoding fixes renderer-compatible ordered scenes and evidence references, and constrains project/slot identity, approved script
copy, captions and claim IDs. Deterministic validation independently checks exact
copy and scene references, protected pairs/disclaimers, timing, available asset
bytes, renderer-compatible scripts and lexical concept similarity. Scores are
explicitly model editorial judgments, not factual proof. A field-by-field change audit identifies accepted suggestions that did not actually change the proposal; these remain visible for human review. Historical ideas, backlog
and rendered-video topics participate in concept comparisons. No embedding model
or semantic proof is claimed.

The existing factory pipeline drives the campaign; no second model scheduler is
created. Queued video production takes priority between editorial jobs. An already
submitted editorial job can finish and be persisted before production claims.
The campaign runs immediately against its own deadline rather than the nightly
video-rendering window. Production pause, free disk and memory-pressure limits
still gate new submissions. All rendering additionally holds Command Center's
same exclusive lease and requires live verification that both models are free.
Loss of that lease aborts rendering. No pending proposal is rendered.

Results are returned only after the associated Command Center session is STOPPED
with a verified unload and no task cleanup error. Cleanup failures stop conflicting
jobs and stay visible in the dashboard. A later unrelated resource blocker does
not hide an earlier safely completed result. Structured Bonsai requests disable
hidden reasoning and request concise JSON; raw receipts retain runtime identity.

Model jobs are bounded to 180 seconds of inference, with the registry's existing
startup/readiness/cleanup bounds. No inference begins outside Command Center.
The direct adapters are retained only for test fixtures, guarded against use in
production. No model download, cloud inference, secret ingestion, patient data,
publishing or automatic content approval is part of this integration.

## Supervision and deadline

Existing `local.video-factory` launchd supervision keeps the dashboard and pipeline
running. `local.command-center.research-worker` supervises the existing Python
worker. It restarts unexpected errors but maps an unverified-cleanup exit to a
successful stop, leaving recovery to an operator. Its PATH includes `/usr/sbin`
for macOS `lsof`. Use the Command Center bridge guide for safe reconciliation.

Progress is exported after each stage and periodically while active. Near the
deadline, optional expensive revisions are deferred; pending model tasks are
cancelled on expiration where possible. Already running bounded inference is
preserved and its actual completion time remains recorded. Gaps over five minutes
are recorded as unobserved execution windows, without claiming sleep as a proven
cause. After wake/restart, unfinished work resumes or is marked deadline-missed.
There is no promise that the Mac remains awake and no fabricated on-time delivery.

The live dashboard and export distinguish drafts, completed validated packages,
missing assets, missing sources, failures and pending work. Target slots and model
agreement never count as 50 validated proposals. The actual pilot and scheduling
results belong in the accompanying verification record.
