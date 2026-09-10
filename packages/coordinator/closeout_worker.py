from __future__ import annotations
import argparse, json, time, traceback, os, hashlib
from pathlib import Path
from coordinator_core import init_db, heartbeat, claim_task, finish_task, fail_task, append_event
from prism_guard import PrismRejected, require_task

CHUNK = 8 * 1024 * 1024

def sha256_file(path: Path):
    h = hashlib.sha256(); n = 0
    with path.open('rb') as f:
        while True:
            b = f.read(CHUNK)
            if not b: break
            h.update(b); n += len(b)
    return n, h.hexdigest()

def handle_closeout_hash(payload):
    rows = []
    for raw in payload.get('paths', []):
        p = Path(raw)
        if not p.is_file():
            rows.append({'path': str(p), 'missing': True}); continue
        n, h = sha256_file(p)
        rows.append({'path': str(p), 'bytes': n, 'sha256': h})
    return {'files': rows}

def handle_closeout_scan(payload):
    roots = [Path(x) for x in payload.get('roots', []) if Path(x).exists()]
    include = {s.lower() for s in payload.get('suffixes', [])}
    rows = []
    for root in roots:
        for base, dirs, files in os.walk(root):
            for name in files:
                p = Path(base) / name
                try:
                    st = p.stat()
                except OSError:
                    continue
                if include and p.suffix.lower() not in include:
                    continue
                rows.append({'path': str(p), 'bytes': st.st_size, 'mtime_ns': st.st_mtime_ns})
    return {'count': len(rows), 'files': rows}

def handle_closeout_slice(payload):
    src = Path(payload['source'])
    out = Path(payload['output'])
    start = int(payload.get('start', 0)); length = int(payload.get('length', 0))
    out.parent.mkdir(parents=True, exist_ok=True)
    with src.open('rb') as f:
        f.seek(start); data = f.read(length if length > 0 else -1)
    out.write_bytes(data)
    n, h = sha256_file(out)
    return {'source': str(src), 'output': str(out), 'start': start, 'bytes': n, 'sha256': h}

def handle_closeout_manifest(payload):
    root = Path(payload['root'])
    output = Path(payload['output'])
    rows = []
    for p in root.rglob('*'):
        if not p.is_file():
            continue
        try:
            n, h = sha256_file(p)
            rows.append({'path': str(p.relative_to(root)), 'bytes': n, 'sha256': h})
        except OSError as e:
            rows.append({'path': str(p), 'error': repr(e)})
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'root': str(root), 'files': rows}, indent=2), encoding='utf-8')
    n, h = sha256_file(output)
    return {'manifest': str(output), 'entries': len(rows), 'bytes': n, 'sha256': h}

HANDLERS = {
    'closeout_hash': handle_closeout_hash,
    'closeout_scan': handle_closeout_scan,
    'closeout_slice': handle_closeout_slice,
    'closeout_manifest': handle_closeout_manifest,
}

def execute_guarded(task_type, payload):
    prism = require_task(task_type, payload)
    return prism, HANDLERS[task_type](payload)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--id', required=True); ap.add_argument('--once', action='store_true')
    a = ap.parse_args(); caps = list(HANDLERS)
    c = init_db(); append_event(c, a.id, 'CLOSEOUT_WORKER_STARTED', data={'capabilities': caps})
    while True:
        heartbeat(c, a.id, 'CLOSEOUT_WORKER', caps, 'IDLE')
        task = claim_task(c, a.id, caps, lease_seconds=1800)
        if not task:
            if a.once: break
            time.sleep(2); continue
        heartbeat(c, a.id, 'CLOSEOUT_WORKER', caps, 'WORKING')
        try:
            payload = json.loads(task['payload'])
            prism, result = execute_guarded(task['task_type'], payload)
            append_event(c, a.id, 'PRISM_SECURITY_PASS', task['task_id'], prism)
            finish_task(c, a.id, task['task_id'], result)
        except PrismRejected as exc:
            evidence = {'code': 'PRISM_REJECTED', 'reasons': list(exc.reasons)}
            append_event(c, a.id, 'PRISM_SECURITY_REJECTED', task['task_id'], evidence)
            fail_task(c, a.id, task['task_id'], json.dumps(evidence, sort_keys=True))
        except Exception:
            fail_task(c, a.id, task['task_id'], traceback.format_exc())
        if a.once: break
    heartbeat(c, a.id, 'CLOSEOUT_WORKER', caps, 'STOPPED')

if __name__ == '__main__':
    main()
