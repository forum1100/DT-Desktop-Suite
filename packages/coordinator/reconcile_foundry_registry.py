from foundry_contract import register_agent, record_gate, snapshot

SOURCE_IDS = [
 "1aZdvE1Gndd4z222RpbvlQ-Ks21ueZPwxf62Um0RwJHM",
 "15FQXRUCV28LPdD7g8r5qvzsSGS3JD7p-ANijxFWBiOo",
 "1i2q_y2MqaYOPYmd3Fs2LNHpVr8_hNVVoREODH8Efpos",
 "1HpKISIAqsec57yOil8gTbXS4lejTJrZMp8u-iW1SWPg",
 "18ohLep2SzchHallnuAIdsYGGS0VpLtbUqdqtOcPmfHI",
 "1bB_WHhG87I_vyUh6CmFVykdBh0W3LjnX5CfB7FEZYis",
]
ROLES = {
 "CMA-001":"Context and Memory Architecture",
 "PIR-001":"Perception and Interaction Recorder",
 "HIS-001":"Historical Integrity Steward",
 "APC-001":"Authority and Permissions Custodian",
 "ICB-001":"Ingestion and Context Bootstrap",
 "SAA-001":"Safety and Alignment Auditor",
 "CCA-001":"Contradiction and Conflict Analyst",
 "RSP-001":"Residual and Supersession Preserver",
 "PSC-001":"Prism Security Custodian",
 "HCC-001":"Handoff and Custody Coordinator",
 "SVC-001":"Source Verification Custodian",
 "PCT-001":"Provenance and Causal Topology",
 "ATB-001":"Agent Tool and Dependency",
}
def main():
    evidence={"drive_source_ids":SOURCE_IDS,
              "reconciliation":"2026-09-09 source readback"}
    register_agent("AGENT-MASTER","Agent Master / Foundry",
      "DORMANT_SPEC",jurisdiction="constitutional architecture",
      blueprint_version="v0.1",evidence=evidence)
    register_agent("AIC-001","Agent Initiation Coordinator",
      "DORMANT_SPEC",parent_id="AGENT-MASTER",
      jurisdiction="initiation legitimacy",evidence=evidence)
    register_agent("AFM-001","Top-tier Agent Maker",
      "DORMANT_SPEC",parent_id="AGENT-MASTER",
      jurisdiction="bounded dormant agent construction",
      blueprint_version="v1.0",evidence=evidence)
    for aid, role in ROLES.items():
        register_agent(aid,role,"SPECIFIED_ONLY",
          parent_id="AGENT-MASTER",evidence=evidence)
    for aid, role in {
      "LOCAL-CLOSEOUT-MANAGER":"Closeout manager process",
      "LOCAL-CLOSEOUT-WORKER":"Closeout worker process",
      "LOCAL-ARCHIVE-KNOWLEDGE":"Archive knowledge service",
    }.items():
        register_agent(aid,role,"IMPLEMENTATION_CANDIDATE",
          parent_id="AGENT-MASTER",
          jurisdiction="local desktop coordinator",
          evidence={"code_path":__file__,"foundry_mapping":"PENDING"})
        record_gate(aid,"SOURCE_RECONCILIATION","PENDING",
          {"reason":"role mapping and qualification incomplete"})
    state=snapshot()
    print("Foundry registry reconciled:",len(state["agents"]),"identities")
    for row in state["agents"]:
        print(row["agent_id"],row["lifecycle"],row["role"])

if __name__=="__main__":
    main()
