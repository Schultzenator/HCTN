# Work state — Flip the Switch

Updated: 2026-11-04

## Receipt

- [x] Brainstorm Gate completed and recorded in the workspace analysis.
- [x] Track 1 concept selected: Graveyard Foreman.
- [x] Deterministic triage/approval engine implemented.
- [x] Unit tests added for approval, rejection, and incomplete evidence.
- [x] Switch room template added without credentials.
- [x] Screencast-ready chat transcript added.
- [x] Submission kit prepared.
- [x] Project pushed to `Schultzenator/HCTN` (`main`, commit `7916b54`).
- [ ] Live Switch-room screencast URL.
- [ ] WeMakeDevs submission receipt/screenshot.

## Submission status

`READY_KIT / NOT_SUBMITTED`

The local build and public repository are complete. The WeMakeDevs login rejected the stored password; reset mail yielded only an expired token during this run. A live bridge/screencast and the external submission form still require a usable session and public demo URL. This status must change to `SUBMITTED` only after the receipt is captured.

## Verification

Run from this directory:

```bash
python3 foreman.py demo
python3 -m unittest -v
```
