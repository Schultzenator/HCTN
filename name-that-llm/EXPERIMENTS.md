# EXPERIMENTS — Name That LLM

Log eksperymentow: data (w naglowku sekcji), opis, parametry, wynik CV.
Wpisy dopisywane automatycznie przez skrypty (`scripts/common.py: log_experiment`).

---

**Historical state before this run:** previous sessions could not execute Python or download data; they produced no measured metrics. The real-data runs below supersede that blocker.

## Iteration 2 — real competition data (2026-10-22)

- Download succeeded with the already-installed Kaggle CLI 2.2.4: `kaggle competitions download -c name-that-llm --path name-that-llm/data/`; archive unpacked with `unzip -o`. No CLI installation or kagglehub fallback was needed.
- Template conversion: `.venv/bin/python -c "import pandas as pd; pd.read_parquet('data/sample_submission.parquet').to_csv('data/sample_submission.csv', index=False)"` from the project directory. Verified `id,model`, 3 rows; original Parquet retained.
- Raw data: 2,699 training rows, 18 classes, 3 test rows; template is `sample_submission.parquet`. Input SHA-256 hashes and EDA are in `EDA.md`.
- Runtime: local `.venv`; dependency versions recorded in `runtime-requirements.txt`. No synthetic data is used.
- Baseline: original char(1–5)+word(1–2) TF-IDF plus logistic regression, C grid 0.5/1/2/4, five class-stratified shuffled folds, seed 42. C selected by mean CV accuracy. Features fit within folds. Selected OOF predictions are reused rather than refitting identical folds.
- Repairs before execution: convert class labels to NumPy for array indexing; remove the obsolete logistic-regression `n_jobs` argument; record log-loss, fold scores, seed, and grid scores in model metadata.
- CV limits: prompts repeat across folds; C selection and reporting use the same folds. No independent holdout, grouped-prompt CV, or Kaggle leaderboard score is claimed.
## 2026-10-22 17:41 UTC — EDA
- N=2699, klas=18, duplikaty=0
- dlugosc slow: mean=114.7, p50=101
- top rozrozniajace cechy stylometryczne: n_chars, func_of, n_words, func_the, func_and


## Reproduction commands

Run from `name-that-llm/` after data download and template conversion:

```bash
.venv/bin/python scripts/01_eda.py --data-dir data
OPENBLAS_NUM_THREADS=2 OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 .venv/bin/python -u scripts/02_baseline_tfidf.py --data-dir data --model lr --c-grid 0.5,1,2,4 --folds 5 --seed 42
.venv/bin/python scripts/04_make_submission.py --data-dir data --inputs outputs/artifacts/b1_lr_test_proba.csv --output submission/submission.csv
.venv/bin/python scripts/05_validate_submission.py --data-dir data submission/submission.csv
```
## 2026-10-22 17:45 UTC — B1 tfidf+lr
- OOF logloss=2.646508
- CV acc=0.1037 +/- 0.0100, macro-F1=0.1037
- parametry: char(1,5)+word(1,2) min_df=2 sublinear, C=4.0, 5-fold CV
- top mylone pary: gemini-3.8-flash -> gemini-3.7-flash: 70; gemini-3.7-flash -> gemini-3.8-flash: 65; gemini-3.6-flash -> gemini-3.7-flash: 56; gemini-3.7-flash -> gemini-3.6-flash: 50; gpt-5.6-luna -> gpt-5.6-sol: 43


## Iteration 2 measured CV summary

| C | Mean fold accuracy | Fold accuracy std | Mean macro-F1 | Pooled OOF logloss |
|---|---:|---:|---:|---:|
| 0.5 | 0.09706796 | 0.01527009 | 0.08724802 | 2.75496273 |
| 1.0 | 0.09596028 | 0.01148963 | 0.09095625 | 2.70209755 |
| 2.0 | 0.10077647 | 0.00780174 | 0.09964057 | 2.66477399 |
| 4.0 | 0.10374012 | 0.00998688 | 0.10369944 | 2.64650844 |

Selected **C=4.0** by mean fold accuracy. Pooled OOF accuracy: **0.10374213**; pooled OOF logloss: **2.64650844**. No Kaggle submission or leaderboard metric.

| Fold | Accuracy | Logloss |
|---|---:|---:|
| 1 | 0.11666667 | 2.63292896 |
| 2 | 0.11481481 | 2.61365227 |
| 3 | 0.09259259 | 2.65658038 |
| 4 | 0.09629630 | 2.66809873 |
| 5 | 0.09833024 | 2.66130927 |

- The script ran to completion (exit 0); no convergence warnings in the run log. Full logs: ignored `outputs/baseline_iter2.log`; fitted pipeline, OOF predictions, test probabilities, and metadata: ignored `outputs/artifacts/b1_lr_*`.
- Generated `submission/submission.csv` with script 04; script 05 returned `WALIDACJA OK` (exit 0). Additional checks matched columns, ID values/order, and row count directly against the original Parquet template; all OOF/test probabilities are finite, nonnegative, and sum to one.
- Submission SHA-256: `af8cc2aba8a76fa59cd33f945e84fca158104b1d1220985da9cca6b5d0e5b22d`.
- Public test/template has only 3 rows. CSV validity is local; final Kaggle website submission is assigned to PW.
## 2026-10-22 17:47 UTC — EDA
- N=2699, klas=18, duplikaty=0
- dlugosc slow: mean=114.7, p50=101
- top rozrozniajace cechy stylometryczne: n_chars, func_of, n_words, func_the, func_and

