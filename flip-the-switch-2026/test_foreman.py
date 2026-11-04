import unittest

from foreman import Incident, State, human_decision, triage


class ForemanTests(unittest.TestCase):
    def test_p0_requires_explicit_approval(self):
        incident = triage(Incident("Checkout outage", "payments-api", "all users blocked", "5xx spike"))
        self.assertEqual(incident.severity, "P0")
        self.assertEqual(incident.state, State.PROPOSED)
        self.assertIn("ACTION RECEIPT", human_decision(incident, "approve"))
        self.assertEqual(incident.state, State.APPROVED)

    def test_reject_has_no_receipt(self):
        incident = triage(Incident("Slow search", "search-api", "degraded", "p95 2s"))
        message = human_decision(incident, "reject")
        self.assertNotIn("ACTION RECEIPT", message)
        self.assertEqual(incident.state, State.REJECTED)

    def test_missing_evidence_holds(self):
        incident = triage(Incident("Unknown", "", "unknown", ""))
        self.assertEqual(incident.state, State.NEEDS_INFO)
        self.assertIn("HOLD", human_decision(incident, "approve"))


if __name__ == "__main__":
    unittest.main()
