from __future__ import annotations
import hashlib
import json
from pathlib import Path
from foundry_contract import create_packet, init_foundry, record_gate

ROOT = Path(__file__).resolve().parent
COMMON = {
    "authority_boundary": [
        "No self-promotion", "No authority transfer", "No subdelegation",
        "No arbitrary command execution", "No covert capture"
    ],
    "failure_policy": [
        "Preserve failures append-only", "Do not infer missing source",
        "Stop on Prism rejection", "Keep unresolved residuals visible"
    ],
    "prism_boundary": [
        "Explicit canonical roots", "Only bounded closeout task types",
        "Reject path escape", "Reject credential-bearing payloads",
        "Reject authority expansion and covert capture"
    ],
}
SPECS = {
    "LOCAL-CLOSEOUT-MANAGER": {
        "role": "Create one bounded closeout session and submit scan/manifest work.",
        "inputs": ["authorized source root", "worker count", "optional session id"],
        "outputs": ["session manifest", "bounded task identifiers", "worker launch record"],
        "does_not": ["interpret scientific truth", "promote agents", "write outside session root"],
    },
    "LOCAL-CLOSEOUT-WORKER": {
        "role": "Execute allowlisted hash, scan, slice, or manifest work after Prism approval.",
        "inputs": ["claimed allowlisted task", "explicit read roots", "explicit write roots"],
        "outputs": ["task result", "hashes or inventory", "success/failure evidence"],
        "does_not": ["run arbitrary commands", "expand task authority", "hide failed work"],
    },
    "LOCAL-ARCHIVE-KNOWLEDGE": {
        "role": "Register bounded source metadata and agent-memory relationships.",
        "inputs": ["authorized locator", "source class", "labels and metadata"],
        "outputs": ["stable resource id", "knowledge event", "queryable relationship"],
        "does_not": ["rewrite source files", "invent provenance", "accept unbounded locators"],
    },
}
REQUIRED = {
    "role", "inputs", "outputs", "does_not", "authority_boundary",
    "failure_policy", "prism_boundary"
}

def packet(agent_id):
    body = {"schema": "DT_TEACH_BACK_V1", "parent_id": "AGENT-MASTER",
            "child_id": agent_id, "branch": "PROVISIONAL_CLOSEOUT_QUALIFICATION",
            **SPECS[agent_id], **COMMON}
    body["content_hash"] = hashlib.sha256(
        json.dumps(body, sort_keys=True).encode()).hexdigest()
    return body

def validate(body):
    missing = sorted(REQUIRED - set(body))
    errors = ([] if not missing else ["MISSING:" + ",".join(missing)])
    flat = json.dumps(body, sort_keys=True).lower()
    for term in ("no self-promotion", "stop on prism rejection",
                 "preserve failures append-only"):
        if term not in flat:
            errors.append("ABSENT_BOUNDARY:" + term)
    return {"valid": not errors, "errors": errors,
            "content_hash": body.get("content_hash")}
def record_all():
    report = []
    for agent_id in SPECS:
        body = packet(agent_id)
        result = validate(body)
        if not result["valid"]:
            record_gate(agent_id, "TEACH_BACK", "FAIL", result)
            report.append({"agent_id": agent_id, **result})
            continue
        c = init_foundry()
        duplicate = c.execute(
            "SELECT packet_id FROM communication_packets WHERE packet_kind='TEACH_BACK' "
            "AND child_id=? AND payload LIKE ? LIMIT 1",
            (agent_id, "%" + body["content_hash"] + "%")).fetchone()
        packet_id = duplicate["packet_id"] if duplicate else create_packet(
            "TEACH_BACK", body, status="READY_FOR_CUSTODIAN_REVIEW")
        evidence = {"packet_id": packet_id, **result,
                    "meaning": "Role/boundary comprehension verified; no authority granted."}
        record_gate(agent_id, "TEACH_BACK", "PASS", evidence)
        report.append({"agent_id": agent_id, **evidence})
    out = ROOT / "state" / "teachback_report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report

if __name__ == "__main__":
    print(json.dumps(record_all(), indent=2))
