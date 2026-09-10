from pathlib import Path
import argparse, subprocess, sys, shutil, json
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser(); ap.add_argument('--run',type=int,required=True); ap.add_argument('--timeout',type=int,default=90); a=ap.parse_args()
src=P/f'run_{a.run:02}.py'; out=P/'replay_outputs'/f'run_{a.run:02}'
out.mkdir(parents=True,exist_ok=True)
code=src.read_text(encoding='utf-8')
portable=code.replace('/mnt/data/',str(out).replace('\\','/')+'/').replace('/mnt/data',str(out).replace('\\','/'))
tmp=out/'portable_run.py'; tmp.write_text(portable,encoding='utf-8')
try:
 r=subprocess.run([sys.executable,str(tmp)],cwd=out,capture_output=True,text=True,timeout=a.timeout)
 result={'sequence':a.run,'returncode':r.returncode,'timeout':False,'stdout':r.stdout[-3000:],'stderr':r.stderr[-3000:]}
except subprocess.TimeoutExpired as e:
 result={'sequence':a.run,'returncode':None,'timeout':True,'stdout':(e.stdout or '')[-3000:] if isinstance(e.stdout,str) else '', 'stderr':(e.stderr or '')[-3000:] if isinstance(e.stderr,str) else ''}
result['artifacts']=sorted(x.name for x in out.iterdir() if x.name!='portable_run.py')
print(json.dumps(result,indent=2))