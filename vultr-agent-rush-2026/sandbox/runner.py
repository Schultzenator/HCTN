"""Docker runner with explicit containment controls and auditable receipts."""

from __future__ import annotations

import hashlib
import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
from dataclasses import asdict, dataclass
from pathlib import Path


DENY_PATTERNS = (
    r"rm\s+-rf", r"curl\s+[^\n|]*\|\s*(?:sh|bash)", r"wget\s+[^\n|]*\|\s*(?:sh|bash)",
    r"while\s+true", r"fork\s*\(", r"os\.system\s*\(",
)


@dataclass
class Receipt:
    status: str
    exit_code: int | None
    duration_ms: int
    stdout_sha256: str
    stderr_sha256: str
    artifacts: list[str]
    artifact_details: list[dict[str, object]]
    policy: dict[str, object]
    rejection_reason: str | None = None

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _unsafe(code: str) -> str | None:
    for pattern in DENY_PATTERNS:
        if re.search(pattern, code, flags=re.IGNORECASE):
            return f"policy pattern matched: {pattern}"
    return None


def run_python(code: str, timeout_seconds: int = 60) -> Receipt:
    policy = {
        "network": "none", "memory": "512m", "cpus": 0.5, "pids_limit": 64,
        "read_only_root": True, "secrets_passed": False, "lifecycle": "docker --rm",
    }
    reason = _unsafe(code)
    if reason:
        return Receipt("rejected_by_policy", None, 0, _digest(b""), _digest(reason.encode()), [], [], policy, reason)
    if timeout_seconds < 1 or timeout_seconds > 60:
        return Receipt("rejected_by_policy", None, 0, _digest(b""), _digest(b"timeout limit"), [], [], policy,
                       "timeout must be between 1 and 60 seconds")
    if shutil.which("docker") is None:
        return Receipt("runner_unavailable", None, 0, _digest(b""), _digest(b"docker missing"), [], [], policy, "docker not found")
    with tempfile.TemporaryDirectory(prefix="foreman-run-") as staging:
        workspace = Path(staging) / "workspace"
        workspace.mkdir()
        # The worker is deliberately unprivileged.  The bind mount is only the
        # per-run staging directory and is writable by the numeric worker UID.
        workspace.chmod(0o777)
        (workspace / "main.py").write_text(code, encoding="utf-8")
        started = time.monotonic()
        container_name = f"foreman-step-{uuid.uuid4().hex[:12]}"
        command = [
            "docker", "run", "--rm", "--init", "--name", container_name, "--network=none",
            "--memory=512m", "--cpus=0.5", "--pids-limit=64", "--cap-drop=ALL",
            "--security-opt=no-new-privileges", "--ulimit", "nofile=256:256", "--read-only",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m", "--user", "65534:65534",
            "-v", f"{workspace}:/workspace:rw", "--env", "PYTHONDONTWRITEBYTECODE=1",
            os.getenv("FOREMAN_SANDBOX_IMAGE", "python:3.12-slim"), "python", "/workspace/main.py",
        ]
        try:
            completed = subprocess.run(command, capture_output=True, timeout=timeout_seconds, check=False)
            status = "completed" if completed.returncode == 0 else "failed"
            exit_code = completed.returncode
        except subprocess.TimeoutExpired as error:
            stdout = error.stdout or b""
            stderr = error.stderr or b""
            # Killing the client does not reliably kill a detached Docker child. Explicitly
            # remove the named worker so a timeout cannot leave a process behind.
            subprocess.run(["docker", "rm", "-f", container_name], capture_output=True, timeout=5, check=False)
            return Receipt("timeout", None, int((time.monotonic() - started) * 1000), _digest(stdout), _digest(stderr), [], [], policy)
        duration_ms = int((time.monotonic() - started) * 1000)
        artifacts = sorted(path.name for path in workspace.iterdir() if path.name != "main.py")
        details = []
        for name in artifacts:
            path = workspace / name
            if path.is_file():
                data = path.read_bytes()
                details.append({
                    "name": name,
                    "size": len(data),
                    "sha256": _digest(data),
                    # Keep receipts portable while bounding untrusted output.
                    "content_base64": base64.b64encode(data[:65536]).decode("ascii"),
                    "truncated": len(data) > 65536,
                })
        return Receipt(status, exit_code, duration_ms, _digest(completed.stdout), _digest(completed.stderr), artifacts, details, policy)


def execute_step(code: str, timeout_seconds: int = 60) -> dict[str, object]:
    return run_python(code, timeout_seconds).to_dict()
