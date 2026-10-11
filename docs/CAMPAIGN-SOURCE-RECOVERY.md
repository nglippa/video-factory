# Campaign source recovery

Campaign `2026-10-12-primary-projects` retains its 50 slots and October 12, 2026 noon America/Chicago deadline. Its existing launchd service and Command Center queue, worker and model lifecycle remain in use.

## Review sources

Open <http://127.0.0.1:4317/#source-recovery-heading>. The Source approval section shows pending candidate packages, exact supporting excerpts, document hashes and modification times, source-level verification limits, proposed script copy, audience, voice, CTA, brand choices and asset candidates.

Review each package, check its confirmation box, choose **Approve source and copy**, and enter an approval note. Reject with a reason when unsuitable. No source is trusted merely because discovery found it. The old generic knowledge registration endpoint rejects new registrations and directs operators to explicit candidate review.

The first five packages have IDs `<project-id>-2026-10-11-v1`. The internal `angband` campaign ID refers to the user-identified `wand-or-steel` repository; its public product name is **Wand or Steel**. Legacy Angband and loose OG prototype documents are unsuitable for this campaign identity.

Source approval enables the reviewed profile and copy. It does **not** approve a generated proposal, render a video or publish anything. New packages are typography-only product notes. Screenshots, concept art, recordings and branding asset candidates are not promoted to the approved asset manifest. The operator's Terra approval note, “Gameplay shots are critical,” is retained as a production constraint: a text-only Terra proposal cannot become rendering-ready without approved gameplay footage and a matching footage-driven composition. Source review notes are passed into editorial context.

## Sources and limits

| Project | Candidate evidence | Supported scope |
|---|---|---|
| Terra / Steam Tycoon | `steam-tycoon/PRODUCT.md`, `src/main.ts` | Restoration/city eras, physical ledgers, construction updates. Steam distribution remains undecided. |
| Wand or Steel (`angband`) | Title screen component, critical-hit documentation and combat system, general skill-tree code, codex panel code, visual-identity direction | Independent main/offhand melee critical rolls, skill prerequisites, discovery-based codex panels. Spell/ranged critical hits are disabled. |
| Find My Needs | `Find-My-Needs/PRODUCT.md`, needs table and action-plan components | Organizational needs/status/evidence/work, filtering and action completion versus resolution. Demonstration requirements are not authoritative law. |
| Whodunnit | README, Changes view and reconstruction workspace code | Word-level additions/removals and manually edited revisions with deterministic checks. No detector-evasion, performance or meaning-preservation guarantees. |
| GigWise | Product blueprint, manual expense form and category grouping code | Expense entry/business purpose and category organization. The blueprint is intent; MVP lists do not prove shipped features. No tax eligibility/rates/savings claims. |

Source code inspection is not a live product or release test. Healthcare examples are synthetic organizational workflows; no patient data is used. Audience, voice, CTA and script wording are explicitly proposed editorial/brand choices requiring review.

The three initially blocked projects each have **three** reviewed compositions in their pending package. Approval makes only corresponding blocked slots eligible; remaining slots honestly retain `NEEDS_SOURCE` until additional distinct compositions are reviewed. Scheduling keeps its ordinal passes across projects. Whodunnit/GigWise source additions preserve their existing approved content and completed proposals; exhausted revision budgets and failures are not automatically reset.

## Persistence and approval contract

Pending packages: `data/source-recovery/candidates/<id>.json`.
Approved immutable copies: `data/source-recovery/approved/<id>.json`.
Approval overlay: `config/source-approvals.json`.
Rejection audit: `data/source-recovery/decisions/<id>.json`.

Approval requires the exact candidate hash, an explicit confirmation and a human review note. Before committing, the service rechecks safe allowlisted origin documents, source hashes, exact excerpts and the original base-profile hash. It flushes the immutable source, then atomically writes and flushes one overlay containing profile, deterministic selectors, candidate hash and human decision evidence. A separate audit write cannot leave approval without its human note. On subsequent use, the service re-derives the profile/selectors and verifies current origin hashes. Changed origins fail closed.

Approval writes are serialized with `approval.lock`. A surviving lock indicates an interrupted operation and requires inspection and safe manual recovery; it is never silently discarded. Check the recorded decision and service activity before removing a stale lock. Partial immutable copies remain auditable and cannot be reused with different bytes.

Additional candidate IDs can be approved as additive amendments. They must preserve every existing approved content item, CTA and established brand fields. Old approved source copies and provenance stay registered. Completed proposal snapshots remain frozen. Additions are accepted only while **every** originally reviewed claim is still present byte-identically; edited or removed evidence blocks approval/production.

The local mutation API is:

```text
POST /api/source-candidates/<id>/approve
{"sha256":"<reviewed candidate hash>","confirmClaimsAndCopy":true,"reason":"<human review note>"}

POST /api/source-candidates/<id>/reject
{"sha256":"<reviewed candidate hash>","confirmClaimsAndCopy":true,"reason":"<rejection reason>"}
```

Use the dashboard for ordinary review. Do not run approval requests before a person approves the exact package. Host, Origin and JSON mutation guards apply. Approved sources are local artifacts and never sent to cloud inference.

## Operate and measure

```sh
npm run cli -- campaign status
npm run cli -- campaign refresh-sources
npm run cli -- campaign export
python3 scripts/report-campaign-throughput.py
npm run typecheck
npm test
```

The report command reads the durable campaign database without mutating it and writes a new directory under `data/campaigns/2026-10-12-primary-projects/source-recovery/`. The existing dashboard provides downloads for the latest human summary and throughput/provenance JSON. Historical reports are preserved.

`python3 scripts/prepare-source-recovery.py` prepares the fixed initial review packages when absent; it never overwrites an existing package, approves a source or submits inference. Further evidence/amendments require a new package ID and a complete explicit review; they are not inferred from roadmaps or unrelated source files.

If an approval commits but its targeted campaign refresh fails, the API reports `refreshError`. Resolve that blocker and run `campaign refresh-sources`; completed proposal records and active intents are preserved.

## Resolve the Terra gameplay blocker

Supply real project gameplay recordings with rights/provenance, register their reviewed hashes under the project's permitted asset directory in `config/assets.json` with kind `gameplay`, and approve an additive source package containing those asset IDs as evidence plus clip-specific copy and the `gameplay` template. The initial typography composition says “No gameplay footage” and cannot be used as the footage composition. These are explicit human approvals; discovery never promotes assets. Availability additionally checks unchanged bytes and a playable video stream with bounded local ffprobe. Screenshots cannot satisfy the gameplay constraint.

Then use **Revise with approved gameplay** on the asset-blocked proposal in the existing dashboard. Enter the reviewed composition ID, two approved clip IDs and a revision note. It preserves the old proposal versions and prior snapshot hash, binds the exact reviewed copy/clip IDs for the next Qwen revision and Bonsai final review, and keeps the original two-revision limit. Missing evidence, unavailable clips or exhausted revision budgets remain blocked. Nothing becomes production-approved through this action.

Equivalent local request after these approvals:

```text
POST /api/campaigns/2026-10-12-primary-projects/proposals/<proposal-id>/revise
{"reason":"<human revision instructions>","contentBaseId":"<reviewed composition id>","gameplayAssetIds":["<approved clip id>","<approved clip id>"]}
```
