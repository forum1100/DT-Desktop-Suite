from __future__ import annotations
import argparse, json, time, traceback, os, hashlib
from pathlib import Path
from coordinator_core import init_db, heartbeat, claim_task, finish_task, fail_task, append_event

ROOT = Path(__file__).resolve().parent

def hash_file(path, chunk=8*1024*1024):
    h=hashlib.sha256(); n=0
    with open(path,'rb') as f:
        while True:
            b=f.read(chunk)
            if not b: break
            h.update(b); n+=len(b)
    return n,h.hexdigest()

def handle_inventory(payload):
    roots=[Path(p) for p in payload.get('roots',[]) if Path(p).exists()]
    min_bytes=int(payload.get('min_bytes',500_000_000))
    suffixes={s.lower() for s in payload.get('suffixes',['.gguf','.safetensors','.bin','.pth','.pt','.ckpt','.onnx','.tar','.zip'])}
    hits=[]; scanned=0
    for root in roots:
        for base, dirs, files in os.walk(root):
            for name in files:
                scanned+=1
                p=Path(base)/name
                try: size=p.stat().st_size
                except OSError: continue
                low=name.lower()
                if size>=min_bytes and (p.suffix.lower() in suffixes or any(k in low for k in ['grok','xai','model','weight','checkpoint'])):
                    hits.append({'path':str(p),'bytes':size})
    hits.sort(key=lambda x:x['bytes'], reverse=True)
    return {'scanned_files':scanned,'hits':hits[:500]}
def handle_hardware(payload):
    import ctypes, platform, subprocess
    class MEMORYSTATUSEX(ctypes.Structure):
        _fields_=[('dwLength',ctypes.c_ulong),('dwMemoryLoad',ctypes.c_ulong),('ullTotalPhys',ctypes.c_ulonglong),('ullAvailPhys',ctypes.c_ulonglong),('ullTotalPageFile',ctypes.c_ulonglong),('ullAvailPageFile',ctypes.c_ulonglong),('ullTotalVirtual',ctypes.c_ulonglong),('ullAvailVirtual',ctypes.c_ulonglong),('ullAvailExtendedVirtual',ctypes.c_ulonglong)]
    m=MEMORYSTATUSEX(); m.dwLength=ctypes.sizeof(m); ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
    ps='Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress'
    try:
        gpu=subprocess.run(['powershell','-NoProfile','-Command',ps],capture_output=True,text=True,timeout=30)
        gpu_data=gpu.stdout.strip()
    except Exception as e: gpu_data=repr(e)
    return {'platform':platform.platform(),'cpu_count':os.cpu_count(),'ram_total':m.ullTotalPhys,'ram_available':m.ullAvailPhys,'gpu_raw':gpu_data}

def handle_scaffold(payload):
    name=payload['name']; target=ROOT/'workspaces'/name; target.mkdir(parents=True,exist_ok=True)
    files=payload.get('files',{})
    for rel,text in files.items():
        p=target/rel; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(text,encoding='utf-8')
    manifest=[]
    for p in target.rglob('*'):
        if p.is_file():
            n,h=hash_file(p); manifest.append({'path':str(p.relative_to(target)),'bytes':n,'sha256':h})
    return {'workspace':str(target),'manifest':manifest}

def handle_hash(payload):
    rows=[]
    for raw in payload.get('paths',[]):
        p=Path(raw)
        if p.is_file():
            n,h=hash_file(p); rows.append({'path':str(p),'bytes':n,'sha256':h})
        else: rows.append({'path':str(p),'missing':True})
    return {'files':rows}

HANDLERS={'model_inventory':handle_inventory,'hardware_profile':handle_hardware,'scaffold':handle_scaffold,'hash_files':handle_hash}
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--id',required=True); ap.add_argument('--role',required=True); ap.add_argument('--cap',action='append',required=True); ap.add_argument('--once',action='store_true')
    a=ap.parse_args(); caps=a.cap; c=init_db(); append_event(c,a.id,'WORKER_STARTED',data={'role':a.role,'capabilities':caps})
    while True:
        heartbeat(c,a.id,a.role,caps,'IDLE')
        task=claim_task(c,a.id,caps,lease_seconds=900)
        if not task:
            if a.once: break
            time.sleep(2); continue
        heartbeat(c,a.id,a.role,caps,'WORKING')
        try:
            payload=json.loads(task['payload']); result=HANDLERS[task['task_type']](payload); finish_task(c,a.id,task['task_id'],result)
        except Exception as e:
            fail_task(c,a.id,task['task_id'],traceback.format_exc())
        if a.once: break
    heartbeat(c,a.id,a.role,caps,'STOPPED')

if __name__=='__main__': main()
