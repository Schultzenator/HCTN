#!/usr/bin/env python3
"""Validate exact CSV schema, ordered IDs, complete finite scores and [0,1] bounds."""
import argparse
import csv
import json
import math
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read_csv(path):
    with Path(path).open(newline='', encoding='utf-8-sig') as handle:
        reader = csv.reader(handle)
        header = next(reader, [])
        rows = list(reader)
    if not header or len(set(header)) != len(header):
        raise ValueError('Missing or duplicate column names')
    if any(len(row) != len(header) for row in rows):
        raise ValueError('Malformed CSV row width')
    return header, rows


def validate(submission, sample):
    header, rows = read_csv(submission)
    expected_header, expected_rows = read_csv(sample)
    if header != expected_header:
        raise ValueError(f'Columns/order {header} do not match sample {expected_header}')
    if 'GEOID' not in header:
        raise ValueError('Sample must contain GEOID')
    id_index = header.index('GEOID')
    ids = [row[id_index] for row in rows]
    expected_ids = [row[id_index] for row in expected_rows]
    if not ids or len(set(ids)) != len(ids):
        raise ValueError('Empty submission or duplicate GEOIDs')
    if any(not re.fullmatch(r'\d{11}', value) for value in ids):
        raise ValueError('GEOIDs must be exactly 11 digits; preserve leading zeros')
    if ids != expected_ids:
        raise ValueError('GEOID rows/order differ from sample (missing, extra or reordered IDs)')
    for i, row in enumerate(rows, start=2):
        for j, name in enumerate(header):
            if j == id_index:
                continue
            try:
                value = float(row[j])
            except ValueError:
                raise ValueError(f'Row {i}, {name}: nonnumeric or blank value') from None
            if not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError(f'Row {i}, {name}: value must be finite and in [0,1]')
    return {'status': 'PASS', 'rows': len(rows), 'columns': header,
            'sample': str(Path(sample).relative_to(ROOT)) if Path(sample).is_relative_to(ROOT) else str(sample),
            'checks': ['exact column order', 'exact GEOID order', 'unique 11-digit IDs',
                       'no blanks', 'finite numeric scores', '[0,1] bounds'],
            'limitation': 'Local format validation only; no Zindi upload or accuracy claim.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('submission', nargs='?', type=Path, default=ROOT / 'submission/submission.csv')
    parser.add_argument('--sample', type=Path, default=ROOT / 'data/combined-sample-submission.csv')
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    result = validate(args.submission, args.sample)
    rendered = json.dumps(result, indent=2) + '\n'
    if args.report:
        args.report.parent.mkdir(exist_ok=True, parents=True)
        args.report.write_text(rendered)
    print(rendered)


if __name__ == '__main__':
    main()
