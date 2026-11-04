import os
import tempfile
import unittest

from sandbox.runner import run_python


class ContainmentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_image = os.environ.get("FOREMAN_SANDBOX_IMAGE")
        os.environ["FOREMAN_SANDBOX_IMAGE"] = "python:3.11-slim"

    @classmethod
    def tearDownClass(cls):
        if cls.previous_image is None:
            os.environ.pop("FOREMAN_SANDBOX_IMAGE", None)
        else:
            os.environ["FOREMAN_SANDBOX_IMAGE"] = cls.previous_image

    def test_destructive_code_is_rejected_before_dispatch(self):
        receipt = run_python("import os; os.system('rm -rf /')")
        self.assertEqual(receipt.status, "rejected_by_policy")
        self.assertFalse(receipt.policy["secrets_passed"])

    def test_worker_cannot_reach_a_host_path(self):
        # A host path is intentionally not mounted into the worker.  The worker
        # may write only to its disposable /workspace mount.
        with tempfile.TemporaryDirectory() as host_dir:
            sentinel = os.path.join(host_dir, "sentinel")
            with open(sentinel, "w", encoding="utf-8") as handle:
                handle.write("host-safe")
            code = (
                "from pathlib import Path\n"
                f"p = Path({sentinel!r})\n"
                "print('visible' if p.exists() else 'not-visible')\n"
                "if p.exists(): p.write_text('modified')\n"
            )
            receipt = run_python(code)
            self.assertEqual(receipt.status, "completed")
            with open(sentinel, encoding="utf-8") as handle:
                self.assertEqual(handle.read(), "host-safe")

    def test_worker_does_not_receive_host_secrets(self):
        receipt = run_python(
            "import os\n"
            "open('/workspace/env.txt', 'w').write(os.getenv('LLM_API_KEY', 'missing'))"
        )
        self.assertEqual(receipt.status, "completed")
        self.assertEqual(receipt.artifact_details[0]["size"], len("missing"))

    def test_timeout_is_enforced(self):
        receipt = run_python("import time; time.sleep(10)", timeout_seconds=1)
        self.assertEqual(receipt.status, "timeout")

    def test_timeout_cap_cannot_be_bypassed(self):
        receipt = run_python("print('x')", timeout_seconds=61)
        self.assertEqual(receipt.status, "rejected_by_policy")

    def test_no_network_inside_sandbox(self):
        code = "import socket\ns=socket.socket(); s.settimeout(1); s.connect(('1.1.1.1', 80))"
        receipt = run_python(code)
        self.assertEqual(receipt.status, "failed")
        self.assertEqual(receipt.policy["network"], "none")

    def test_artifact_is_reported_and_host_is_not_mounted(self):
        receipt = run_python("open('/workspace/result.txt', 'w').write('inside')")
        self.assertEqual(receipt.status, "completed")
        self.assertEqual(receipt.artifacts, ["result.txt"])
        self.assertEqual(receipt.artifact_details[0]["name"], "result.txt")
        self.assertFalse(receipt.artifact_details[0]["truncated"])


if __name__ == "__main__":
    unittest.main()
