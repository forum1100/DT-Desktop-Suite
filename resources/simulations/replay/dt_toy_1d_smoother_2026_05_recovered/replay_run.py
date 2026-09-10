from __future__ import annotations
import argparse, json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
MAN=json.loads((ROOT/'source_manifest.json').read_text(encoding='utf-8'))
def run_one(seq:int,timeout:int=45):
    item=next(x for x in MAN['runs'] if x['sequence']==seq)
    source=(ROOT/item['file']).read_text(encoding='utf-8')
    outdir=ROOT/'replay_outputs'/f'run_{seq:02d}'
    outdir.mkdir(parents=True,exist_ok=True)
    portable=source.replace("Path('/mnt/data')","Path(r'%s')"%str(outdir).replace('\\','\\\\')).replace('"/mnt/data/','"'+outdir.as_posix()+'/').replace("'/mnt/data/","'"+outdir.as_posix()+'/')
    script=outdir/'portable_replay.py'; script.write_text(portable,encoding='utf-8')
    try:
        cp=subprocess.run([sys.executable,str(script)],cwd=outdir,capture_output=True,text=True,timeout=timeout)
        result={'sequence':seq,'historical_status':item['status'],'returncode':cp.returncode,'timeout':False,'stdout':cp.stdout[-8000:],'stderr':cp.stderr[-8000:]}
    except subprocess.TimeoutExpired as e:
        result={'sequence':seq,'historical_status':item['status'],'returncode':None,'timeout':True,'stdout':'','stderr':''}
    files=[p.name for p in outdir.iterdir() if p.is_file() and p.name not in {'portable_replay.py','replay_receipt.json'}]
    result['artifacts']=sorted(files)
    (outdir/'replay_receipt.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    return result
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('--run',type=int,required=True); ap.add_argument('--timeout',type=int,default=45)
    a=ap.parse_args(); print(json.dumps(run_one(a.run,a.timeout),indent=2))