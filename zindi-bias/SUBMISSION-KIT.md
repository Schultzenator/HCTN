# Operator submission kit

Artifact: `zindi-bias/submission/submission.csv`.

This is a 0.5 constant baseline covering 9,379 tracts in the four scored regions. It has local format validation, no measured challenge RMSE, and no trained-model accuracy claim. Exact comparison with the separately hosted official sample remains pending. No submission has been made by this agent.

The [current challenge page](https://zindi.world/competitions/bias-bounty-mapping-equity-challenge) shows **31 October 2026** as the closing date, earlier than the task's “1 Nov”. Check the UI for the exact cutoff time and timezone before relying on it.

1. Sign in to Zindi, open the challenge, and join/accept its current rules if needed. Read the current prohibited-target-reconstruction restriction. The pipeline must not be trained on reference-reconstructed targets or sample placeholder zeros.
2. In the Data tab, download `SampleSubmission.csv` inside your authenticated session to `zindi-bias/data/SampleSubmission.csv`. Anonymous access returned HTTP 401. This step is necessary to verify the exact official format; the agent did not obtain this file.
3. Align existing predictions to the official schema and row order, then validate:

   ```bash
   python3 zindi-bias/scripts/align_official_sample.py zindi-bias/data/SampleSubmission.csv
   python3 zindi-bias/scripts/validate_submission.py \
     --sample zindi-bias/data/SampleSubmission.csv \
     --report zindi-bias/reports/official-submission-validation.json
   ```

   Alignment permits reordered rows or a subset of known columns, and requires the same tract set. If it fails, inspect the differences; do not silently drop tracts or invent IDs. Keep GEOIDs as text if inspecting in a spreadsheet. No rounding or editing is needed.
4. Review `RESULTS.md`. If legitimate organizer labels are available, run the gradient-boosting training command in `README.md` before alignment; then rerun the official validator. Without labels, this CSV remains an unmeasured constant baseline.
5. Use the challenge's Submit control, select the CSV and enter a description such as “Constant 0.5 baseline, four-region public tract templates, no reference reconstruction.” The operator makes the submission; this code does not automate uploads.
6. Wait for processing and inspect the RMSE and bias scorecard. Record the submission ID, timestamp and results in `RESULTS.md`. Check for rejected rows/columns before assuming a successful submission. Current page limits are 10 submissions per day and 300 overall; verify them in the live UI.
7. Before close, select the entries you wish judged under the current competition rules. If pursuing documentation/discovery prizes, follow the methodology form linked on the Info page and identify your username/team and relevant submission IDs.

Rebuild the constant artifact with `python3 zindi-bias/scripts/build_submission.py`; this overwrites any trained or officially aligned CSV. Use `validate_submission.py --sample ...` with the correct sample after rebuilding or training.

No remote push is needed. Code/data attribution and source vintages are in EDA.md and `data/README.md`; downloaded data retains its source licenses.
