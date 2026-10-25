#!/usr/bin/env python3
"""Exercise training machinery on synthetic data and reject malformed submissions."""
import json
from pathlib import Path
import tempfile
import subprocess
import sys

import numpy as np
import pandas as pd

from download_data import ROOT
from train_baseline import cross_validate, make_model, load_features, numeric_features
from validate_submission import validate, read_csv


def main():
    rng = np.random.default_rng(20261022)
    X = pd.DataFrame(rng.normal(size=(300, 6)), columns=[f'x{i}' for i in range(6)])
    y = np.clip(0.5 + 0.18 * X.x0 - 0.1 * X.x1 + rng.normal(0, 0.015, len(X)), 0, 1).to_numpy()
    X.loc[rng.random(len(X)) < 0.05, 'x2'] = np.nan
    metrics, oof, folds = cross_validate(X, y)
    assert np.isfinite(oof).all() and set(folds) == {1, 2, 3, 4, 5}
    assert metrics['pooled_oof_rmse'] < metrics['train_mean_pooled_oof_rmse']
    # Deterministic predictions for fixed data/seed.
    a = make_model().fit(X, y).predict(X)
    b = make_model().fit(X, y).predict(X)
    assert np.array_equal(a, b)
    sample = ROOT / 'data/combined-sample-submission.csv'
    submission = ROOT / 'submission/submission.csv'
    validate(submission, sample)
    header, rows = read_csv(submission)
    negatives = {}
    import csv
    mutations = {
        'blank_score': lambda r: r[0].__setitem__(1, ''),
        'nan_score': lambda r: r[0].__setitem__(1, 'nan'),
        'infinite_score': lambda r: r[0].__setitem__(1, 'inf'),
        'out_of_range': lambda r: r[0].__setitem__(1, '1.1'),
        'lost_leading_zero': lambda r: r[0].__setitem__(0, str(int(r[0][0]))),
        'duplicate_id': lambda r: r[1].__setitem__(0, r[0][0]),
        'missing_tract': lambda r: r.pop(),
        'reordered_rows': lambda r: r.reverse(),
    }
    with tempfile.TemporaryDirectory(dir=ROOT) as directory:
        path = Path(directory) / 'invalid.csv'
        for name, mutate in mutations.items():
            changed = [row.copy() for row in rows]
            mutate(changed)
            with path.open('w', newline='') as handle:
                writer = csv.writer(handle)
                writer.writerow(header)
                writer.writerows(changed)
            try:
                validate(path, sample)
            except ValueError:
                negatives[name] = 'PASS_REJECTED'
            else:
                raise AssertionError(f'Invalid submission accepted: {name}')
        with path.open('w', newline='') as handle:
            writer = csv.writer(handle)
            writer.writerow(header[::-1])
            writer.writerows([r[::-1] for r in rows])
        try:
            validate(path, sample)
        except ValueError:
            negatives['reordered_columns'] = 'PASS_REJECTED'
        else:
            raise AssertionError('Reordered columns accepted')
    table = load_features()
    real_X = numeric_features(table[table.region.eq('northern-ca')])
    assert len(real_X) == 591 and len(real_X.columns) > 0
    rejected = subprocess.run([sys.executable, str(ROOT / 'scripts/train_baseline.py'),
                               '--labels', str(ROOT / 'data/reference/northern-ca/northern-ca-sample-submission.csv'),
                               '--label-source', 'software rejection check; placeholder sample'],
                              capture_output=True, text=True)
    assert rejected.returncode != 0 and 'sample-submission zeros are not labels' in rejected.stderr
    result = {'status': 'PASS', 'data': 'SYNTHETIC ONLY — not challenge labels',
              'synthetic_five_fold_metrics': metrics, 'deterministic_fit': True,
              'invalid_submission_cases': negatives, 'challenge_target_rmse': None, 'placeholder_training_rejected': True,
              'real_feature_loading': {'status': 'PASS', 'rows_all_regions': len(table),
                                       'northern_ca_rows': len(real_X), 'numeric_features': len(real_X.columns)}}
    (ROOT / 'reports/pipeline-check.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
