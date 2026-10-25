#!/usr/bin/env python3
"""Train only on legitimate organizer-provided labels; never use sample zeros as labels."""
import os
os.environ.setdefault('OMP_NUM_THREADS', '2')
import argparse
import json
from pathlib import Path
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import root_mean_squared_error
from sklearn.model_selection import KFold
from sklearn.pipeline import make_pipeline

from download_data import ROOT, REGIONS
from validate_submission import validate

TARGET = 'coverage_gap_score'
SEED = 20261022


def make_model():
    return make_pipeline(
        SimpleImputer(strategy='median', add_indicator=True, keep_empty_features=True),
        HistGradientBoostingRegressor(max_iter=200, learning_rate=0.05,
                                      max_leaf_nodes=15, min_samples_leaf=20,
                                      l2_regularization=1.0, early_stopping=False,
                                      random_state=SEED))


def cross_validate(X, y):
    """All preprocessing fitted on each training fold; no full-data imputation."""
    splits = KFold(n_splits=5, shuffle=True, random_state=SEED)
    oof = np.full(len(y), np.nan)
    mean_oof = np.full(len(y), np.nan)
    fold_ids = np.full(len(y), -1, dtype=int)
    metrics = []
    for fold, (train, valid) in enumerate(splits.split(X), 1):
        model = make_model()
        model.fit(X.iloc[train], y[train])
        oof[valid] = np.clip(model.predict(X.iloc[valid]), 0, 1)
        mean_oof[valid] = y[train].mean()
        fold_ids[valid] = fold
        metrics.append({'fold': fold, 'train_rows': len(train), 'valid_rows': len(valid),
                        'rmse': float(root_mean_squared_error(y[valid], oof[valid])),
                        'train_mean_rmse': float(root_mean_squared_error(y[valid], mean_oof[valid]))})
    return {'folds': metrics, 'pooled_oof_rmse': float(root_mean_squared_error(y, oof)),
            'mean_fold_rmse': float(np.mean([row['rmse'] for row in metrics])),
            'std_fold_rmse': float(np.std([row['rmse'] for row in metrics])),
            'train_mean_pooled_oof_rmse': float(root_mean_squared_error(y, mean_oof)),
            'seed': SEED, 'split': 'KFold(5, shuffle=True); not spatial generalization'}, oof, fold_ids


def load_features():
    tables = []
    for region in REGIONS:
        table = pd.read_parquet(ROOT / f'data/strata/{region}/{region}-strata-tract-table.parquet')
        table['GEOID'] = table.GEOID.astype(str).str.zfill(11)
        table['region'] = region
        tables.append(table)
    table = pd.concat(tables, ignore_index=True)
    if table.GEOID.duplicated().any():
        raise ValueError('Duplicate tract feature rows')
    return table.set_index('GEOID')


def numeric_features(table):
    # Exclude identifiers, label-like columns and constants. Coverage flags in strata
    # describe hazard-data availability, not map coverage, and are permitted features.
    banned = ['geoid', 'fips', 'statefp', 'countyfp', 'vintage', 'year', 'gap', 'target']
    names = [c for c in table.select_dtypes(include=['number', 'bool']).columns
             if not any(token in c.lower() for token in banned) and table[c].nunique() > 1]
    if not names:
        raise ValueError('No numeric features')
    return table[names].astype(float).replace([-999, -9999, np.inf, -np.inf], np.nan)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--labels', required=True, type=Path,
                        help='Organizer-provided CSV with GEOID and coverage_gap_score')
    parser.add_argument('--label-source', required=True,
                        help='Document the legitimate organizer label source (not a reconstructed target)')
    parser.add_argument('--region', choices=REGIONS, default='northern-ca')
    args = parser.parse_args()
    labels = pd.read_csv(args.labels, dtype={'GEOID': str})
    if not {'GEOID', TARGET}.issubset(labels.columns):
        raise ValueError('Labels require GEOID and coverage_gap_score')
    if labels.GEOID.isna().any() or not labels.GEOID.str.fullmatch(r'\d{11}').all() or labels.GEOID.duplicated().any():
        raise ValueError('Labels require unique nonnull 11-digit GEOIDs')
    labels[TARGET] = pd.to_numeric(labels[TARGET], errors='raise')
    if not np.isfinite(labels[TARGET]).all() or not labels[TARGET].between(0, 1).all():
        raise ValueError('Labels must be finite and in [0,1]')
    if labels[TARGET].nunique() < 2:
        raise ValueError('Constant targets rejected: sample-submission zeros are not labels')
    table = load_features()
    if not set(labels.GEOID).issubset(table.index):
        raise ValueError('Label GEOIDs not found in provided challenge features')
    train_ids = labels.loc[labels.GEOID.map(table.region).eq(args.region), 'GEOID'].tolist()
    if len(train_ids) < 25:
        raise ValueError('Need at least 25 labeled tracts in selected region')
    # Feature selection uses training rows only; imputation remains fold-local.
    X = numeric_features(table.loc[train_ids])
    y = labels.set_index('GEOID').loc[train_ids, TARGET].to_numpy(dtype=float)
    result, oof, folds = cross_validate(X, y)
    result.update({'status': 'MEASURED_ON_ORGANIZER_LABELS', 'label_source': args.label_source,
                   'region': args.region, 'rows': len(y), 'features': list(X.columns),
                   'parameters': make_model().get_params(deep=False).__repr__()})
    (ROOT / 'reports/cv-results.json').write_text(json.dumps(result, indent=2) + '\n')
    pd.DataFrame({'GEOID': train_ids, 'fold': folds, 'target': y, 'prediction': oof}).to_csv(ROOT / 'reports/oof.csv', index=False)
    model = make_model().fit(X, y)
    output = ROOT / 'models'
    output.mkdir(exist_ok=True)
    with (output / 'baseline.pkl').open('wb') as handle:
        pickle.dump({'model': model, 'features': list(X.columns)}, handle)
    sample = ROOT / 'data/combined-sample-submission.csv'
    submission = pd.read_csv(sample, dtype={'GEOID': str})
    prediction_features = table.loc[submission.GEOID, X.columns].astype(float).replace([-999, -9999, np.inf, -np.inf], np.nan)
    for column in submission.columns:
        if column != 'GEOID':
            submission[column] = 0.5  # Component scores remain explicit untrained constants.
    submission[TARGET] = np.clip(model.predict(prediction_features), 0, 1)
    destination = ROOT / 'submission/submission.csv'
    submission.to_csv(destination, index=False, float_format='%.10f')
    validate(destination, sample)
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
