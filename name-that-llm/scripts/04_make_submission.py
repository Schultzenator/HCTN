"""Generuj submission.csv z artefaktow baseline'ow (srednia prawdopodobienstw / blend).

Blending: wazona srednia prawdopodobienstw z podanych plikow *_test_proba.csv.
Format (top-1 / top-3) i kolejnosc wierszy wedlug sample_submission.

Uzycie:
    python3 scripts/04_make_submission.py --name b1_lr.csv                       # 1 plik
    python3 scripts/04_make_submission.py --name blend.csv \\
        --inputs outputs/artifacts/b1_lr_test_proba.csv,outputs/artifacts/b2_st_test_proba.csv \\
        --weights 0.6,0.4
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inputs", required=True, help="sciezki do *_test_proba.csv, przecinkami")
    ap.add_argument("--weights", default=None, help="wagi blendu, przecinkami (default: rowne)")
    ap.add_argument("--name", default="submission.csv", help="nazwa pliku wynikowego w outputs/submissions/")
    ap.add_argument("--output", default=None, help="explicit output CSV path (overrides --name)")
    ap.add_argument("--data-dir", default=None)
    args = ap.parse_args()

    data = common.load_data(args.data_dir)
    test, sample, meta = data["test"], data["sample"], data["meta"]
    if sample is None:
        raise ValueError("Brak sample_submission.csv — nie moge ustalic formatu submissionu.")
    fmt = meta["submission_format"]
    classes = meta["classes"]

    inputs = [Path(p) for p in args.inputs.split(",") if p.strip()]
    if not inputs:
        raise ValueError("Brak plikow wejsciowych (--inputs).")
    weights = ([float(w) for w in args.weights.split(",")] if args.weights
               else [1.0] * len(inputs))
    if len(weights) != len(inputs):
        raise ValueError(f"Liczba wag ({len(weights)}) != liczba plikow ({len(inputs)}).")
    total = sum(weights)
    weights = [w / total for w in weights]

    test_ids = test[meta["test_id_col"]].values
    id_col_sample = sample.columns[0]
    blended = None
    for path, w in zip(inputs, weights):
        df = pd.read_csv(path)
        id_col_in = df.columns[0]
        # ustaw wiersze w kolejnosci testu
        df = df.set_index(id_col_in).reindex(test_ids)
        if df.isna().all(axis=1).any():
            missing = df.index[df.isna().all(axis=1)]
            raise ValueError(f"{path}: brak prawdopodobienstw dla id testu: {list(missing[:5])}")
        cols = [c for c in df.columns]
        if set(cols) != set(classes):
            raise ValueError(f"{path}: kolumny klas {cols[:5]}... != meta classes {classes[:5]}...")
        df = df[classes]
        blended = w * df.values if blended is None else blended + w * df.values
        print(f"[blend] {path.name} waga={w:.3f}")

    out_ids = sample[id_col_sample].values
    # mapuj prawdopodobienstwa z test_id na id z sample (klucze po str: odporne
    # na roznice dtype int/str miedzy test.csv a sample_submission.csv)
    proba_by_id = {str(tid): blended[i] for i, tid in enumerate(test_ids)}
    try:
        rows = np.stack([proba_by_id[str(i)] for i in out_ids])
    except KeyError as e:
        raise ValueError(f"sample_submission zawiera id nieobecne w tescie: {e}")

    sub = pd.DataFrame({id_col_sample: out_ids})
    if fmt["mode"] == "top1":
        sub[fmt["cols"][0]] = [classes[i] for i in np.argmax(rows, axis=1)]
    elif fmt["mode"] == "top3":
        top3 = np.argsort(-rows, axis=1)[:, :3]
        for k, col in enumerate(fmt["cols"]):
            sub[col] = [classes[i] for i in top3[:, k]]
    else:
        raise ValueError(f"Nieznany format submissionu: {fmt}")

    out_path = Path(args.output) if args.output else common.SUBMISSION_DIR / args.name
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sub.to_csv(out_path, index=False)
    dist = sub[fmt["cols"][0]].value_counts().sort_index()
    print(f"[done] {out_path} ({len(sub)} wierszy, format {fmt['mode']})")
    print(f"[done] rozklad predykcji top-1:\n{dist.to_string()}")


if __name__ == "__main__":
    main()
