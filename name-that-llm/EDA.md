# EDA — Name That LLM

Run: 2026-10-22. Source: authenticated Kaggle CLI download for `name-that-llm` (account `piotrszutt`). No synthetic data.

Train: **2,699 rows**, **18 model classes**, columns `id,prompt_id,text,model`. Test: **3 rows**, columns `id,text`. Official template: `sample_submission.parquet` (the archive does not contain a sample CSV). A CSV copy was derived with pandas, preserving all values and row order; it has columns `id,model` and 3 rows (top-1).

## Class balance

| Model | Rows | Share |
|---|---:|---:|
| claude-fable-5 | 149 | 5.521% |
| claude-opus-4-6 | 150 | 5.558% |
| claude-opus-4-8 | 150 | 5.558% |
| claude-opus-5 | 150 | 5.558% |
| claude-sonnet-5 | 150 | 5.558% |
| gemini-3.1-pro-preview | 150 | 5.558% |
| gemini-3.6-flash | 150 | 5.558% |
| gemini-3.7-flash | 150 | 5.558% |
| gemini-3.8-flash | 150 | 5.558% |
| glm-5.3 | 150 | 5.558% |
| glm-5.3-flash | 150 | 5.558% |
| gpt-5.5 | 150 | 5.558% |
| gpt-5.6-luna | 150 | 5.558% |
| gpt-5.6-sol | 150 | 5.558% |
| gpt-5.6-terra | 150 | 5.558% |
| gpt-6-astra | 150 | 5.558% |
| kimi-k3 | 150 | 5.558% |
| qwen3.8-max | 150 | 5.558% |

Max/min class count: 1.006711.

## Text lengths

Words are whitespace-separated tokens; characters use Python Unicode string length. Standard deviation uses the sample denominator (n−1).

| Measure | Mean | Std | Min | P25 | Median | P75 | Max |
|---|---:|---:|---:|---:|---:|---:|---:|
| Words | 114.660 | 58.281 | 36 | 64.000 | 101.000 | 157.000 | 274 |
| Characters | 755.289 | 377.371 | 230 | 429.000 | 670.000 | 1027.000 | 1900 |

## Data quality and validation limits

- Missing/empty fields: 0. Empty train texts: 0.
- Duplicate train IDs: 0. Duplicate stripped texts: 0.
- Distinct prompt IDs: 150; most prompts occur across all 18 classes.
- Baseline CV is 5-fold stratified by class, shuffled with seed 42. Vocabulary and IDF are fitted only on each training fold. Shared prompts can occur in training and validation; this does not estimate generalization to unseen prompts. Hyperparameter selection uses the same CV, so the selected score is not an independent holdout estimate.
- Only 3 public test rows are supplied. The generated CSV covers that supplied test/template; private or notebook evaluation behavior has not been verified.

## Input fingerprints (SHA-256)

- `train.csv`: `40a22ce8d88c5f46feb4637a099db815bef5f713ffe53e89dbe1b7b21de77707`
- `test.csv`: `4545aa3a3459f4c0724f97ad5bd06c4caa3506bdfea5fab905e8203184fc0c57`
- `sample_submission.parquet`: `ccf86796b80fd7f83d8463664603fd1208e17559abcf416f198776b819646188`
- `name-that-llm.zip`: `7c375db7dfeea6b36cefc7b48a290dd48c54c7fe03bfd402390728a6a2bb9386`

The existing `scripts/01_eda.py --data-dir data` also completed on these real files; its detailed style/length tables are in ignored `outputs/eda/`.

Verification rerun on 2026-10-22: forced authenticated CLI download succeeded; all four input hashes above matched. `01_eda.py` completed again with the same row count, class balance, and text-length statistics.
