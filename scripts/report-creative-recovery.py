#!/usr/bin/env python3
"""Produce a read-only, versioned campaign recovery report.

This intentionally records metadata and hashes only; proposal/model payloads never leave SQLite.
"""
from __future__ import annotations

import argparse, datetime as dt, hashlib, json, re, shutil, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN = "2026-10-12-primary-projects"
DEFAULT_BASELINE = Path("/tmp/creative-recovery-baseline.json")
DEADLINE = dt.datetime(2026, 10, 12, 17, tzinfo=dt.timezone.utc)

def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()

def iso(value: str | None) -> dt.datetime | None:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None

def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

def completed(slot: dict) -> bool:
    validation = slot.get("validation") or {}
    versions = slot.get("versions") or []
    if slot.get("status") not in {"AWAITING_APPROVAL", "APPROVED"} or not validation.get("passed"): return False
    if slot.get("creativeRecovery"): versions = [v for v in versions if v.get("creativeAttemptId") == slot["creativeRecovery"]["attemptId"]]
    final = [v for v in versions if v.get("stage") == 3]
    last = final[-1] if final else {}
    result = last.get("result") or {}
    return result.get("state") == "completed" and result.get("readyForConsumer") is True and (result.get("lifecycle") or {}).get("state") == "STOPPED" and (result.get("lifecycle") or {}).get("verifiedUnloadAt") and (last.get("value") or {}).get("verdict") == "PASS" and not (last.get("value") or {}).get("unsupportedClaims")

def lifecycle(versions: list[dict]) -> dict:
    out = {}
    for model in ("qwen", "bonsai"):
        rows = [v.get("result", {}).get("lifecycle", {}) for v in versions if (v.get("result", {}).get("contract", {}).get("model") == model)]
        out[model] = {k: {"samples": len(vals), "meanMs": sum(vals) / len(vals) if vals else None}
                      for k in ("loadMs", "inferMs", "unloadMs")
                      for vals in [[r[k] for r in rows if isinstance(r.get(k), (int, float))]]}
    return out

def queue_metadata(path: Path) -> dict:
    if not path.exists(): return {"available": False}
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        rows = con.execute("SELECT id,state,model_family,scheduled_at,started_at,completed_at FROM tasks WHERE id LIKE ?", (CAMPAIGN + "%",)).fetchall()
    finally: con.close()
    def seconds(a, b):
        x, y = iso(a), iso(b)
        return (y - x).total_seconds() if x and y else None
    completed_rows = [r for r in rows if r[1] == "completed"]
    by_model = {}
    for model in ("qwen", "bonsai"):
        group = [r for r in completed_rows if r[2] == model]
        runs = [seconds(r[4], r[5]) for r in group if seconds(r[4], r[5]) is not None]
        waits = [seconds(r[3], r[4]) for r in group if seconds(r[3], r[4]) is not None]
        by_model[model] = {"samples": len(group), "meanRunSeconds": sum(runs)/len(runs) if runs else None, "meanQueueWaitSeconds": sum(waits)/len(waits) if waits else None}
    active = [r for r in rows if r[1] in {"pending", "running"}]
    return {"available": True, "taskCounts": {state: sum(r[1] == state for r in rows) for state in sorted({r[1] for r in rows})}, "completedByModel": by_model, "actualRetryTasks": sum(bool(re.search(r"-attempt([1-9][0-9]*)$", r[0])) for r in rows), "activeOrPending": [{"id": r[0], "state": r[1], "scheduledAt": r[3], "startedAt": r[4], "queueAgeSeconds": max(0,(dt.datetime.now(dt.timezone.utc)-iso(r[3])).total_seconds()) if r[3] else None} for r in active]}

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    ap.add_argument("--overview", type=Path)
    args = ap.parse_args()
    baseline = json.loads(args.baseline.read_text())
    db = ROOT / "data" / "factory.sqlite"
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        rows = [json.loads(r[0]) for r in con.execute("SELECT data FROM campaign_slots WHERE campaign_id=? ORDER BY project_id,ordinal", (CAMPAIGN,))]
    finally: con.close()
    captured = dt.datetime.now(dt.timezone.utc)
    versions = [v for r in rows for v in (r.get("versions") or [])]
    done = [r for r in rows if completed(r)]
    statuses = {}
    blockers = {}
    per_project = {}
    for r in rows:
        statuses[r.get("status", "UNKNOWN")] = statuses.get(r.get("status", "UNKNOWN"), 0) + 1
        blockers[r["id"]] = {"projectId": r.get("projectId"), "ordinal": r.get("ordinal"), "status": r.get("status"), "validationErrors": (r.get("validation") or {}).get("errors", []), "missingAssets": (r.get("validation") or {}).get("missingAssets", []), "attempts": len(r.get("versions") or [])}
        per_project.setdefault(r.get("projectId"), {"slots": 0, "completed": 0, "statuses": {}})
        p = per_project[r["projectId"]]; p["slots"] += 1; p["completed"] += int(completed(r)); p["statuses"][r.get("status", "UNKNOWN")] = p["statuses"].get(r.get("status", "UNKNOWN"), 0) + 1
    preserved = []
    baseline_by_id = {x["id"]: x["sha256"] for x in baseline.get("completed", []) if "id" in x and "sha256" in x}
    current_by_id = {r["id"]: sha(canonical(r).encode()) for r in rows if r["id"] in baseline_by_id}
    for ident, expected in baseline_by_id.items(): preserved.append({"id": ident, "expectedSha256": expected, "currentSha256": current_by_id.get(ident), "unchanged": current_by_id.get(ident) == expected})
    approved_now = baseline.get("approvedRegistryHashes", {})
    registry_file = ROOT / "config" / "source-approvals.json"
    registry_hash = sha(registry_file.read_bytes()) if registry_file.exists() else None
    distinctness = None
    overview_status = "not provided"
    overview_slots = {}
    if args.overview and args.overview.exists():
        overview = json.loads(args.overview.read_text()); overview_status = "loaded" if overview.get("id") == CAMPAIGN else "ignored_id_mismatch"
        if overview.get("id") == CAMPAIGN:
            distinctness = {s["id"]:s.get("currentDistinctness") for s in overview.get("slots", [])}
            overview_slots = {s.get("id"): s for s in overview.get("slots", []) if s.get("id")}
            for ident, slot in blockers.items():
                if ident in overview_slots: slot["overviewSourceUpdatedAt"]=overview_slots[ident].get("updatedAt"); slot["overview"] = {k: overview_slots[ident].get(k) for k in ("currentDistinctness", "blockers", "ranking", "error", "errorReason", "factoryCompositionIssues") if k in overview_slots[ident]}
    for ident, slot in blockers.items():
        if ident in overview_slots: continue
        slot["errorReason"] = next((r.get("error") for r in rows if r.get("id") == ident), None)
    registry_compare = {}
    for rel, expected in approved_now.items():
        if rel not in {"config/knowledge.json","config/source-approvals.json","config/assets.json"}: raise ValueError("Unexpected registry path in baseline")
        file = ROOT / rel
        actual = sha(file.read_bytes()) if file.exists() else None
        registry_compare[rel] = {"baselineSha256": expected, "currentSha256": actual, "unchanged": actual == expected}
    phase_values = {}
    for r in rows:
        for phase in (r.get("timings") or []): phase_values.setdefault(phase.get("phase"), []).append(phase.get("milliseconds"))
        for v in r.get("versions", []):
            for phase, ms in (v.get("factoryTimings") or {}).items(): phase_values.setdefault(phase, []).append(ms)
    campaign_events = []
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try: campaign_events = [{**json.loads(x[0]),'recordedAt':x[1]} for x in con.execute("SELECT data,created_at FROM campaign_events WHERE campaign_id=?", (CAMPAIGN,))]
    finally: con.close()
    for e in campaign_events:
        if e.get("type")=="factory-phase-timing": phase_values.setdefault(e.get("phase"),[]).append(e.get("milliseconds"))
        for phase, ms in (e.get("factoryTimings") or {}).items(): phase_values.setdefault(phase, []).append(ms)
    factory_phases = {p: {"samples": len([x for x in xs if isinstance(x,(int,float))]), "meanMs": sum(x for x in xs if isinstance(x,(int,float)))/len([x for x in xs if isinstance(x,(int,float))]) if any(isinstance(x,(int,float)) for x in xs) else None} for p,xs in phase_values.items()}
    times = [iso(v.get("result", {}).get("createdAt")) for v in versions if iso(v.get("result", {}).get("createdAt"))] ; ends = [iso(v.get("result", {}).get("completedAt")) for v in versions if iso(v.get("result", {}).get("completedAt"))]
    elapsed = (max(ends)-min(times)).total_seconds()/3600 if times and ends else None
    rate = len(done)/elapsed if elapsed else None
    report = {"version": 1, "campaignId": CAMPAIGN, "campaignMode": overview.get("mode") if args.overview and overview_status=="loaded" else None, "capturedAt": captured.isoformat(), "deadline": DEADLINE.isoformat(), "hoursToDeadline": max(0, (DEADLINE-captured).total_seconds()/3600), "counts": {"slots": len(rows), "versions": len(versions), "validatedCompleted": len(done), "currentApprovalEligible": sum(1 for r in rows if r.get("status")=="AWAITING_APPROVAL" and (r.get("validation")or{}).get("renderingReady") and overview_slots.get(r["id"],{}).get("updatedAt")==r.get("updatedAt") and not (overview_slots[r["id"]].get("currentDistinctness")or{}).get("blockingIds") and not overview_slots[r["id"]].get("factoryCompositionIssues")), "retryVersions": sum(v.get("attempt", 0) > 0 for v in versions)}, "statuses": statuses, "perProject": per_project, "allSlotBlockers": blockers, "archivedAttempts": [{"id": v.get("result", {}).get("jobId"), "stage": v.get("stage"), "attempt": v.get("attempt"), "state": v.get("result", {}).get("state"), "path": v.get("artifact")} for r in rows for i,v in enumerate(r.get("versions", []))], "creativeRecoveries": [{"id":r["id"],"archive":r["creativeRecovery"]["artifact"],"attemptId":r["creativeRecovery"]["attemptId"],"startedAt":r["creativeRecovery"]["startedAt"]}for r in rows if r.get("creativeRecovery")], "modelLifecycleMs": lifecycle(versions), "factoryPhaseTimings": factory_phases, "preservation": preserved, "approvedRegistryHashes": {"comparison": registry_compare}, "intentRepairs": [e for e in campaign_events if e.get("type")=="unsubmitted-prompt-compacted"], "factoryAssemblies": [{"slotId": r["id"], "records": r.get("factoryAssemblies"), "currentIssues": overview_slots.get(r["id"],{}).get("factoryCompositionIssues", [])} for r in rows if r.get("factoryAssemblies")], "factoryCompositions": [{"slotId": r["id"], "records": r.get("factoryCompositions"), "currentIssues": overview_slots.get(r["id"],{}).get("factoryCompositionIssues", [])} for r in rows if r.get("factoryCompositions")], "currentDistinctness": distinctness, "overview": overview_status, "projection": {"earliestCreatedAt": min(times).isoformat() if times else None, "latestCompletedAt": max(ends).isoformat() if ends else None, "historicalElapsedHours": elapsed, "observedRatePerHour": rate, "remainingTo50": max(0, 50-len(done)), "hoursAtObservedRate": (50-len(done))/rate if rate else None, "caveats": ["Historical six completed records may duplicate audit work and are not a forecast of 50 distinct proposals.", "Evidence and asset blockers impose an unknown hard ceiling."]}, "queue": queue_metadata(ROOT.parent / "command-center" / "basic-qwen-bonsai" / ".research" / "queue.sqlite3"), "limitations": ["Old records without factory timing receipts are genuinely uninstrumented; recorded factory phases are reported above.", "Proposal and model payloads are intentionally omitted."]}
    out = ROOT / "data" / "campaigns" / CAMPAIGN / "creative-production-recovery" / captured.strftime("%Y-%m-%dT%H-%M-%S-%fZ")
    out.mkdir(parents=True, exist_ok=False)
    (out / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    shutil.copyfile(args.baseline, out / "baseline.json")
    lines = ["# Creative production recovery", "", f"Campaign: {CAMPAIGN}", f"Captured: {captured.isoformat()}", "", "## Counts", "", f"- Slots: {len(rows)}; versions: {len(versions)}; validated completed: {len(done)}", f"- Statuses: {json.dumps(statuses, sort_keys=True)}", f"- Retry versions: {report['counts']['retryVersions']}", "", "## Current per-project status", ""]
    for project, value in sorted(per_project.items()): lines.append(f"- {project}: {value['completed']}/{value['slots']} validated; {json.dumps(value['statuses'], sort_keys=True)}")
    lines += ["", "## Constraints", "", "All 50 slot blockers and archived attempt metadata are in report.json. Completed preservation hashes are compared against baseline.completed. Historical throughput and its limitations are in report.json; asset and approved creative coverage blockers prevent a claim of 50 distinct proposals.", "", "Model lifecycle, queue timestamps and newly recorded factory phases are separated in report.json. Old unrecorded factory phases cannot be reconstructed."]
    (out / "SUMMARY.md").write_text("\n".join(lines) + "\n")
    print(json.dumps({"reportDirectory": str(out), "validatedCompleted": len(done), "slots": len(rows), "versions": len(versions)}))

if __name__ == "__main__": main()
