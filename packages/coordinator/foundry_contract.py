from __future__ import annotations
import json, sqlite3, uuid
from coordinator_core import init_db, append_event, utcnow

LIFECYCLE = (
    "SPECIFIED_ONLY", "DORMANT_SPEC", "IMPLEMENTATION_CANDIDATE",
    "IMPLEMENTED_UNVALIDATED", "VALIDATED", "RUNNING",
    "RETIRED", "SUPERSEDED", "UNKNOWN",
)
PROMOTIONS = {
    "SPECIFIED_ONLY": {"DORMANT_SPEC", "IMPLEMENTATION_CANDIDATE"},
    "DORMANT_SPEC": {"IMPLEMENTATION_CANDIDATE"},
    "IMPLEMENTATION_CANDIDATE": {"IMPLEMENTED_UNVALIDATED"},
    "IMPLEMENTED_UNVALIDATED": {"VALIDATED"},
    "VALIDATED": {"RUNNING"},
    "RUNNING": {"VALIDATED", "RETIRED", "SUPERSEDED"},
}
PACKET_KINDS = {"DOWNWARD_TASK", "UPWARD_STATE", "CONTEXT_REQUEST",
                "TEACH_BACK", "BYPASS", "RESIDUAL"}
REQUIRED_DOWN = {"parent_id", "child_id", "origin", "branch", "reason",
                 "task", "jurisdiction", "allowed_sources", "rules",
                 "constraints", "contradictions", "validation",
                 "return_format", "escalation"}
REQUIRED_UP = {"parent_id", "child_id", "changed", "reason", "evidence",
               "conclusion", "uncertainty", "contradictions", "failed_branches",
               "implications", "parent_action", "locators"}
def _j(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

def init_foundry():
    c = init_db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS agent_identities(
      agent_id TEXT PRIMARY KEY, parent_id TEXT, role TEXT, jurisdiction TEXT,
      lifecycle TEXT, authority_source TEXT, blueprint_version TEXT,
      created_at TEXT, updated_at TEXT, evidence TEXT);
    CREATE TABLE IF NOT EXISTS authority_grants(
      grant_id TEXT PRIMARY KEY, grantor TEXT, grantee TEXT, jurisdiction TEXT,
      permissions TEXT, subdelegation INTEGER, status TEXT, created_at TEXT,
      revoked_at TEXT, evidence TEXT);
    CREATE TABLE IF NOT EXISTS communication_packets(
      packet_id TEXT PRIMARY KEY, packet_kind TEXT, parent_id TEXT, child_id TEXT,
      branch TEXT, payload TEXT, status TEXT, created_at TEXT, responded_at TEXT);
    CREATE TABLE IF NOT EXISTS qualification_gates(
      gate_id TEXT PRIMARY KEY, agent_id TEXT, gate_type TEXT, status TEXT,
      evidence TEXT, checked_at TEXT);
    CREATE TABLE IF NOT EXISTS residuals(
      residual_id TEXT PRIMARY KEY, agent_id TEXT, branch TEXT, description TEXT,
      source TEXT, reason TEXT, recovery_attempts TEXT, next_action TEXT,
      impact TEXT, blocking INTEGER, status TEXT, created_at TEXT, updated_at TEXT);
    """)
    return c

def register_agent(agent_id, role, lifecycle="SPECIFIED_ONLY", parent_id=None,
                   jurisdiction="", authority_source="", blueprint_version="",
                   evidence=None):
    if lifecycle not in LIFECYCLE:
        raise ValueError("invalid lifecycle")
    c = init_foundry(); now = utcnow()
    c.execute("""INSERT INTO agent_identities VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(agent_id) DO UPDATE SET parent_id=excluded.parent_id,
      role=excluded.role,jurisdiction=excluded.jurisdiction,
      blueprint_version=excluded.blueprint_version,updated_at=excluded.updated_at,
      evidence=excluded.evidence""",
      (agent_id,parent_id,role,jurisdiction,lifecycle,authority_source,
       blueprint_version,now,now,_j(evidence or {})))
    append_event(c,"foundry-contract","AGENT_REGISTERED",data={
      "agent_id":agent_id,"lifecycle":lifecycle})
    return agent_id

def grant_authority(grantor, grantee, jurisdiction, permissions,
                    subdelegation=False, evidence=None):
    c=init_foundry(); gid=str(uuid.uuid4()); now=utcnow()
    c.execute("INSERT INTO authority_grants VALUES(?,?,?,?,?,?,?,?,?,?)",
      (gid,grantor,grantee,jurisdiction,_j(permissions),int(subdelegation),
       "ACTIVE",now,None,_j(evidence or {})))
    append_event(c,grantor,"AUTHORITY_GRANTED",data={
      "grant_id":gid,"grantee":grantee,"jurisdiction":jurisdiction})
    return gid

def create_packet(kind, payload, status="OPEN"):
    if kind not in PACKET_KINDS:
        raise ValueError("invalid packet kind")
    required = REQUIRED_DOWN if kind == "DOWNWARD_TASK" else (
               REQUIRED_UP if kind == "UPWARD_STATE" else set())
    missing=sorted(required-set(payload))
    if missing:
        raise ValueError("missing packet fields: "+", ".join(missing))
    c=init_foundry(); pid=str(uuid.uuid4()); now=utcnow()
    c.execute("INSERT INTO communication_packets VALUES(?,?,?,?,?,?,?,?,?)",
      (pid,kind,payload.get("parent_id"),payload.get("child_id"),
       payload.get("branch"),_j(payload),status,now,None))
    append_event(c,payload.get("child_id") or payload.get("parent_id") or "system",
      "PACKET_"+kind,data={"packet_id":pid,"branch":payload.get("branch")})
    return pid
def record_gate(agent_id, gate_type, status, evidence=None):
    if status not in {"PASS","FAIL","PENDING","NOT_APPLICABLE"}:
        raise ValueError("invalid gate status")
    c=init_foundry(); gid=str(uuid.uuid4())
    c.execute("INSERT INTO qualification_gates VALUES(?,?,?,?,?,?)",
      (gid,agent_id,gate_type,status,_j(evidence or {}),utcnow()))
    append_event(c,"foundry-contract","GATE_"+status,data={
      "gate_id":gid,"agent_id":agent_id,"gate_type":gate_type})
    return gid

def record_residual(agent_id, branch, description, source, reason,
                    recovery_attempts, next_action, impact, blocking=True):
    c=init_foundry(); rid=str(uuid.uuid4()); now=utcnow()
    c.execute("INSERT INTO residuals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      (rid,agent_id,branch,description,source,reason,_j(recovery_attempts),
       next_action,impact,int(blocking),"OPEN",now,now))
    append_event(c,agent_id,"RESIDUAL_OPENED",data={
      "residual_id":rid,"branch":branch,"blocking":bool(blocking)})
    return rid

def promote_agent(agent_id, target, evidence=None):
    if target not in LIFECYCLE:
        raise ValueError("invalid lifecycle")
    c=init_foundry()
    row=c.execute("SELECT lifecycle FROM agent_identities WHERE agent_id=?",
                  (agent_id,)).fetchone()
    if not row:
        raise KeyError(agent_id)
    current=row["lifecycle"]
    if target not in PROMOTIONS.get(current,set()):
        raise ValueError(f"illegal transition {current} -> {target}")
    failed=c.execute("""SELECT COUNT(*) FROM qualification_gates
      WHERE agent_id=? AND status IN ('FAIL','PENDING')""",(agent_id,)).fetchone()[0]
    blockers=c.execute("""SELECT COUNT(*) FROM residuals
      WHERE agent_id=? AND blocking=1 AND status='OPEN'""",(agent_id,)).fetchone()[0]
    if target in {"VALIDATED","RUNNING"} and (failed or blockers):
        raise ValueError("promotion blocked by gates or residuals")
    if target == "RUNNING":
        passed={r[0] for r in c.execute("""SELECT gate_type FROM qualification_gates
          WHERE agent_id=? AND status='PASS'""",(agent_id,))}
        required={"SOURCE_RECONCILIATION","PERMISSIONS","PRISM_SECURITY",
                  "TEACH_BACK","TAKEOVER","RUNTIME_TEST"}
        missing=sorted(required-passed)
        if missing:
            raise ValueError("RUNNING requires gates: "+", ".join(missing))
    c.execute("""UPDATE agent_identities SET lifecycle=?,authority_source=
      COALESCE(NULLIF(authority_source,''),?),updated_at=?,evidence=?
      WHERE agent_id=?""",(target,(evidence or {}).get("authority_source",""),
      utcnow(),_j(evidence or {}),agent_id))
    append_event(c,"foundry-contract","AGENT_PROMOTED",data={
      "agent_id":agent_id,"from":current,"to":target})
    return {"agent_id":agent_id,"from":current,"to":target}

def snapshot():
    c=init_foundry()
    return {
      "agents":[dict(r) for r in c.execute(
        "SELECT * FROM agent_identities ORDER BY agent_id")],
      "active_grants":[dict(r) for r in c.execute(
        "SELECT * FROM authority_grants WHERE status='ACTIVE'")],
      "open_packets":[dict(r) for r in c.execute(
        "SELECT * FROM communication_packets WHERE status='OPEN'")],
      "open_residuals":[dict(r) for r in c.execute(
        "SELECT * FROM residuals WHERE status='OPEN'")],
      "generated_at":utcnow(),
    }
