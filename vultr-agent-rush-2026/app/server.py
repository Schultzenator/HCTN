"""Small web demo for Containment Foreman."""

from __future__ import annotations

import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

from app.planner import plan
from sandbox.runner import execute_step


def render(result: dict[str, object] | None = None) -> str:
    output = ""
    if result:
        output = f"<h2>Receipt</h2><pre>{html.escape(json.dumps(result, indent=2))}</pre>"
    return """<!doctype html><meta charset=utf-8><title>Containment Foreman</title>
<style>body{font:16px system-ui;max-width:900px;margin:40px auto;background:#101827;color:#e7edf7}textarea{width:100%;height:100px}button{padding:12px 20px;margin-top:10px}pre{background:#172238;padding:16px;overflow:auto}.card{border:1px solid #33415c;border-radius:8px;padding:12px;margin:14px 0}code{color:#9fe3b1}</style>
<h1>Containment Foreman</h1><p>Plan → dispatch → disposable Docker sandbox → verifiable receipt.</p>
<div class=card><b>Worker policy</b>: <code>network=none</code> · <code>memory=512m</code> · <code>cpus=0.5</code> · <code>pids=64</code> · <code>secrets_passed=false</code> · <code>docker --rm</code></div>
<form method=post><textarea name=task placeholder="Analyze the bids CSV and produce a summary">Analyze the bids CSV and produce a summary</textarea><br><button>Run safely</button></form>
""" + output


class Handler(BaseHTTPRequestHandler):
    def _send(self, body: str, code: int = 200) -> None:
        data = body.encode()
        self.send_response(code); self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        self._send(render())

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        task = parse_qs(self.rfile.read(length).decode()).get("task", [""])[0][:4000]
        steps, source = plan(task)
        receipts = [execute_step(step.code, step.timeout_seconds) for step in steps]
        self._send(render({"task": task, "planner": source, "plan": [
            {"id": step.id, "description": step.description, "timeout_seconds": step.timeout_seconds}
            for step in steps
        ], "receipts": receipts}))


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
