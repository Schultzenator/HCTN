# Work state

Status: COMPLETE

Completion scope: the reproducible public-data audit and operator handoff are complete. **The original end-to-end supervised modeling goal is only partially achieved:** real-target training/CV and exact verification against the separate Zindi-hosted sample remain blocked. This status does not claim those missing milestones were achieved.

Completed on 2026-10-22:

- Discovered the anonymous HTTPS/S3 listing and download route; inventoried all 327 public objects.
- Downloaded four joined strata tables and all four scored regional sample files, plus Northern California ACS housing, Overture POIs and infrastructure. Downloaded files total 24,400,796 bytes; hashes verified.
- Inspected the README layer dictionary and actual Arrow schemas; produced EDA, per-column schemas, missingness and numeric summaries. No separately named dictionary is present in the current public listing.
- Implemented numeric tract gradient boosting with fold-local imputation, five-fold out-of-fold RMSE reporting, and model/submission output when legitimate labels are supplied.
- Produced a constant 0.5 submission covering 9,379 scored tracts in the exact public regional-template schema. Local validator passed.
- Verified training machinery with synthetic data, deterministic fitting, real feature loading, rejection of placeholder training labels, and rejection of nine malformed submission cases. Synthetic results are not challenge accuracy.
- Wrote operator submission instructions and recorded the current 31 October 2026 deadline.
- Prepared all deliverables under `zindi-bias/`. The workspace `.git` is read-only: `git add zindi-bias/` failed with an index.lock error. A separate local Git store and incremental commit bundle are used to preserve a reviewable commit with the original HEAD as parent. The workspace branch is unchanged. Nothing was pushed or submitted to Zindi.

Blocked / not claimed:

1. No legitimate organizer-provided training targets are present in the public package. All sample score cells are placeholder zeros. Real-target five-fold CV RMSE is null, and no supervised model is claimed. Current rules prohibit reconstructing removed reference targets; no such reconstruction was attempted. The outstanding clarification asks whether the operator has legitimate labels.
2. The separately hosted official `SampleSubmission.csv` requires an authenticated Zindi session (anonymous request returned HTTP 401). Agreement with that exact file is unverified. The CSV has been validated against the concatenated public regional samples only. Operator commands to align and validate against the authenticated download are in `SUBMISSION-KIT.md`.

3. The original workspace commit cannot be installed while `.git` is read-only. `local-commit.bundle` and the ignored `local-history/` Git store preserve the local commit. See README.md for verification/import instructions.

Continuation:

- If legitimate training labels are available, use the `train_baseline.py` command in README.md. Never train on the regional sample placeholders or reconstruct prohibited scores.
- Download the official sample through the operator's session, align predictions and rerun the validator before submitting.
- The operator alone performs any upload. No push or submission is authorized or needed here.

Evidence: `reports/data-audit.json`, `reports/cv-results.json`, `reports/pipeline-check.json`, `reports/submission-validation.json`, and `data/download-manifest.json`.

Reverification on 2026-10-22: refreshed the anonymous object inventory; reran the data audit, submission validator and synthetic pipeline checks successfully; independently matched all 12 download SHA-256 hashes. Both official sample URL variants (with and without the null auth query) returned HTTP 401. Browser inventory has no connected sessions. No new legitimate labels were found. See `reports/reverification.json`.
