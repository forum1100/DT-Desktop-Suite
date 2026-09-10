from __future__ import annotations
import tempfile
import unittest
from pathlib import Path
import coordinator_core as core
import foundry_contract as fc
import accept_closeout_roles as acceptance

class AcceptanceTests(unittest.TestCase):
    def test_wrong_owner_or_acknowledgment_fails(self):
        packet = acceptance.acceptance_packet(
            acceptance.OWNER, "someone-else", "yes")
        result = acceptance.validate(packet)
        self.assertFalse(result["valid"])
        self.assertIn("OWNER_IDENTITY_NOT_VERIFIED", result["errors"])
        self.assertIn("EXACT_ACKNOWLEDGMENT_REQUIRED", result["errors"])

    def test_bounded_acceptance_grants_no_execution_or_promotion(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
            core.DB = Path(td) / "acceptance.db"
            for agent_id in acceptance.ROLE_GRANTS:
                fc.register_agent(agent_id, "test", "IMPLEMENTATION_CANDIDATE")
            packet = acceptance.acceptance_packet(
                acceptance.OWNER, acceptance.OWNER, acceptance.ACK)
            result = acceptance.apply(packet)
            self.assertTrue(result["accepted"])
            self.assertFalse(result["promotion_performed"])
            self.assertFalse(result["process_started"])
            snapshot = fc.snapshot()
            self.assertEqual(len(snapshot["active_grants"]), 3)
            self.assertTrue(all(row["subdelegation"] == 0
                                for row in snapshot["active_grants"]))

if __name__ == "__main__":
    unittest.main()
