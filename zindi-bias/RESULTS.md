# Results

**Real-target five-fold RMSE: unavailable. No supervised model has been fitted to the challenge target.** The public package has features and sample placeholders, but no training labels. The current rules prohibit recreating targets from removed reference data. See `reports/data-audit.json` and `data/inventory.json` for the audit.

| Deliverable | Outcome |
|---|---|
| Public download route | Anonymous HTTPS, S3-compatible listing on `data.source.coop` |
| Joined features | All four scored regions downloaded locally |
| Small-region reference | Northern California ACS housing, Overture POIs and infrastructure downloaded locally |
| Schema/EDA | `EDA.md`, full Arrow schema, missingness and numeric summaries |
| Five-fold gradient-boosting pipeline | Implemented; legitimate labels required to run real-target evaluation |
| Challenge-target RMSE | **Unknown**, no fabricated or proxy metric |
| Submission | 9,379 rows; all score columns set to 0.5 |
| Local CSV validation | PASS against the four public regional templates combined |
| Exact separate Zindi sample verification | **Pending**: anonymous endpoint returned HTTP 401 |
| Training machinery check | Synthetic-only five-fold run and deterministic refit; see `reports/pipeline-check.json` |
| Submission/push | Neither performed |

The CSV has these columns in the public regional sample order:

```csv
GEOID,transport_gap,building_gap,poi_gap,coverage_gap_score
```

Region counts: Northern California 591; Eastern Oklahoma 1,192; Maricopa 1,593; South-Central Texas 6,003. IDs retain all 11 digits, including leading zeros. No missing, duplicate or extra IDs relative to those templates. Optional component columns are populated because the current instructions reject blanks in any included column.

This is a conservative, label-free starting artifact with unknown predictive quality. Format validation does not establish acceptance by Zindi, official-sample equivalence, model accuracy, or equity performance. Bias scorecard results are available only after an operator submits. No leaderboard or scorecard results are claimed.

To finish the original modeling objective, obtain legitimate organizer-provided labels, run the training command in README.md, and inspect the resulting target CV. To verify exact official format, download the official sample in the operator's authenticated Zindi session and use the alignment/validation commands in SUBMISSION-KIT.md.
## Submission 1 - 2026-10-22 (operator PW, Zindi UI)

- Zindi submission ID: **HtHKqjqx**, submitter piotrszutt, ~21:40 UTC 2026-10-22.
- **Public score (RMSE): 0.449105407**
- File: submission/submission.csv v2 = OFFICIAL 17-column schema (9,794 rows, 5 regions), constant 0.5 in all predicted gap columns; region and *_defined flags copied from official SampleSubmission.csv.
- Comment on Zindi: Constant 0.5 baseline, five-region official sample template, no reference reconstruction.
- Official SampleSubmission.csv downloaded in authenticated session (919,898 B, 9,794 rows; regions: south-central-tx 6003, maricopa-az 1593, eastern-ok 1192, northern-ca 591, eastern-wa 415).
- v1 4-region 5-column CSV kept as submission/submission-constant-4reg-v1.csv (DOES NOT match official schema).
- Limits: 5 submissions/day, 200 total. Next: iteration 2, beat the leaderboard leader (GBM on strata features, region-aware).
