#!/usr/bin/env python3
"""Produce reproducible schema, missingness and label-availability audit."""
import json

import pandas as pd
import pyarrow.parquet as pq

from download_data import ROOT, REGIONS


def main():
    data, reports = ROOT / 'data', ROOT / 'reports'
    manifest = json.loads((data / 'download-manifest.json').read_text())
    inventory = json.loads((data / 'inventory.json').read_text())
    tables = []
    lines = ['# Data exploration', '', 'Retrieved 2026-10-22. All GEOIDs are strings.', '',
             '## Findings and target', '',
             'The public repository contains 327 objects and no labeled train/test or coverage-gap file. '
             'All score columns in the four regional sample submissions are constant zero placeholders. '
             'No model can be fitted or evaluated honestly against the challenge target from these files alone.', '',
             'The target is `coverage_gap_score`, a [0,1] tract composite: 0 is full map coverage, 1 is no coverage. '
             'The organizer averages defined road, building and POI components; absent reference denominators '
             'exclude a component. The evaluation metric is RMSE, lower is better. '
             'Current rules prohibit reconstructing scores from removed reference layers or equivalent outside copies. '
             'ACS housing is a permitted feature, not a replacement building denominator.', '',
             '## Dictionary and provenance', '',
             'The current object inventory has no separately named data dictionary. '
             '`data/README.md` was read for the layer dictionary, vintage, nested schemas, missingness conventions '
             'and access instructions. `reports/schema.csv` records every downloaded parquet column, Arrow type, '
             'null count and null fraction. Definitions below summarize the README; missing definitions were not invented.', '',
             '| Field/family | Meaning |', '|---|---|',
             '| GEOID | 11-digit 2020 Census tract ID; preserve leading zero |',
             '| pop_total / land area / urban-rural fields | Census population, tract size and settlement classification |',
             '| svi_* / cvi_* | Social / climate vulnerability and component pillars |',
             '| ruca_* / rucc_* / nchs_* | Urban-rural classification schemes |',
             '| tribal_* | Legal/statistical tribal overlap |',
             '| usdm_* / drought_* | Drought exposure |',
             '| epht_* / gehe_* / uhe_* / hwd_* / ghcn_* / cdcw_* | Heat/climate and weather observation availability |',
             '| usfs_* / carbonplan_* / mtbs_* / nifc_* / fod_* / usgs_* | Wildfire risk, history and exposure |',
             '| *_covered | Source availability; missing coverage is not a zero hazard value |',
             '| Overture names/categories/sources/bbox | Nested structs/lists; geometry is WKB in OGC:CRS84 |', '',
             '## Regional joined tables', '',
             '| Region | Rows | Columns | Bytes | Null cells |', '|---|---:|---:|---:|---:|']
    schemas, regional = [], []
    for region in REGIONS:
        relative = f'strata/{region}/{region}-strata-tract-table.parquet'
        table = pd.read_parquet(data / relative)
        tables.append(table)
        sample = pd.read_csv(data / f'reference/{region}/{region}-sample-submission.csv', dtype={'GEOID': str})
        assert not table.GEOID.duplicated().any()
        assert set(sample.GEOID).issubset(set(table.GEOID.astype(str)))
        extras = sorted(set(table.GEOID.astype(str)) - set(sample.GEOID))
        if region != 'south-central-tx':
            assert not extras
        else:
            assert len(extras) == 7  # documented water tracts without scorable references
        assert all(sample[c].eq(0).all() for c in sample.columns if c != 'GEOID')
        count_null = int(table.isna().sum().sum())
        size = (data / relative).stat().st_size
        regional.append({'region': region, 'rows': len(table), 'columns': len(table.columns),
                         'bytes': size, 'null_cells': count_null, 'sample_all_zero_scores': True,
                         'scored_rows': len(sample), 'excluded_feature_geoids': extras})
        lines.append(f'| {region} | {len(table)} | {len(table.columns)} | {size:,} | {count_null:,} |')
    lines += ['', 'Northern California is the smallest of the four scored challenge regions (591 tracts). '
              'The package also has Eastern Washington (415 tracts), added later; it is excluded because the '
              'current challenge Info page specifies four scored regions. Joined tables for all four scored regions '
              'are small enough to download. Actual joined tables contain 227 columns (the README mentions 232). '
              'The Texas joined table has 6,010 rows; seven unscorable water tracts are absent from its '
              '6,003-row sample and must not be added to the submission. Local reference downloads cover Northern California ACS housing, '
              'Overture infrastructure and Overture POIs; buildings and roads were not required for this tabular baseline.', '',
              '## Downloaded parquet layers', '',
              '| Path | Rows | Columns | Bytes |', '|---|---:|---:|---:|']
    layer_rows = []
    for entry in manifest:
        path = data / entry['path']
        if path.suffix != '.parquet':
            continue
        parquet = pq.ParquetFile(path)
        nulls = {name: 0 for name in parquet.schema_arrow.names}
        for batch in parquet.iter_batches(batch_size=65536):
            for field, column in zip(batch.schema, batch.columns):
                nulls[field.name] += column.null_count
        row_count = parquet.metadata.num_rows
        layer_rows.append({'path': entry['path'], 'rows': row_count, 'columns': len(parquet.schema_arrow), 'bytes': entry['bytes']})
        lines.append(f"| {entry['path']} | {row_count:,} | {len(parquet.schema_arrow)} | {entry['bytes']:,} |")
        for field in parquet.schema_arrow:
            schemas.append({'file': entry['path'], 'column': field.name, 'arrow_type': str(field.type),
                            'null_count': nulls[field.name], 'null_fraction': nulls[field.name] / row_count if row_count else None})
    pd.DataFrame(schemas).to_csv(reports / 'schema.csv', index=False)
    frame = tables[0]
    numeric = frame.select_dtypes(include=['number', 'bool'])
    numeric.describe().T.to_csv(reports / 'northern-ca-numeric-summary.csv')
    missing = frame.isna().mean().sort_values(ascending=False)
    missing.rename('missing_fraction').to_csv(reports / 'northern-ca-missingness.csv')
    sentinel_counts = {c: int(frame[c].isin([-999, -9999]).sum()) for c in numeric.columns}
    sentinel_counts = {c: n for c, n in sentinel_counts.items() if n}
    lines += ['', '## Missingness and modeling implications', '',
              f'Northern California has {int((missing == 1).sum())} entirely missing columns and '
              f'{int((frame.nunique(dropna=True) <= 1).sum())} constant or entirely missing columns. '
              f'Observed numeric sentinel counts: `{json.dumps(sentinel_counts)}`.', '',
              'Preserve true missing values; convert -999/-9999 source sentinels to missing. '
              'Fit imputation on each training fold. Drop IDs, vintages and constant columns from model features. '
              'Use numeric tract features and median imputation with missing indicators. '
              'Random five-fold CV measures within-region interpolation; county or spatial holdout is needed '
              'before claiming geographic transfer. A model trained only in Northern California would extrapolate '
              'to three other regions in the combined CSV.', '',
              '## Submission audit', '',
              'The four regional samples have the exact common header '
              '`GEOID,transport_gap,building_gap,poi_gap,coverage_gap_score`. '
              'Their concatenation contains 9,379 distinct tract IDs. The CSV preserves each regional list and '
              'fills all four numeric columns with 0.5. This is a label-free constant baseline, not a fitted prediction. '
              'Its challenge RMSE is unknown. The separate Zindi-hosted SampleSubmission.csv endpoint requires '
              'authentication (HTTP 401), so exact agreement with that file remains unverified.', '',
              '## Sources', '',
              '- [Challenge Info and current rules](https://zindi.world/competitions/bias-bounty-mapping-equity-challenge)',
              '- [Challenge Data page](https://zindi.world/competitions/bias-bounty-mapping-equity-challenge/data)',
              '- [Source Cooperative README / layer dictionary](https://data.source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge/README.md)',
              '- `data/inventory.json`, `data/source-listing.xml`, `data/download-manifest.json` record public objects and hashes.',
              '- Attribution: Overture Maps Foundation and its sources (including OpenStreetMap contributors); US Census; '
              'CDC, USDA, EPA/EDF CVI, USFS and the hazard sources credited in the upstream README. '
              'See upstream per-layer licenses; do not apply the root repository software license to downloaded data.', '']
    (ROOT / 'EDA.md').write_text('\n'.join(lines))
    audit = {'regions': regional, 'layers': layer_rows,
             'downloaded_bytes': sum(x['bytes'] for x in manifest), 'inventory_objects': len(inventory),
             'label_candidates': [x['path'] for x in inventory if any(t in x['path'].lower() for t in ['coverage-gap', '/train.', '/test.', 'dictionary'])],
             'target_cv_status': 'BLOCKED_NO_ORGANIZER_LABELS', 'rmse': None}
    (reports / 'data-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    print(json.dumps(audit, indent=2))


if __name__ == '__main__':
    main()
