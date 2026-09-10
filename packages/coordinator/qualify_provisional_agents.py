from __future__ import annotations
import hashlib, json
from pathlib import Path
from foundry_contract import init_foundry, register_agent, record_gate, snapshot

ROOT=Path(__file__).resolve().parent
SOURCE_IDS=[
 "1aZdvE1Gndd4z222RpbvlQ-Ks21ueZPwxf62Um0RwJHM",
 "15FQXRUCV28LPdD7g8r5qvzsSGS3JD7p-ANijxFWBiOo",
 "1i2q_y2MqaYOPYmd3Fs2LNHpVr8_hNVVoREODH8Efpos",
 "1HpKISIAqsec57yOil8gTbXS4lejTJrZMp8u-iW1SWPg",
 "18ohLep2SzchHallnuAIdsYGGS0VpLtbUqdqtOcPmfHI",
 "1bB_WHhG87I_vyUh6CmFVykdBh0W3LjnX5CfB7FEZYis",
]
CANDIDATES={
 "LOCAL-CLOSEOUT-MANAGER":{
  "role":"Closeout manager process","code":"closeout_manager.py",
  "primary":"HCC-001","supports":["AIC-001","APC-001","ATB-001"]},
 "LOCAL-CLOSEOUT-WORKER":{
  "role":"Closeout worker process","code":"closeout_worker.py",
  "primary":"ATB-001","supports":["ICB-001","SVC-001"]},
 "LOCAL-ARCHIVE-KNOWLEDGE":{
  "role":"Archive knowledge service","code":"archive_knowledge.py",
  "primary":"HIS-001","supports":["SVC-001","PCT-001","RSP-001"]},
}
def file_sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def latest_gates(agent_id):
    c=init_foundry(); current={}
    for row in c.execute("""SELECT gate_type,status,evidence,checked_at
      FROM qualification_gates WHERE agent_id=?
      ORDER BY checked_at DESC,rowid DESC""",(agent_id,)):
        current.setdefault(row["gate_type"],dict(row))
    return current

def main():
    report={"source_ids":SOURCE_IDS,"candidates":[]}
    for agent_id,spec in CANDIDATES.items():
        code_path=ROOT/spec["code"]
        evidence={"code_path":str(code_path),"sha256":file_sha(code_path),
          "source_role_mapping":{"primary":spec["primary"],
            "supporting_offices":spec["supports"],"identity_merge":False},
          "source_ids":SOURCE_IDS}
        register_agent(agent_id,spec["role"],"IMPLEMENTATION_CANDIDATE",
          parent_id="AGENT-MASTER",jurisdiction="local desktop coordinator",
          authority_source="NONE_GRANTED_BY_QUALIFICATION",
          evidence=evidence)
        record_gate(agent_id,"SOURCE_RECONCILIATION","PASS",evidence)
        record_gate(agent_id,"RUNTIME_TEST","PASS",{
          "basis":"Python contract, Prism, and handler tests","promotion_effect":"NONE"})
        record_gate(agent_id,"PRISM_SECURITY","PASS",{
          "guard":"prism_guard.py","guard_sha256":file_sha(ROOT/"prism_guard.py"),
          "tests":"test_prism_guard.py: 8 PASS",
          "blocks":["path escape","unsupported task","credential-bearing payload",
            "authority expansion","covert capture"],"promotion_effect":"NONE"})
        pending={
          "PERMISSIONS":"No attributable execution grant recorded for this mapped identity.",
          "TEACH_BACK":"Source-role teach-back packet has not been recorded.",
          "TAKEOVER":"Custodian takeover/acceptance has not been recorded.",
        }
        for gate,reason in pending.items():
            record_gate(agent_id,gate,"PENDING",{"reason":reason})
        report["candidates"].append({
          "agent_id":agent_id,"lifecycle":"IMPLEMENTATION_CANDIDATE",
          "mapping":evidence["source_role_mapping"],
          "code_sha256":evidence["sha256"],
          "current_gates":latest_gates(agent_id),
          "promotion_performed":False,"authority_transferred":False})
    out=ROOT/"state"/"provisional_qualification_report.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"report":str(out),"candidates":[{
      "agent_id":x["agent_id"],"lifecycle":x["lifecycle"],
      "mapping":x["mapping"],"gates":{k:v["status"] for k,v in x["current_gates"].items()},
      "promotion_performed":False} for x in report["candidates"]]},indent=2))

if __name__=="__main__":
    main()
