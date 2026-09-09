from __future__ import annotations
import json, time, ctypes
from pathlib import Path
from datetime import datetime
from coordinator_core import init_db, STATE, utcnow

OUT=STATE/"operations_snapshot.json"
PROCESS_QUERY_LIMITED_INFORMATION=0x1000

def alive(pid):
    handle=ctypes.windll.kernel32.OpenProcess(
      PROCESS_QUERY_LIMITED_INFORMATION,False,int(pid or 0))
    if not handle: return False
    ctypes.windll.kernel32.CloseHandle(handle)
    return True

def seconds_since(value):
    try:
        return max(0,(datetime.fromisoformat(utcnow())-
          datetime.fromisoformat(value)).total_seconds())
    except Exception: return 0

def snapshot():
    c=init_db(); workers=[]
    for row in c.execute("SELECT * FROM workers ORDER BY worker_id"):
        item=dict(row); item["alive"]=alive(item["pid"])
        start=c.execute("""SELECT ts FROM events WHERE worker_id=? AND
          event_type IN ('WORKER_STARTED','CLOSEOUT_WORKER_STARTED')
          ORDER BY rowid ASC LIMIT 1""",(item["worker_id"],)).fetchone()
        item["uptime_seconds"]=seconds_since(start[0]) if start else None
        item["heartbeat_age_seconds"]=seconds_since(item["last_heartbeat"])
        item["task_count"]=c.execute(
          "SELECT COUNT(*) FROM tasks WHERE claimed_by=?",(item["worker_id"],)
        ).fetchone()[0]
        workers.append(item)
    tasks={row[0]:row[1] for row in c.execute(
      "SELECT status,COUNT(*) FROM tasks GROUP BY status")}
    return {"generated_at":utcnow(),"workers":workers,"tasks":tasks,
      "scientific_status":"OBSERVED_LOCAL_COORDINATOR_STATE"}

def main():
    while True:
        temp=OUT.with_suffix(".tmp")
        temp.write_text(json.dumps(snapshot(),indent=2),encoding="utf-8")
        temp.replace(OUT); time.sleep(2)

if __name__=="__main__": main()
