#!/usr/bin/env python3
"""Build a label-free minimax constant baseline from public regional templates."""
import csv
import json
from pathlib import Path
from download_data import ROOT, REGIONS
from validate_submission import read_csv, validate


def main():
    header, rows, counts = None, [], {}
    for region in REGIONS:
        path = ROOT / f'data/reference/{region}/{region}-sample-submission.csv'
        columns, regional_rows = read_csv(path)
        if header is not None and columns != header:
            raise ValueError('Regional sample schemas differ')
        header = columns
        rows.extend(regional_rows)
        counts[region] = len(regional_rows)
    # Preserve downloaded region order and each regional template's original row order.
    template = ROOT / 'data/combined-sample-submission.csv'
    with template.open('w', newline='') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(header)
        writer.writerows(rows)
    path = ROOT / 'submission/submission.csv'
    with path.open('w', newline='') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(header)
        for row in rows:
            writer.writerow([value if name == 'GEOID' else '0.5'
                             for name, value in zip(header, row)])
    result = validate(path, template)
    result.update({'region_counts': counts, 'baseline': 'constant 0.5, no fitted model',
                   'official_zindi_sample_verified': False,
                   'sample_provenance': 'Concatenation of four public Source Cooperative regional samples',
                   'reason': 'Zindi SampleSubmission.csv endpoint returns HTTP 401 without authentication'})
    (ROOT / 'reports/submission-validation.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
