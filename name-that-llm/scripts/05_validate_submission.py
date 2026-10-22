"""Zwaliduj plik submission.csv przed wyslaniem na Kaggle.

Sprawdza (wg sample_submission.csv):
- dokladnie te same kolumny w tej samej kolejnosci,
- ta sama liczba wierszy i tozsame id (kolejnosc z sample),
- predykcje nalezace do zbioru klas z train (dla top-3: bez powtorzen w wierszu),
- brak pustych wartosci / NaN.

Exit code: 0 = OK, 1 = blad.

Uzycie:
    python3 scripts/05_validate_submission.py outputs/submissions/b1_lr.csv
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def validate(path: Path, data_dir: str | None) -> list[str]:
    errors: list[str] = []
    data = common.load_data(data_dir, require_test=False)
    sample, meta = data["sample"], data["meta"]
    if sample is None:
        return ["Brak sample_submission.csv w data/ — nie mam wzorca formatu."]
    sub = pd.read_csv(path)

    if list(sub.columns) != list(sample.columns):
        errors.append(f"Kolumny {list(sub.columns)} != sample {list(sample.columns)}.")
        return errors

    if len(sub) != len(sample):
        errors.append(f"Liczba wierszy {len(sub)} != sample {len(sample)}.")

    id_col = sample.columns[0]
    if len(sub) == len(sample):
        sub_ids = sub[id_col].tolist()
        sample_ids = sample[id_col].tolist()
        if sub_ids != sample_ids:
            if sorted(map(str, sub_ids)) == sorted(map(str, sample_ids)):
                errors.append("Kolejnosc id rozna od sample (zbiory identyczne) — Kaggle zwykle wymaga dokladnej kolejnosci; napraw sortowaniem.")
            else:
                missing = set(map(str, sample_ids)) - set(map(str, sub_ids))
                extra = set(map(str, sub_ids)) - set(map(str, sample_ids))
                errors.append(f"Id niezgodne; brakujace={list(missing)[:5]}, nadmiarowe={list(extra)[:5]}.")

    classes = set(meta["classes"])
    pred_cols = [c for c in sample.columns if c != id_col]
    for col in pred_cols:
        if sub[col].isna().any():
            errors.append(f"Kolumna {col}: NaN/braki.")
        bad = sorted(set(sub[col].dropna().astype(str)) - classes)
        if bad:
            errors.append(f"Kolumna {col}: wartosci spoza zbioru klas: {bad[:5]}")

    if len(pred_cols) == 3:
        # powtorzenia klasy w wierszu (top-3 nie moze powtarzac modelu)
        for i, row in sub.iterrows():
            vals = [str(row[c]) for c in pred_cols]
            if len(set(vals)) != len(vals):
                errors.append(f"Wiersz {i}: powtorzone klasy w top-3: {vals}.")
                break
    return errors


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("file", help="sciezka do submission.csv")
    ap.add_argument("--data-dir", default=None)
    args = ap.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"BLAD: plik {path} nie istnieje.")
        sys.exit(1)
    errors = validate(path, args.data_dir)
    if errors:
        print("WALIDACJA NEGATYWNA:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print(f"WALIDACJA OK: {path}")


if __name__ == "__main__":
    main()
