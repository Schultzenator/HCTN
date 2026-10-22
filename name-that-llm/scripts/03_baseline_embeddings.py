"""Baseline 2: embeddings + klasyczny klasyfikator.

Wariant A (jesli dostepny sentence-transformers): all-MiniLM-L6-v2 -> 384-dim
embeddings -> LogisticRegression. Model pobiera sie raz z internetu przy pierwszym
uruchomieniu (potem cache lokalny); w submicie Kaggle trzeba go dodac jako
offline Dataset/Model (sprawdz Rules).

Wariant B (fallback, bez internetu): cechy stylometryczne (scripts/stylometry.py)
-> StandardScaler -> TruncatedSVD (fit na train, transform test — bez przecieku)
-> LogisticRegression.

Zapisuje outputs/artifacts/b2_{variant}_* analogicznie do baseline 1.

Uzycie:
    python3 scripts/03_baseline_embeddings.py --data-dir data/mock
    python3 scripts/03_baseline_embeddings.py --force-styl   # wymus fallback
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402
from stylometry import stylometric_features  # noqa: E402

from sklearn.decomposition import TruncatedSVD  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import accuracy_score, f1_score  # noqa: E402
from sklearn.pipeline import Pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

EMBED_MODEL = "all-MiniLM-L6-v2"


def make_features(train_texts, test_texts, force_styl: bool) -> tuple[np.ndarray, np.ndarray, str, str]:
    """Zwraca (Xtr, Xte, wariant, opis). Transformacja fitowana wylacznie na train."""
    if not force_styl:
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer(EMBED_MODEL)
            print(f"[emb] {EMBED_MODEL}: encode train ({len(train_texts)}) i test ({len(test_texts)})...")
            Xtr = model.encode(list(train_texts), show_progress_bar=False, batch_size=64)
            Xte = model.encode(list(test_texts), show_progress_bar=False, batch_size=64)
            return (np.asarray(Xtr, dtype=np.float64), np.asarray(Xte, dtype=np.float64),
                    "st", f"{EMBED_MODEL} embeddings")
        except Exception as e:  # noqa: BLE001 - brak netu/pakietu -> fallback stylometrii
            print(f"[warn] sentence-transformers niedostepny ({type(e).__name__}: {e}); fallback na stylometrie")

    raw_tr = stylometric_features(train_texts)
    raw_te = stylometric_features(test_texts)
    n_comp = min(64, raw_tr.shape[1] - 1, raw_tr.shape[0] - 1)
    prep = Pipeline([
        ("scaler", StandardScaler()),
        ("svd", TruncatedSVD(n_components=n_comp, random_state=42)),
    ])
    Xtr = prep.fit_transform(raw_tr)
    Xte = prep.transform(raw_te)
    return Xtr, Xte, "styl", f"stylometria+scaler+SVD({n_comp})"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=None)
    ap.add_argument("--force-styl", action="store_true", help="pomin sentence-transformers")
    ap.add_argument("--c", type=float, default=4.0)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    data = common.load_data(args.data_dir)
    train, test, meta = data["train"], data["test"], data["meta"]
    common.print_schema(meta)
    text_col, label_col = meta["text_col"], meta["label_col"]
    classes = meta["classes"]

    train_texts = train[text_col].astype(str).tolist()
    test_texts = test[meta["test_text_col"]].astype(str).tolist()
    y = train[label_col].astype(str).values

    Xtr, Xte, variant, feat_desc = make_features(train_texts, test_texts, args.force_styl)
    print(f"[emb] wariant: {variant}, dims={Xtr.shape[1]}")

    folds = common.stratified_folds(y, n_splits=args.folds, seed=args.seed)
    oof = np.zeros((len(y), len(classes)))
    accs, f1s = [], []
    for tr_idx, va_idx in folds:
        clf = LogisticRegression(C=args.c, max_iter=4000, solver="lbfgs")
        clf.fit(Xtr[tr_idx], y[tr_idx])
        proba = clf.predict_proba(Xtr[va_idx])
        col_of = {c_: i for i, c_ in enumerate(clf.classes_)}
        for i, cls in enumerate(classes):
            if cls in col_of:
                oof[va_idx, i] = proba[:, col_of[cls]]
        pred = classes[np.argmax(oof[va_idx], axis=1)]
        accs.append(accuracy_score(y[va_idx], pred))
        f1s.append(f1_score(y[va_idx], pred, average="macro"))
    acc, acc_std, f1 = float(np.mean(accs)), float(np.std(accs)), float(np.mean(f1s))
    print(f"[cv] B2/{variant}: acc={acc:.4f} +/- {acc_std:.4f}, macro-F1={f1:.4f}")

    clf = LogisticRegression(C=args.c, max_iter=4000, solver="lbfgs")
    clf.fit(Xtr, y)
    test_proba = np.zeros((len(test), len(classes)))
    col_of = {c_: i for i, c_ in enumerate(clf.classes_)}
    proba = clf.predict_proba(Xte)
    for i, cls in enumerate(classes):
        if cls in col_of:
            test_proba[:, i] = proba[:, col_of[cls]]

    tag = f"b2_{variant}"
    pd.DataFrame({meta["id_col"]: train[meta["id_col"]].values, "true": y,
                  **{c: oof[:, i] for i, c in enumerate(classes)}}).to_csv(
        common.ARTIFACT_DIR / f"{tag}_oof.csv", index=False)
    pd.DataFrame({meta["test_id_col"]: test[meta["test_id_col"]].values,
                  **{c: test_proba[:, i] for i, c in enumerate(classes)}}).to_csv(
        common.ARTIFACT_DIR / f"{tag}_test_proba.csv", index=False)
    common.save_json(common.ARTIFACT_DIR / f"{tag}_meta.json", {
        "model": f"{variant}+logreg", "embed_model": EMBED_MODEL if variant == "st" else None,
        "c": args.c, "cv_acc": acc, "cv_acc_std": acc_std, "cv_macro_f1": f1,
        "classes": classes,
    })

    desc = f"B2 {variant}+logreg"
    params = f"{feat_desc} -> LogReg C={args.c}, {args.folds}-fold CV"
    common.log_experiment(desc, [f"CV acc={acc:.4f} +/- {acc_std:.4f}, macro-F1={f1:.4f}",
                                f"parametry: {params}"])
    common.append_results(desc, [
        f"CV accuracy: **{acc:.4f}** (+/- {acc_std:.4f})",
        f"CV macro-F1: {f1:.4f}",
        f"Parametry: {params}",
    ])
    print(f"[done] artefakty w {common.ARTIFACT_DIR} ({tag}_*)")


if __name__ == "__main__":
    main()
