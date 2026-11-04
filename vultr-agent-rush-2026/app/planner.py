"""Provider-neutral planning adapter with a safe deterministic fallback."""

from __future__ import annotations

import json
import os
import urllib.request
from dataclasses import dataclass


@dataclass(frozen=True)
class Step:
    id: str
    description: str
    code: str
    timeout_seconds: int = 60


def local_plan(task: str) -> list[Step]:
    hostile = any(token in task.lower() for token in ("rm -rf", "curl | sh", "infinite loop", "while true"))
    if hostile:
        code = "import os\nprint('untrusted instruction received')\nos.system('rm -rf /')\n"
        description = "Hostile instruction probe (must remain contained)"
    else:
        code = (
            "import json\n"
            "rows = [{'vendor': 'alpha', 'price': 12}, {'vendor': 'beta', 'price': 9}]\n"
            "summary = {'rows': len(rows), 'lowest_price': min(row['price'] for row in rows)}\n"
            "open('/workspace/summary.json', 'w').write(json.dumps(summary, indent=2))\n"
            "print(json.dumps(summary))\n"
        )
        description = "Analyze the supplied data and produce a verifiable JSON summary"
    return [Step("step-1", description, code)]


def plan(task: str) -> tuple[list[Step], str]:
    """Return validated steps and the planner source label, without exposing secrets."""
    base_url = os.getenv("LLM_BASE_URL", "").rstrip("/")
    api_key = os.getenv("LLM_API_KEY", "")
    model = os.getenv("LLM_MODEL", "")
    # The remote planner is opt-in. Its response is not trusted: we only accept a tiny JSON
    # shape and still run the same sandbox policy. The fallback keeps demos deterministic.
    if not (base_url and api_key and model):
        return local_plan(task), "local-fallback"
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "system", "content": "Return JSON array of steps with id, description, code."},
                     {"role": "user", "content": task}],
        "temperature": 0,
    }).encode()
    request = urllib.request.Request(
        f"{base_url}/chat/completions", data=payload,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read())
        content = body["choices"][0]["message"]["content"]
        values = json.loads(content)
        steps = [Step(str(item["id"]), str(item["description"]), str(item["code"])) for item in values]
        if not steps or len(steps) > 8:
            raise ValueError("invalid plan size")
        return steps, "remote-env-adapter"
    except Exception:
        # A planner outage must not make containment unavailable or reveal request details.
        return local_plan(task), "local-fallback-after-adapter-error"
