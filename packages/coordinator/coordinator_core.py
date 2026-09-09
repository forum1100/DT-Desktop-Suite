from __future__ import annotations
import json, os, sqlite3, time, uuid, socket, hashlib
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DB = ROOT / "state" / "coordinator.db"
STATE = ROOT / "state"
LOGS = ROOT / "logs"
INBOX = ROOT / "inbox"
OUTBOX = ROOT / "outbox"
for p in (STATE, LOGS, INBOX, OUTBOX):
    p.mkdir(parents=True, exist_ok=True)

def utcnow():
    return datetime.now(timezone.utc).isoformat()

def conn():
    c = sqlite3.connect(DB, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA synchronous=FULL")
    return c

def init_db():
    c = conn()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS workers(
      worker_id TEXT PRIMARY KEY, role TEXT, capabilities TEXT,
      pid INTEGER, host TEXT, last_heartbeat TEXT, status TEXT);
    CREATE TABLE IF NOT EXISTS tasks(
      task_id TEXT PRIMARY KEY, task_type TEXT, payload TEXT,
      priority INTEGER, status TEXT, created_at TEXT, updated_at TEXT,
      claimed_by TEXT, lease_until REAL, attempts INTEGER DEFAULT 0,
      result TEXT, error TEXT);
    CREATE TABLE IF NOT EXISTS events(
      event_id TEXT PRIMARY KEY, ts TEXT, worker_id TEXT,
      event_type TEXT, task_id TEXT, data TEXT,
      prev_hash TEXT, event_hash TEXT);
    CREATE INDEX IF NOT EXISTS idx_tasks_status_type
      ON tasks(status, task_type, priority);
    ''')
    return c

def append_event(c, worker_id, event_type, task_id=None, data=None):
    prev = c.execute("SELECT event_hash FROM events ORDER BY rowid DESC LIMIT 1").fetchone()
    prev_hash = prev[0] if prev else "GENESIS"
    body = json.dumps({"ts": utcnow(), "worker": worker_id, "type": event_type,
                       "task": task_id, "data": data or {}, "prev": prev_hash}, sort_keys=True)
    event_hash = hashlib.sha256(body.encode()).hexdigest()
    c.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?,?)",
              (str(uuid.uuid4()), utcnow(), worker_id, event_type,
               task_id, json.dumps(data or {}, sort_keys=True), prev_hash, event_hash))
    return event_hash

def submit_task(task_type, payload, priority=100):
    c = init_db()
    task_id = str(uuid.uuid4())
    now = utcnow()
    c.execute("INSERT INTO tasks(task_id,task_type,payload,priority,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
              (task_id, task_type, json.dumps(payload), int(priority), "PENDING", now, now))
    append_event(c, "local-submit", "TASK_SUBMITTED", task_id, {"task_type": task_type, "priority": priority})
    return task_id

def heartbeat(c, worker_id, role, capabilities, status="IDLE"):
    c.execute('''INSERT INTO workers(worker_id,role,capabilities,pid,host,last_heartbeat,status)
                 VALUES(?,?,?,?,?,?,?) ON CONFLICT(worker_id) DO UPDATE SET
                 role=excluded.role, capabilities=excluded.capabilities, pid=excluded.pid,
                 host=excluded.host, last_heartbeat=excluded.last_heartbeat, status=excluded.status''',
              (worker_id, role, json.dumps(capabilities), os.getpid(), socket.gethostname(), utcnow(), status))

def claim_task(c, worker_id, capabilities, lease_seconds=300):
    now = time.time()
    c.execute("BEGIN IMMEDIATE")
    try:
        qs = ','.join('?' for _ in capabilities)
        row = c.execute(f"SELECT * FROM tasks WHERE task_type IN ({qs}) AND (status='PENDING' OR (status='CLAIMED' AND lease_until<?)) ORDER BY priority ASC, created_at ASC LIMIT 1",
                        [*capabilities, now]).fetchone()
        if not row:
            c.execute("COMMIT")
            return None
        c.execute("UPDATE tasks SET status='CLAIMED',claimed_by=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE task_id=?",
                  (worker_id, now + lease_seconds, utcnow(), row['task_id']))
        append_event(c, worker_id, "TASK_CLAIMED", row['task_id'], {"lease_seconds": lease_seconds})
        c.execute("COMMIT")
        return dict(row)
    except Exception:
        c.execute("ROLLBACK")
        raise

def finish_task(c, worker_id, task_id, result):
    c.execute("UPDATE tasks SET status='DONE',result=?,error=NULL,lease_until=NULL,updated_at=? WHERE task_id=?",
              (json.dumps(result, sort_keys=True), utcnow(), task_id))
    append_event(c, worker_id, "TASK_DONE", task_id, result)

def fail_task(c, worker_id, task_id, error):
    c.execute("UPDATE tasks SET status='FAILED',error=?,lease_until=NULL,updated_at=? WHERE task_id=?",
              (str(error), utcnow(), task_id))
    append_event(c, worker_id, "TASK_FAILED", task_id, {"error": str(error)})

def status_snapshot():
    c = init_db()
    workers = [dict(r) for r in c.execute("SELECT * FROM workers ORDER BY worker_id")]
    tasks = [dict(r) for r in c.execute("SELECT task_id,task_type,priority,status,claimed_by,attempts,updated_at,error FROM tasks ORDER BY created_at DESC LIMIT 100")]
    return {"workers": workers, "tasks": tasks, "db": str(DB), "generated_at": utcnow()}
