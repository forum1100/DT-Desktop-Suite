from __future__ import annotations
import argparse, json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / 'source_manifest.json').read_text(encoding='utf-8'))

def run_one(sequence: int, timeout: int = 45):
    item = next(x for x in MANIFEST['runs'] if x['sequence'] == sequence)
    source = (ROOT / item['file']).read_text(encoding='utf-8')
    outdir = ROOT / 'replay_outputs' / f'run_{sequence:02d}'
    outdir.mkdir(parents=True, exist_ok=True)
    # Derived portability shim only. The recovered source file itself is never modified.
    portable = source.replace('/mnt/data/', outdir.as_posix() + '/').replace('/mnt/data', outdir.as_posix())
    script = outdir / 'portable_replay.py'
    script.write_text(portable, encoding='utf-8')
    try:
        cp = subprocess.run([sys.executable, str(script)], cwd=outdir, capture_output=True, text=True, timeout=timeout)
        result = {'sequence': sequence, 'historical_status': item['historical_status'], 'replay_returncode': cp.returncode, 'stdout': cp.stdout[-10000:], 'stderr': cp.stderr[-10000:], 'timeout': False}
    except subprocess.TimeoutExpired as e:
        result = {'sequence': sequence, 'historical_status': item['historical_status'], 'replay_returncode': None, 'stdout': (e.stdout or '')[-10000:] if isinstance(e.stdout,str) else '', 'stderr': (e.stderr or '')[-10000:] if isinstance(e.stderr,str) else '', 'timeout': True}
    (outdir/'replay_receipt.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result
if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--run', type=int, required=True)
    ap.add_argument('--timeout', type=int, default=45)
    args = ap.parse_args()
    print(json.dumps(run_one(args.run,args.timeout),indent=2))