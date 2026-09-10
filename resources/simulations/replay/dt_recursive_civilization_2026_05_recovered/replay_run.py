from __future__ import annotations
import argparse,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
MANIFEST=json.loads((ROOT/'source_manifest.json').read_text(encoding='utf-8'))
def portable_source(source:str,outdir:Path)->str:
    p=outdir.as_posix()
    source=source.replace('/mnt/data/',p+'/')
    source=source.replace("Path('/mnt/data')",f"Path(r'{p}')")
    source=source.replace('Path("/mnt/data")',f"Path(r'{p}')")
    return source
def run_one(sequence:int,timeout:int=45):
    item=next(x for x in MANIFEST['runs'] if x['sequence']==sequence)
    source=(ROOT/item['file']).read_text(encoding='utf-8')
    outdir=ROOT/'replay_outputs'/f'run_{sequence:02d}'; outdir.mkdir(parents=True,exist_ok=True)
    script=outdir/'portable_replay.py'; script.write_text(portable_source(source,outdir),encoding='utf-8')
    before={p.name for p in outdir.iterdir() if p.is_file()}
    try:
        cp=subprocess.run([sys.executable,str(script)],cwd=outdir,capture_output=True,text=True,timeout=timeout)
        result={'sequence':sequence,'historical_status':item['historical_status'],'returncode':cp.returncode,'timeout':False,'stdout':cp.stdout[-10000:],'stderr':cp.stderr[-10000:]}
    except subprocess.TimeoutExpired as e:
        result={'sequence':sequence,'historical_status':item['historical_status'],'returncode':None,'timeout':True,'stdout':'','stderr':''}
    after={p.name for p in outdir.iterdir() if p.is_file()}
    result['artifacts']=sorted(x for x in after-before if x not in {'portable_replay.py','replay_receipt.json'})
    (outdir/'replay_receipt.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--run',type=int,required=True); ap.add_argument('--timeout',type=int,default=45)
    a=ap.parse_args(); print(json.dumps(run_one(a.run,a.timeout),indent=2))