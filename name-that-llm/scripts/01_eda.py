"""EDA: schemat, dlugosci, sampling per model, stylometria.

Zapisuje raport do outputs/eda/eda_report.md + tabele CSV.
Dziala tez na mocku (smoke-test): python3 scripts/01_eda.py --data-dir data/mock
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
from stylometry import FEATURE_NAMES, stylometric_features  # noqa: E402


def passage_stats(texts: pd.Series) -> pd.DataFrame:
    words = texts.astype(str).str.split(r"\s+")
    n_words = words.str.len().astype(int)
    n_chars = texts.astype(str).str.len().astype(int)
    n_sents = texts.astype(str).str.count(r"[.!?]").clip(lower=1)
    return pd.DataFrame({
        "n_words": n_words,
        "n_chars": n_chars,
        "avg_word_len": (n_chars / n_words).replace([np.inf, -np.inf], 0.0),
        "n_sents": n_sents,
        "avg_sent_len": (n_words / n_sents).replace([np.inf, -np.inf], 0.0),
        "ttr": words.map(lambda ws: len(set(w.lower() for w in ws)) / len(ws) if ws else 0.0),
    })


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=None, help="nadpisz katalog danych (np. data/mock)")
    args = ap.parse_args()

    data = common.load_data(args.data_dir, require_test=False)
    train, meta = data["train"], data["meta"]
    common.print_schema(meta)

    label_col, text_col = meta["label_col"], meta["text_col"]
    report = [f"# EDA — Name That LLM ({common.utcnow()})", ""]

    # 1. rozklad klas
    counts = train[label_col].value_counts().sort_index()
    report += ["## 1. Rozklad klas", "",
               "| model | n |", "|---|---|"]
    report += [f"| {m} | {n} |" for m, n in counts.items()]
    imbalance = counts.max() / counts.min()
    report += ["", f"N={len(train)}, {len(counts)} klas, max/min = {imbalance:.2f}", ""]

    # 2. dlugosci
    stats = passage_stats(train[text_col])
    stats["model"] = train[label_col].values
    per_model = stats.groupby("model").agg(["mean", "std", "median"])
    per_model.to_csv(common.EDA_DIR / "lengths_per_model.csv")
    overall = stats[["n_words", "n_chars", "avg_word_len", "n_sents", "avg_sent_len", "ttr"]].describe().T
    report += ["## 2. Dlugosci (caly train)", "",
               "| cecha | mean | std | min | 50% | max |", "|---|---|---|---|---|---|"]
    for name, row in overall.iterrows():
        report.append(f"| {name} | {row['mean']:.2f} | {row['std']:.2f} | {row['min']:.1f} | {row['50%']:.1f} | {row['max']:.1f} |")
    report += ["", f"Szczegolowo per model: outputs/eda/lengths_per_model.csv", ""]

    # 3. stylometria: sredni wektor per klasa + top cechy rozrozniajace
    X = stylometric_features(train[text_col].tolist())
    y = train[label_col].values
    Xs = pd.DataFrame(X, columns=FEATURE_NAMES)
    Xs["model"] = y
    class_means = Xs.groupby("model").mean()
    class_means.to_csv(common.EDA_DIR / "stylometry_per_model.csv")
    # roznicowanie miedzyklasowe: std srednich per cecha (wieksza std = cecha bardziej rozrozniajaca)
    spread = class_means.std().sort_values(ascending=False)
    report += ["## 3. Stylometria — najbardziej rozrozniajace cechy (std srednich per klasa)", "",
               "| cecha | std srednich | mean |", "|---|---|---|"]
    for feat, val in spread.head(15).items():
        report.append(f"| {feat} | {val:.4f} | {class_means[feat].mean():.4f} |")
    report += ["", "Pelna tabela: outputs/eda/stylometry_per_model.csv", ""]

    # 4. per-model sampling — po 2 najkrotsze i 2 srednie passaze per klasa
    sample_path = common.EDA_DIR / "samples_per_model.md"
    with open(sample_path, "w", encoding="utf-8") as f:
        f.write(f"# Samples per model ({common.utcnow()})\n")
        for model, grp in train.groupby(label_col):
            f.write(f"\n## {model} (n={len(grp)})\n")
            mid = grp[text_col].astype(str).str.split(r"\s+").str.len().median()
            short = grp.assign(_l=grp[text_col].astype(str).str.split(r"\s+").str.len()).nsmallest(2, "_l")
            typical = grp.assign(
                _d=(grp[text_col].astype(str).str.split(r"\s+").str.len() - mid).abs()
            ).nsmallest(2, "_d")
            for tag, rows in (("shortest", short), ("typical", typical)):
                for _, r in rows.iterrows():
                    txt = str(r[text_col]).replace("\n", " ")
                    f.write(f"\n- [{tag}, {len(txt.split())} slow] {txt[:400]}\n")
    report += [f"Przykladowe passaze per model: outputs/eda/samples_per_model.md", ""]

    # 5. duplikaty / przeciecia
    dup = train[text_col].astype(str).str.strip().duplicated().sum()
    report += ["## 4. Jakosc danych", "",
               f"- zduplikowane passaze (exact): {dup}",
               f"- puste teksty: {(train[text_col].astype(str).str.strip() == '').sum()}",
               f"- srednia dl. slow: {stats['n_words'].mean():.1f} (zakres {stats['n_words'].min()}-{stats['n_words'].max()})", ""]

    report_path = common.EDA_DIR / "eda_report.md"
    report_path.write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report))
    print(f"\n[eda] raport: {report_path}")
    common.log_experiment("EDA", [
        f"N={len(train)}, klas={len(counts)}, duplikaty={dup}",
        f"dlugosc slow: mean={stats['n_words'].mean():.1f}, p50={stats['n_words'].median():.0f}",
        f"top rozrozniajace cechy stylometryczne: {', '.join(spread.head(5).index)}",
    ])


if __name__ == "__main__":
    main()
