# Command Center campaign verification

Observed: 2026-10-11T12:30:09.145674+00:00

IMPLEMENTED: versioned local JSON queue bridge, persisted four-stage editorial artifacts, deterministic evidence/asset validation, bounded retries, fail-closed model cleanup, shared rendering lease, existing dashboard review and explicit approval into the existing backlog.

TESTED: Video Factory 49/49; Command Center 91/91; isolated clean Command Center baseline plus bridge 59/59; TypeScript and Python syntax checks pass. Browser: five project groups, complete pending pilot package, script/storyboard/evidence/critique/asset/audit sections, downloads HTTP 200, desktop 1440 and mobile 390 without horizontal overflow. Brief connection errors were observed only while intentionally restarting the factory.

SCHEDULED: durable campaign 2026-10-12-primary-projects is RUNNING; deadline 2026-10-12T17:00:00.000Z (October 12 noon America/Chicago). Both launchd services run. This is an immediate existing-pipeline campaign, not a promise that the Mac remains awake.

COMPLETED: 1 validated package(s) awaiting human review at this snapshot. The full 50-proposal campaign is not complete. No campaign proposal has been approved, rendered or published.

## Real local pilot

Proposal 2026-10-12-primary-projects-gigwise-04; status AWAITING_APPROVAL. All four stages returned the exact registered Qwen/Bonsai identities; results were consumed only after STOPPED and verified unload. Deterministic validation has no errors or missing assets. CTA destination remains unregistered. Qwen marked some changes accepted without changing the named fields; the explicit change audit labels these NOT_APPLIED. Models agreeing is not evidence of factual correctness.

- qwen / 2026-10-12-primary-projects-gigwise-04-r0-stage0-attempt0 / verified unload 2026-10-11T11:59:46.396851+00:00
- bonsai / 2026-10-12-primary-projects-gigwise-04-r0-stage1-attempt0 / verified unload 2026-10-11T12:00:40.503514+00:00
- qwen / 2026-10-12-primary-projects-gigwise-04-r0-stage2-attempt0 / verified unload 2026-10-11T12:02:00.353722+00:00
- bonsai / 2026-10-12-primary-projects-gigwise-04-r0-stage3-attempt0 / verified unload 2026-10-11T12:02:53.534310+00:00

The preceding three bounded pilot attempts remain auditable: one failed truncated Bonsai output, one requires unavailable artwork, and one failed deterministic evidence/scene-order checks. Constrained decoding now fixes approved ordered native scenes and their exact source references. A subsequent Whodunnit startup HTTP 500 was safely unloaded; failed-job receipts now advance to the existing bounded retry instead of wedging the consumer.

## Counts at snapshot

| Project | Generated drafts | Completed validated | Blocked | Failed | Pending |
|---|---:|---:|---:|---:|---:|
| whodunnit | 0 | 0 | 0 | 0 | 10 |
| gigwise | 4 | 1 | 2 | 1 | 6 |
| terra-steam-tycoon | 0 | 0 | 10 | 0 | 0 |
| angband | 0 | 0 | 10 | 0 | 0 |
| find-my-needs | 0 | 0 | 10 | 0 | 0 |

BLOCKED: Terra, Angband and Find My Needs each have ten NEEDS_SOURCE slots. Their registry profiles are disabled and lack approved evidence, assets and production composition. Angband identity is ambiguous among local repositories. Whodunnit/GigWise evidence is narrow; duplicate concepts are blocked rather than counted toward ten. Tax-specific claims, detector evasion, clinical outcomes and real patient data are not used.

## Preservation and restart

All original rows match their starting hashes: seven video jobs, six ideas, two idea runs and thirteen Command Center research tasks (excluding the additive null contract_json column). Real factory restart preserved the same active pilot job ID and prior versions; exactly one queue row existed for that job. Original queues/results were not deleted. The shared live render lease was acquired and released while both models were verified unloaded, without rendering a proposal.

## Files changed

Video Factory: src/assets.ts, src/backlog.ts, src/cli.ts, src/models.ts, src/pipeline.ts, src/server.ts, src/store.ts, src/campaign-domain.ts, src/campaigns.ts, src/command-center.ts, src/legacy-models.ts, web/app.js, web/index.html, web/style.css, tests/campaigns.test.ts and these two campaign documentation files.

Command Center integration: tools/research/bridge.py, tools/research/queue_store.py, tools/research/lifecycle.py, tools/research/models.py (shared restricted request options), tools/research/test_bridge.py, tools/research/supervise.py, tools/research/local.command-center.research-worker.plist and VIDEO-FACTORY-BRIDGE.md. Other concurrent collaboration changes are preserved separately. Installed worker plist: ~/Library/LaunchAgents/local.command-center.research-worker.plist.

Starting revisions: factory f2f85ddefe0f40639627504d8ef22eeb39b4b515; Command Center 54fa4151af1151d4555fc1e02cf2a3ec7d71f705. Command Center baseline 4ae2e90d5586f836471be4e03b3e570f9f559c9b was committed by the concurrent thread. Final commit IDs are recorded after committing in the campaign Git verification artifact and final report.

## Delivery and operation

Dashboard: http://127.0.0.1:4317/ (Primary projects campaign). Latest immutable export at this snapshot:

/Users/nicholaslippa/Projects/video-edits/data/campaigns/2026-10-12-primary-projects/exports/2026-10-11T12-30-09-115Z-30e9d32c

Machine verification: data/campaigns/2026-10-12-primary-projects/integration-verification-2026-10-11T12-30-09.058633+00-00.json

See COMMAND-CENTER-CAMPAIGN.md for exact CLI commands, all export files, deadline/sleep behavior and approval workflow. From this repository:

```sh
npm run cli -- campaign status
npm run cli -- campaign pause
npm run cli -- campaign resume
npm run cli -- campaign refresh-sources
npm run cli -- campaign export
npm run typecheck
DATA_DIR=/private/tmp/video-factory-campaign-tests npm test
```

From Command Center:

```sh
python3 tools/research/cli.py status
python3 -m unittest discover -s tools/research -p 'test_*.py' -q
launchctl print gui/$(id -u)/local.command-center.research-worker
```

No cleanup blocker is active at the snapshot. A future failed unload stops conflicting work and requires verified safe recovery.
