#!/usr/bin/env bash
# Pelny pipeline: (mock smoke-test lub realne dane) -> EDA -> B1 -> B2 -> 3 submissiony -> walidacja.
#
# Uzycie:
#   bash make_candidate_submissions.sh            # wykrywa sam: data/ realne albo mock
#   PYTHON=python3.11 bash make_candidate_submissions.sh
set -euo pipefail
cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
DATA_DIR="data"

if ! ls data/train*.csv data/train*.parquet data/train*.json* data/training*.csv 2>/dev/null | grep -q .; then
  echo ""
  echo "==================================================================="
  echo " BRAK DANYCH w data/ — SMOKE-TEST NA MOCKU"
  echo " Wyniki CV i submissiony z tego przebiegu NIE mierza realnej"
  echo " jakosci. Po wrzuceniu danych (DODAWANIE-DANYCH.md) uruchom ponownie."
  echo "==================================================================="
  echo ""
  $PY scripts/00_make_mock_data.py --out data/mock
  DATA_DIR="data/mock"
fi

echo "### Katalog danych: $DATA_DIR"
$PY scripts/01_eda.py --data-dir "$DATA_DIR"

echo ""
echo "### BASELINE 1: TF-IDF + LogReg (z mini-tuningiem C)"
$PY scripts/02_baseline_tfidf.py --data-dir "$DATA_DIR" --model lr

echo ""
echo "### BASELINE 2: embeddings (fallback stylometria) + LogReg"
$PY scripts/03_baseline_embeddings.py --data-dir "$DATA_DIR"

B1=outputs/artifacts/b1_lr_test_proba.csv
B2=$(ls outputs/artifacts/b2_*_test_proba.csv 2>/dev/null | head -1 || true)

echo ""
echo "### 3 kandydackie submissiony"
$PY scripts/04_make_submission.py --data-dir "$DATA_DIR" --name cand1_b1_lr.csv \
  --inputs "$B1"
if [ -n "$B2" ]; then
  $PY scripts/04_make_submission.py --data-dir "$DATA_DIR" --name cand2_b2.csv \
    --inputs "$B2"
  $PY scripts/04_make_submission.py --data-dir "$DATA_DIR" --name cand3_blend6040.csv \
    --inputs "$B1,$B2" --weights 0.6,0.4
fi

echo ""
echo "### Walidacja formatu"
for f in outputs/submissions/cand*.csv; do
  $PY scripts/05_validate_submission.py "$f" --data-dir "$DATA_DIR"
done

echo ""
echo "### Podsumowanie CV (outputs/artifacts/*_meta.json)"
grep -h '"cv_acc"' outputs/artifacts/b1_lr_meta.json outputs/artifacts/b2_*_meta.json 2>/dev/null || true
echo ""
echo "Submissiony: outputs/submissions/cand*.csv"
[ "$DATA_DIR" = "data/mock" ] && echo "UWAGA: powyzsze liczby pochodza z MOCKA — do rekinowania dopiero po danych realnych."
