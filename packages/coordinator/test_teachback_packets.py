from __future__ import annotations
import unittest
from teachback_packets import SPECS, packet, validate

class TeachBackTests(unittest.TestCase):
    def test_every_candidate_teaches_back_required_boundaries(self):
        for agent_id in SPECS:
            with self.subTest(agent_id=agent_id):
                body = packet(agent_id)
                result = validate(body)
                self.assertTrue(result["valid"], result["errors"])
                self.assertEqual(body["child_id"], agent_id)
                self.assertIn("No self-promotion", body["authority_boundary"])
                self.assertIn("Stop on Prism rejection", body["failure_policy"])

    def test_incomplete_packet_fails(self):
        body = packet("LOCAL-CLOSEOUT-WORKER")
        del body["authority_boundary"]
        result = validate(body)
        self.assertFalse(result["valid"])
        self.assertTrue(any(x.startswith("MISSING:") for x in result["errors"]))

if __name__ == "__main__":
    unittest.main()
