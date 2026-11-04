"""Deterministic human-in-the-loop incident triage for the Switch demo."""

from dataclasses import dataclass, field
from enum import Enum
import sys


class State(str, Enum):
    PROPOSED = "PROPOSED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    NEEDS_INFO = "NEEDS_INFO"


@dataclass
class Incident:
    title: str
    service: str
    impact: str
    evidence: str
    reporter: str = "operator"
    severity: str = "P2"
    state: State = State.PROPOSED
    proposal: str = ""
    events: list[str] = field(default_factory=list)


def triage(incident: Incident) -> Incident:
    """Classify and propose a safe, reversible next step."""
    text = f"{incident.title} {incident.impact} {incident.evidence}".lower()
    if not incident.service or not incident.evidence:
        incident.state = State.NEEDS_INFO
        incident.proposal = "Ask for the affected service and one timestamped evidence sample."
    elif any(word in text for word in ("all users", "payment", "data loss", "outage")):
        incident.severity = "P0"
        incident.proposal = f"Freeze new deploys for {incident.service}; page the on-call and inspect the last deploy."
    elif any(word in text for word in ("degraded", "timeout", "elevated", "slow")):
        incident.severity = "P1"
        incident.proposal = f"Open an incident channel for {incident.service} and compare error rate with the last deploy."
    else:
        incident.severity = "P2"
        incident.proposal = f"Create a follow-up ticket for {incident.service} with the supplied evidence."
    incident.events.append(f"Foreman triage: {incident.severity}; proposal: {incident.proposal}")
    return incident


def human_decision(incident: Incident, decision: str) -> str:
    """Apply only an explicit human decision; never execute implicitly."""
    normalized = decision.strip().lower()
    if incident.state == State.NEEDS_INFO:
        return "HOLD: more evidence is required before approval can be requested."
    if normalized == "approve":
        incident.state = State.APPROVED
        receipt = f"ACTION RECEIPT: simulated execution recorded for {incident.service} ({incident.severity})."
        incident.events.append(receipt)
        return receipt
    if normalized == "reject":
        incident.state = State.REJECTED
        incident.events.append("HOLD: human rejected the proposed action; no side effect performed.")
        return incident.events[-1]
    incident.state = State.NEEDS_INFO
    incident.events.append("HOLD: decision must be approve or reject; no side effect performed.")
    return incident.events[-1]


def demo() -> None:
    incidents = [
        Incident("Checkout outage", "payments-api", "all users cannot pay", "2026-11-04T09:42Z, 100% 5xx after deploy 1842"),
        Incident("Cache timeout", "catalog-api", "degraded and slow", "2026-11-04T09:48Z, p95 4.2s"),
        Incident("Unknown alert", "", "something looks wrong", ""),
    ]
    for incident, decision in zip(incidents, ("approve", "reject", "approve")):
        print(f"HUMAN  {incident.title}: {incident.impact}. Evidence: {incident.evidence or '(missing)'}")
        triage(incident)
        print(f"AGENT  {incident.severity} — {incident.proposal}")
        print(f"HUMAN  {decision}")
        print(f"AGENT  {human_decision(incident, decision)}")
        print(f"STATE  {incident.state}\n")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] != "demo":
        raise SystemExit("usage: python3 foreman.py demo")
    demo()
