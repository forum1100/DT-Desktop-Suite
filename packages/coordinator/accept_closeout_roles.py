from __future__ import annotations
import argparse
import json
from foundry_contract import grant_authority, record_gate

OWNER = "forum1100"
ACK = "I ACCEPT THE BOUNDED DT CLOSEOUT ROLES"
ROLE_GRANTS = {
    "LOCAL-CLOSEOUT-MANAGER": [
        "CREATE_USER_INITIATED_SESSION", "LAUNCH_BOUNDED_CLOSEOUT_WORKERS",
        "SUBMIT_ALLOWLISTED_CLOSEOUT_TASKS"
    ],
    "LOCAL-CLOSEOUT-WORKER": [
        "READ_SESSION_AUTHORIZED_ROOTS", "WRITE_SESSION_OUTPUT_ROOTS",
        "EXECUTE_ALLOWLISTED_CLOSEOUT_TASKS"
    ],
    "LOCAL-ARCHIVE-KNOWLEDGE": [
        "REGISTER_AUTHORIZED_RESOURCE_METADATA", "LINK_AGENT_MEMORY",
        "QUERY_LOCAL_ARCHIVE_INDEX"
    ],
}
LIMITS = [
    "NO_SUBDELEGATION", "NO_SELF_PROMOTION", "NO_ARBITRARY_COMMANDS",
    "NO_COVERT_CAPTURE", "NO_UNATTENDED_SESSION_START",
    "PRISM_REQUIRED", "USER_INITIATED_SESSION_REQUIRED"
]

def acceptance_packet(owner, authenticated_login, acknowledgment):
    return {
        "schema": "DT_CLOSEOUT_OWNER_ACCEPTANCE_V1",
        "owner": owner,
        "authenticated_login": authenticated_login,
        "acknowledgment": acknowledgment,
        "jurisdiction": "local desktop closeout; session-scoped execution",
        "role_grants": ROLE_GRANTS,
        "limits": LIMITS,
        "subdelegation": False,
        "perpetual_execution": False,
    }

def validate(packet):
    errors = []
    if packet.get("owner") != OWNER or packet.get("authenticated_login") != OWNER:
        errors.append("OWNER_IDENTITY_NOT_VERIFIED")
    if packet.get("acknowledgment") != ACK:
        errors.append("EXACT_ACKNOWLEDGMENT_REQUIRED")
    if packet.get("subdelegation") is not False:
        errors.append("SUBDELEGATION_MUST_BE_FALSE")
    if packet.get("perpetual_execution") is not False:
        errors.append("PERPETUAL_EXECUTION_MUST_BE_FALSE")
    if packet.get("role_grants") != ROLE_GRANTS:
        errors.append("ROLE_GRANTS_CHANGED")
    if packet.get("limits") != LIMITS:
        errors.append("LIMITS_CHANGED")
    return {"valid": not errors, "errors": errors}

def apply(packet):
    result = validate(packet)
    if not result["valid"]:
        raise ValueError("ACCEPTANCE_REJECTED:" + ",".join(result["errors"]))
    grants = []
    for agent_id, permissions in ROLE_GRANTS.items():
        evidence = {
            "acceptance_schema": packet["schema"],
            "acknowledgment": packet["acknowledgment"],
            "limits": LIMITS,
            "meaning": "Capability authority only; each execution needs a user-initiated session."
        }
        grant_id = grant_authority(
            OWNER, agent_id, packet["jurisdiction"], permissions,
            subdelegation=False, evidence=evidence)
        record_gate(agent_id, "PERMISSIONS", "PASS", {
            **evidence, "grant_id": grant_id, "permissions": permissions})
        record_gate(agent_id, "TAKEOVER", "PASS", {
            **evidence, "custodian": OWNER, "accepted_role": agent_id})
        grants.append({"agent_id": agent_id, "grant_id": grant_id})
    return {"accepted": True, "grants": grants, "limits": LIMITS,
            "promotion_performed": False, "process_started": False}
def main():
    ap = argparse.ArgumentParser(description="Owner acceptance for bounded DT closeout roles")
    ap.add_argument("--authenticated-login", required=True)
    ap.add_argument("--acknowledgment", required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    packet = acceptance_packet(OWNER, args.authenticated_login, args.acknowledgment)
    result = validate(packet)
    if args.apply:
        result = apply(packet)
    print(json.dumps({"packet": packet, "result": result}, indent=2))

if __name__ == "__main__":
    main()
