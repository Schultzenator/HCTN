#!/usr/bin/env python3
"""Align existing predictions to a user-downloaded official sample, failing on ID changes."""
import argparse
import csv
from pathlib import Path
from download_data import ROOT
from validate_submission import read_csv, validate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sample', type=Path)
    args = parser.parse_args()
    destination = ROOT / 'submission/submission.csv'
    columns, rows = read_csv(destination)
    official_columns, official_rows = read_csv(args.sample)
    if 'GEOID' not in official_columns or 'coverage_gap_score' not in official_columns:
        raise ValueError('Unexpected official schema: inspect it before adapting the pipeline')
    if not set(official_columns).issubset(columns):
        raise ValueError('Official sample contains unknown columns; inspect before adapting')
    index = columns.index('GEOID')
    mapping = {row[index]: dict(zip(columns, row)) for row in rows}
    official_index = official_columns.index('GEOID')
    ids = [row[official_index] for row in official_rows]
    if len(set(ids)) != len(ids) or set(ids) != set(mapping):
        raise ValueError('Official tract set differs: do not invent predictions for missing IDs')
    candidate = destination.with_suffix('.candidate.csv')
    with candidate.open('w', newline='') as handle:
        writer = csv.writer(handle, lineterminator='\n')
        writer.writerow(official_columns)
        writer.writerows([[mapping[geoid][column] for column in official_columns] for geoid in ids])
    validate(candidate, args.sample)
    candidate.replace(destination)
    print('Aligned submission to official sample; run validator with --sample pointing to that file.')


if __name__ == '__main__':
    main()
