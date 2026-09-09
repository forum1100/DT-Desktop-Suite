from __future__ import annotations
import sqlite3, json, hashlib, time
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'state' / 'archive_knowledge.db'
DB.parent.mkdir(parents=True, exist_ok=True)

def utcnow(): return datetime.now(timezone.utc).isoformat()
def conn():
    c = sqlite3.connect(DB, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('PRAGMA synchronous=FULL')
    return c

def init_db():
    c = conn()
    c.executescript('''
    CREATE TABLE IF NOT EXISTS resources(
      resource_id TEXT PRIMARY KEY, locator TEXT UNIQUE, kind TEXT,
      bytes INTEGER, mtime_ns INTEGER, sha256 TEXT, source_class TEXT,
      title TEXT, labels TEXT, first_seen TEXT, last_seen TEXT, status TEXT);
    CREATE INDEX IF NOT EXISTS idx_resources_sha ON resources(sha256);
    CREATE INDEX IF NOT EXISTS idx_resources_title ON resources(title);
    CREATE TABLE IF NOT EXISTS agent_memory(
      agent_id TEXT, memory_key TEXT, resource_id TEXT, note TEXT,
      updated_at TEXT, PRIMARY KEY(agent_id,memory_key,resource_id));
    CREATE TABLE IF NOT EXISTS knowledge_events(
      event_id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, agent_id TEXT,
      event_type TEXT, resource_id TEXT, data TEXT);
    ''')
    return c

def stable_id(locator: str):
    return hashlib.sha256(locator.encode('utf-8')).hexdigest()

def register_resource(locator, kind='file', bytes_=None, mtime_ns=None, sha256=None,
                      source_class='UNKNOWN', title=None, labels=None, status='KNOWN'):
    c=init_db(); rid=stable_id(locator); now=utcnow(); labels=labels or []
    c.execute('''INSERT INTO resources(resource_id,locator,kind,bytes,mtime_ns,sha256,source_class,title,labels,first_seen,last_seen,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(locator) DO UPDATE SET
      kind=excluded.kind,bytes=excluded.bytes,mtime_ns=excluded.mtime_ns,sha256=COALESCE(excluded.sha256,resources.sha256),
      source_class=excluded.source_class,title=COALESCE(excluded.title,resources.title),labels=excluded.labels,last_seen=excluded.last_seen,status=excluded.status''',
      (rid,locator,kind,bytes_,mtime_ns,sha256,source_class,title,json.dumps(labels),now,now,status))
    c.execute('INSERT INTO knowledge_events(ts,agent_id,event_type,resource_id,data) VALUES(?,?,?,?,?)',
      (now,'system','RESOURCE_REGISTERED',rid,json.dumps({'locator':locator})))
    return rid

def remember(agent_id, memory_key, resource_id, note=''):
    c=init_db(); now=utcnow()
    c.execute('''INSERT INTO agent_memory(agent_id,memory_key,resource_id,note,updated_at)
      VALUES(?,?,?,?,?) ON CONFLICT(agent_id,memory_key,resource_id) DO UPDATE SET
      note=excluded.note,updated_at=excluded.updated_at''',
      (agent_id,memory_key,resource_id,note,now))
    c.execute('INSERT INTO knowledge_events(ts,agent_id,event_type,resource_id,data) VALUES(?,?,?,?,?)',
      (now,agent_id,'MEMORY_LINKED',resource_id,json.dumps({'memory_key':memory_key,'note':note})))

def lookup(query='', agent_id=None, limit=100):
    c=init_db(); q=f'%{query}%'
    if agent_id:
        rows=c.execute('''SELECT r.*,m.memory_key,m.note FROM resources r
          JOIN agent_memory m ON m.resource_id=r.resource_id
          WHERE m.agent_id=? AND (r.locator LIKE ? OR COALESCE(r.title,'') LIKE ? OR COALESCE(r.labels,'') LIKE ? OR COALESCE(m.note,'') LIKE ?)
          ORDER BY m.updated_at DESC LIMIT ?''',(agent_id,q,q,q,q,limit)).fetchall()
    else:
        rows=c.execute('''SELECT * FROM resources WHERE locator LIKE ? OR COALESCE(title,'') LIKE ? OR COALESCE(labels,'') LIKE ?
          ORDER BY last_seen DESC LIMIT ?''',(q,q,q,limit)).fetchall()
    return [dict(r) for r in rows]

def freshness(locator, bytes_=None, mtime_ns=None):
    c=init_db(); row=c.execute('SELECT * FROM resources WHERE locator=?',(locator,)).fetchone()
    if not row: return {'known':False,'needs_ingest':True}
    changed=((bytes_ is not None and row['bytes']!=bytes_) or (mtime_ns is not None and row['mtime_ns']!=mtime_ns))
    return {'known':True,'changed':changed,'needs_ingest':changed,'resource':dict(row)}
