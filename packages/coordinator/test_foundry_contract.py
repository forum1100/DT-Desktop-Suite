from pathlib import Path
import tempfile
import coordinator_core as core
import foundry_contract as fc

def run():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        core.DB=Path(td)/"test.db"
        fc.register_agent("AFM-001","Agent Foundry","DORMANT_SPEC",
          parent_id="AGENT-MASTER",jurisdiction="agent legitimacy")
        fc.register_agent("TEST-CHILD","Test Child","IMPLEMENTATION_CANDIDATE",
          parent_id="AFM-001",jurisdiction="tests")
        down={k:"x" for k in fc.REQUIRED_DOWN}
        down.update(parent_id="AFM-001",child_id="TEST-CHILD",branch="b1",
                    allowed_sources=[],rules=[],constraints=[],
                    contradictions=[],validation=[],return_format={})
        assert fc.create_packet("DOWNWARD_TASK",down)
        fc.record_gate("TEST-CHILD","SOURCE_RECONCILIATION","PASS")
        fc.record_gate("TEST-CHILD","PERMISSIONS","PASS")
        fc.record_gate("TEST-CHILD","PRISM_SECURITY","PASS")
        fc.record_gate("TEST-CHILD","TEACH_BACK","PASS")
        fc.record_gate("TEST-CHILD","TAKEOVER","PASS")
        fc.record_gate("TEST-CHILD","RUNTIME_TEST","PASS")
        fc.promote_agent("TEST-CHILD","IMPLEMENTED_UNVALIDATED")
        fc.promote_agent("TEST-CHILD","VALIDATED")
        fc.promote_agent("TEST-CHILD","RUNNING")
        snap=fc.snapshot()
        states={x["agent_id"]:x["lifecycle"] for x in snap["agents"]}
        assert states["AFM-001"]=="DORMANT_SPEC"
        assert states["TEST-CHILD"]=="RUNNING"
        print("foundry contract tests: PASS")

if __name__=="__main__":
    run()
