# Experiment log

Date: 2026-10-22. Seed: 20261022. Open-source Python, pandas, NumPy, PyArrow and scikit-learn; no paid runtime services or AutoML.

| ID | Data and method | Validation | Result |
|---|---|---|---|
| E00 | Public inventory and four region samples | Full object listing; sample columns checked | No public training labels; sample scores are all zero placeholders |
| E01 | Constant 0.5 for all score columns | Format validation against concatenated regional samples | PASS, 9,379 rows; target RMSE unknown |
| E02 | HistGradientBoostingRegressor on numeric tract strata | Intended shuffled 5-fold KFold, seed 20261022 | BLOCKED: no legitimate organizer-provided labels; no target RMSE reported |
| CHECK | Synthetic regression function, 300 rows, 6 variables and injected missing values | Five folds, deterministic refit, invalid-CSV rejection | See `reports/pipeline-check.json`; software execution check only |

E01 chooses the midpoint of the allowed target interval without estimating a prior from test placeholders. For a fixed constant c and any target in [0,1], the worst squared error is max(c²,(1-c)²), minimized at c=0.5. This gives a worst-case RMSE bound of 0.5, not an observed score. The sample's zeros carry no evidence about the true target distribution.

E02 configuration: 200 boosting iterations, learning rate 0.05, 15 maximum leaf nodes, minimum 20 samples/leaf, L2=1.0, early stopping off. Numeric and boolean tract features only; GEOIDs/FIPS, vintage/year fields, label-like columns and constants excluded. Convert -999/-9999 sentinels and infinity to missing. A fold-local median imputer adds missing indicators. Clip predictions to [0,1].

Training code logs five per-fold RMSEs, pooled out-of-fold RMSE, mean and standard deviation of fold RMSE, and a fold-training-mean comparator. No target-dependent tuning has been performed. Data-derived preprocessing is fitted only within training folds; constant-column filtering is unsupervised on the selected training region. Random CV would measure interpolation and may be optimistic for spatial transfer. A county or geographic holdout should follow once legitimate labels exist.

Synthetic results belong only to the software check; they do not estimate challenge accuracy or validate the constant submission. No pseudo-label target, removed reference layer, external reference copy, or leaderboard feedback was used.
