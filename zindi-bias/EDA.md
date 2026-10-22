# Data exploration

Retrieved 2026-10-22. All GEOIDs are strings.

## Findings and target

The public repository contains 327 objects and no labeled train/test or coverage-gap file. All score columns in the four regional sample submissions are constant zero placeholders. No model can be fitted or evaluated honestly against the challenge target from these files alone.

The target is `coverage_gap_score`, a [0,1] tract composite: 0 is full map coverage, 1 is no coverage. The organizer averages defined road, building and POI components; absent reference denominators exclude a component. The evaluation metric is RMSE, lower is better. Current rules prohibit reconstructing scores from removed reference layers or equivalent outside copies. ACS housing is a permitted feature, not a replacement building denominator.

## Dictionary and provenance

The current object inventory has no separately named data dictionary. `data/README.md` was read for the layer dictionary, vintage, nested schemas, missingness conventions and access instructions. `reports/schema.csv` records every downloaded parquet column, Arrow type, null count and null fraction. Definitions below summarize the README; missing definitions were not invented.

| Field/family | Meaning |
|---|---|
| GEOID | 11-digit 2020 Census tract ID; preserve leading zero |
| pop_total / land area / urban-rural fields | Census population, tract size and settlement classification |
| svi_* / cvi_* | Social / climate vulnerability and component pillars |
| ruca_* / rucc_* / nchs_* | Urban-rural classification schemes |
| tribal_* | Legal/statistical tribal overlap |
| usdm_* / drought_* | Drought exposure |
| epht_* / gehe_* / uhe_* / hwd_* / ghcn_* / cdcw_* | Heat/climate and weather observation availability |
| usfs_* / carbonplan_* / mtbs_* / nifc_* / fod_* / usgs_* | Wildfire risk, history and exposure |
| *_covered | Source availability; missing coverage is not a zero hazard value |
| Overture names/categories/sources/bbox | Nested structs/lists; geometry is WKB in OGC:CRS84 |

## Regional joined tables

| Region | Rows | Columns | Bytes | Null cells |
|---|---:|---:|---:|---:|
| northern-ca | 591 | 227 | 354,711 | 7,728 |
| eastern-ok | 1192 | 227 | 638,464 | 18,964 |
| maricopa-az | 1593 | 227 | 793,492 | 22,258 |
| south-central-tx | 6010 | 227 | 2,800,838 | 98,561 |

Northern California is the smallest of the four scored challenge regions (591 tracts). The package also has Eastern Washington (415 tracts), added later; it is excluded because the current challenge Info page specifies four scored regions. Joined tables for all four scored regions are small enough to download. Actual joined tables contain 227 columns (the README mentions 232). The Texas joined table has 6,010 rows; seven unscorable water tracts are absent from its 6,003-row sample and must not be added to the submission. Local reference downloads cover Northern California ACS housing, Overture infrastructure and Overture POIs; buildings and roads were not required for this tabular baseline.

## Downloaded parquet layers

| Path | Rows | Columns | Bytes |
|---|---:|---:|---:|
| strata/northern-ca/northern-ca-strata-tract-table.parquet | 591 | 227 | 354,711 |
| strata/eastern-ok/eastern-ok-strata-tract-table.parquet | 1,192 | 227 | 638,464 |
| strata/maricopa-az/maricopa-az-strata-tract-table.parquet | 1,593 | 227 | 793,492 |
| strata/south-central-tx/south-central-tx-strata-tract-table.parquet | 6,010 | 227 | 2,800,838 |
| reference/northern-ca/northern-ca-census-acs-housing.parquet | 591 | 7 | 3,037,540 |
| reference/northern-ca/northern-ca-overture-infrastructure.parquet | 3,318 | 15 | 309,977 |
| reference/northern-ca/northern-ca-overture-pois.parquet | 116,897 | 19 | 16,168,720 |

## Missingness and modeling implications

Northern California has 1 entirely missing columns and 64 constant or entirely missing columns. Observed numeric sentinel counts: `{}`.

Preserve true missing values; convert -999/-9999 source sentinels to missing. Fit imputation on each training fold. Drop IDs, vintages and constant columns from model features. Use numeric tract features and median imputation with missing indicators. Random five-fold CV measures within-region interpolation; county or spatial holdout is needed before claiming geographic transfer. A model trained only in Northern California would extrapolate to three other regions in the combined CSV.

## Submission audit

The four regional samples have the exact common header `GEOID,transport_gap,building_gap,poi_gap,coverage_gap_score`. Their concatenation contains 9,379 distinct tract IDs. The CSV preserves each regional list and fills all four numeric columns with 0.5. This is a label-free constant baseline, not a fitted prediction. Its challenge RMSE is unknown. The separate Zindi-hosted SampleSubmission.csv endpoint requires authentication (HTTP 401), so exact agreement with that file remains unverified.

## Sources

- [Challenge Info and current rules](https://zindi.world/competitions/bias-bounty-mapping-equity-challenge)
- [Challenge Data page](https://zindi.world/competitions/bias-bounty-mapping-equity-challenge/data)
- [Source Cooperative README / layer dictionary](https://data.source.coop/humane-intelligence/bias-bounty-mapping-equity-challenge/README.md)
- `data/inventory.json`, `data/source-listing.xml`, `data/download-manifest.json` record public objects and hashes.
- Attribution: Overture Maps Foundation and its sources (including OpenStreetMap contributors); US Census; CDC, USDA, EPA/EDF CVI, USFS and the hazard sources credited in the upstream README. See upstream per-layer licenses; do not apply the root repository software license to downloaded data.
