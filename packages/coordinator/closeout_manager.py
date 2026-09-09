from __future__ import annotations
import argparse, json, os, subprocess, sys, uuid
from pathlib import Path
from coordinator_core import init_db, submit_task, append_event, utcnow

ROOT = Path(__file__).resolve().parent
STATE = ROOT / 'state'
LOGS = ROOT / 'logs'
SESSIONS = ROOT / 'closeout_sessions'
for p in (STATE, LOGS, SESSIONS): p.mkdir(parents=True, exist_ok=True)

def launch_workers(count: int, session_id: str):
    flags = 0
    if os.name == 'nt':
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    started = []
    for i in range(count):
        wid = f'closeout-{session_id[:8]}-{i+1:03d}'
        out = open(LOGS / f'{wid}.out.log', 'a', encoding='utf-8')
        err = open(LOGS / f'{wid}.err.log', 'a', encoding='utf-8')
        p = subprocess.Popen([sys.executable, str(ROOT/'closeout_worker.py'), '--id', wid],
            cwd=ROOT, stdin=subprocess.DEVNULL, stdout=out, stderr=err,
            creationflags=flags, close_fds=True)
        started.append({'worker_id': wid, 'pid': p.pid})
    return started

def start_session(args):
    session_id = args.session_id or str(uuid.uuid4())
    session_dir = SESSIONS / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    source = Path(args.source).resolve()
    record = {
        'session_id': session_id,
        'created_at': utcnow(),
        'source': str(source),
        'workers_requested': args.workers,
        'status': 'RUNNING',
        'authority': 'DT_CLOSEOUT_SESSION_SCOPED',
    }
    (session_dir/'session.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    c = init_db(); append_event(c, 'closeout-manager', 'CLOSEOUT_SESSION_STARTED', data=record)
    started = launch_workers(args.workers, session_id)
    record['workers'] = started
    (session_dir/'session.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    scan_id = submit_task('closeout_scan', {'roots':[str(source)]}, priority=10)
    manifest_id = submit_task('closeout_manifest', {
        'root': str(source), 'output': str(session_dir/'source_manifest.json')}, priority=90)
    record['task_ids'] = {'scan': scan_id, 'manifest': manifest_id}
    (session_dir/'session.json').write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record, indent=2))

def status_session(args):
    session_dir = SESSIONS / args.session_id
    p = session_dir / 'session.json'
    if not p.exists(): raise SystemExit(f'Unknown session: {args.session_id}')
    record = json.loads(p.read_text(encoding='utf-8'))
    c = init_db()
    tasks = [dict(r) for r in c.execute(
        "SELECT task_id,task_type,status,claimed_by,attempts,updated_at,error FROM tasks "
        "WHERE task_id IN (?,?)",
        (record.get('task_ids',{}).get('scan',''), record.get('task_ids',{}).get('manifest','')))]
    record['tasks'] = tasks
    print(json.dumps(record, indent=2))

def main():
    ap = argparse.ArgumentParser(description='Persistent DT_CLOSEOUT desktop manager')
    sub = ap.add_subparsers(dest='cmd', required=True)
    s = sub.add_parser('start')
    s.add_argument('--source', required=True)
    s.add_argument('--workers', type=int, default=max(2, (os.cpu_count() or 4)//2))
    s.add_argument('--session-id')
    q = sub.add_parser('status'); q.add_argument('--session-id', required=True)
    a = ap.parse_args()
    if getattr(a, 'workers', 1) < 1: raise SystemExit('--workers must be >= 1')
    if a.cmd == 'start': start_session(a)
    elif a.cmd == 'status': status_session(a)

if __name__ == '__main__': main()
