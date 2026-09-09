from __future__ import annotations
import subprocess, sys, os, json, time
from pathlib import Path

ROOT=Path(__file__).resolve().parent
LOGS=ROOT/'logs'; LOGS.mkdir(exist_ok=True)
PY=sys.executable
workers=[
 ('model-discovery','MODEL_DISCOVERY',['model_inventory','hash_files']),
 ('hardware-profiler','HARDWARE_PROFILE',['hardware_profile']),
 ('architecture-builder','ARCHITECTURE_BUILDER',['scaffold']),
 ('generalist-a','GENERALIST',['model_inventory','hash_files','hardware_profile','scaffold']),
 ('generalist-b','GENERALIST',['model_inventory','hash_files','hardware_profile','scaffold']),
]
flags=0
if os.name=='nt': flags=subprocess.CREATE_NEW_PROCESS_GROUP|subprocess.DETACHED_PROCESS
started=[]
for wid,role,caps in workers:
    out=open(LOGS/f'{wid}.out.log','a',encoding='utf-8')
    err=open(LOGS/f'{wid}.err.log','a',encoding='utf-8')
    args=[PY,str(ROOT/'worker.py'),'--id',wid,'--role',role]
    for c in caps: args += ['--cap',c]
    p=subprocess.Popen(args,cwd=ROOT,stdout=out,stderr=err,stdin=subprocess.DEVNULL,creationflags=flags,close_fds=True)
    started.append({'worker_id':wid,'pid':p.pid,'caps':caps})
print(json.dumps({'started':started},indent=2))
