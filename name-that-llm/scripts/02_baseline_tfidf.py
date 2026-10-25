"""Baseline 1: TF-IDF (char 1-5 + word 1-2) + LogisticRegression / LightGBM.

5-fold stratified CV po passazach (wektoryzator dopasowywany w kazdym foldzie —
bez przecieku). Mini-tuning C (dla LR) na CV. Zapisuje:
- outputs/artifacts/b1_{model}_oof.csv          (id, true, pred, proba per klasa)
- outputs/artifacts/b1_{model}_test_proba.csv   (id, proba per klasa)
- outputs/artifacts/b1_{model}_pipeline.joblib  (pipeline dopasowany na calym train)
- outputs/artifacts/b1_{model}_meta.json        (CV, parametry, classes)

Uzycie:
    python3 scripts/02_baseline_tfidf.py --data-dir data/mock --model lr
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common  # noqa: E402

from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.metrics import accuracy_score, f1_score, log_loss  # noqa: E402
from sklearn.pipeline import FeatureUnion, Pipeline  # noqa: E402


def build_features() -> FeatureUnion:
    return FeatureUnion([
        ("char", TfidfVectorizer(analyzer="char", ngram_range=(1, 5), min_df=2,
                                 sublinear_tf=True, lowercase=True)),
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=2,
                                 sublinear_tf=True, lowercase=True)),
    ])


def build_model(name: str, c: float):
    if name == "lr":
        return LogisticRegression(C=c, max_iter=4000, solver="lbfgs")
    if name == "lgbm":
        import lightgbm as lgb  # opcjonalny requirements.txt
        return lgb.LGBMClassifier(
            n_estimators=600, learning_rate=0.06, num_leaves=63,
            colsample_bytree=0.7, subsample=0.9, random_state=42, n_jobs=-1,
            verbose=-1,
        )
    raise ValueError(f"Nieznany model: {name} (lr | lgbm)")


def cv_fold_scores(model_name: str, c: float, train_texts, y, folds, classes):
    """CV z wektoryzacja wewnatrz folda; zwraca (oof_proba, fold_accs, fold_f1s)."""
    n = len(y)
    oof = np.zeros((n, len(classes)))
    accs, f1s = [], []
    classes = np.asarray(classes)
    for tr_idx, va_idx in folds:
        fe = build_features()
        Xtr = fe.fit_transform(train_texts[tr_idx])
        Xva = fe.transform(train_texts[va_idx])
        clf = build_model(model_name, c)
        clf.fit(Xtr, y[tr_idx])
        proba = clf.predict_proba(Xva)
        # klasy modelu moga byc podzbiorem klas globalnych — zmapuj na pelna macierz
        col_of = {c_: i for i, c_ in enumerate(clf.classes_)}
        for i, cls in enumerate(classes):
            if cls in col_of:
                oof[va_idx, i] = proba[:, col_of[cls]]
        pred = classes[np.argmax(oof[va_idx], axis=1)]
        accs.append(accuracy_score(y[va_idx], pred))
        f1s.append(f1_score(y[va_idx], pred, average="macro"))
        print(f"[fold {len(accs)}] accuracy={accs[-1]:.6f}, logloss={log_loss(y[va_idx], oof[va_idx], labels=classes):.6f}", flush=True)
    return oof, accs, f1s


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=None)
    ap.add_argument("--model", default="lr", choices=["lr", "lgbm"])
    ap.add_argument("--c-grid", default="0.5,1,2,4", help="grid C dla LR (lgbm ignoruje)")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    data = common.load_data(args.data_dir)
    train, test, meta = data["train"], data["test"], data["meta"]
    common.print_schema(meta)
    text_col, label_col = meta["text_col"], meta["label_col"]
    classes = np.asarray(meta["classes"])

    texts = train[text_col].astype(str).values
    y = train[label_col].astype(str).values
    folds = common.stratified_folds(y, n_splits=args.folds, seed=args.seed)

    if args.model == "lr":
        grid = [float(c) for c in args.c_grid.split(",")]
        results = {}
        grid_losses = {}
        best_cv = None
        best_accuracy = -1.0
        for c in grid:
            candidate_oof, accs, f1s = cv_fold_scores(args.model, c, texts, y, folds, classes)
            results[c] = (float(np.mean(accs)), float(np.std(accs)), float(np.mean(f1s)))
            grid_losses[str(c)] = float(log_loss(y, candidate_oof, labels=classes))
            if results[c][0] > best_accuracy:
                best_accuracy = results[c][0]
                best_cv = (candidate_oof, accs, f1s)
            print(f"[cv] C={c}: acc={results[c][0]:.4f} (+/- {results[c][1]:.4f}), macro-F1={results[c][2]:.4f}")
        best_c = max(results, key=lambda c: results[c][0])
        print(f"[cv] najlepsze C={best_c}")
    else:
        best_c = 1.0
        results = {}
        grid_losses = {}
        best_cv = cv_fold_scores(args.model, best_c, texts, y, folds, classes)

    oof, accs, f1s = best_cv
    acc, acc_std, f1 = float(np.mean(accs)), float(np.std(accs)), float(np.mean(f1s))
    loss = float(log_loss(y, oof, labels=classes))
    fold_losses = [float(log_loss(y[va], oof[va], labels=classes)) for _, va in folds]
    oof_pred = classes[np.argmax(oof, axis=1)]
    print(f"[cv] FINAL {args.model} C={best_c}: acc={acc:.4f} +/- {acc_std:.4f}, macro-F1={f1:.4f}")

    # najczesciej mylone pary
    oof_df = pd.DataFrame({"true": y, "pred": oof_pred})
    confused = (
        oof_df[oof_df.true != oof_df.pred]
        .groupby(["true", "pred"]).size().sort_values(ascending=False).head(10)
    )
    conf_lines = [f"{t} -> {p}: {n}" for (t, p), n in confused.items()]

    # fit na calym train + predykcje test
    fe = build_features()
    X_all = fe.fit_transform(texts)
    clf = build_model(args.model, best_c)
    clf.fit(X_all, y)
    pipeline = Pipeline([("features", fe), ("clf", clf)])

    test_ids = test[meta["test_id_col"]].values
    test_proba = np.zeros((len(test), len(classes)))
    col_of = {c_: i for i, c_ in enumerate(clf.classes_)}
    proba = clf.predict_proba(fe.transform(test[meta["test_text_col"]].astype(str).values))
    for i, cls in enumerate(classes):
        if cls in col_of:
            test_proba[:, i] = proba[:, col_of[cls]]

    tag = f"b1_{args.model}"
    pd.DataFrame({meta["id_col"]: train[meta["id_col"]].values, "true": y,
                  **{c: oof[:, i] for i, c in enumerate(classes)}}).to_csv(
        common.ARTIFACT_DIR / f"{tag}_oof.csv", index=False)
    pd.DataFrame({meta["test_id_col"]: test_ids,
                  **{c: test_proba[:, i] for i, c in enumerate(classes)}}).to_csv(
        common.ARTIFACT_DIR / f"{tag}_test_proba.csv", index=False)
    try:
        import joblib
        joblib.dump(pipeline, common.ARTIFACT_DIR / f"{tag}_pipeline.joblib")
    except ImportError:
        print("[warn] brak joblib — pipeline niezapisany (tylko CSV)")
    common.save_json(common.ARTIFACT_DIR / f"{tag}_meta.json", {
        "model": f"tfidf(char1-5+word1-2)+{args.model}", "c": best_c,
        "cv_acc": acc, "cv_acc_std": acc_std, "cv_macro_f1": f1,
        "classes": classes.tolist(), "cv_logloss": loss, "fold_logloss": fold_losses,
        "fold_accuracy": accs, "folds": args.folds, "seed": args.seed,
        "grid_logloss": grid_losses, "n_train": len(train), "n_test": len(test), "grid_results": {str(k): v for k, v in results.items()},
    })

    desc = f"B1 tfidf+{args.model}"
    params = f"char(1,5)+word(1,2) min_df=2 sublinear, C={best_c}, {args.folds}-fold CV"
    common.log_experiment(desc, [
        f"OOF logloss={loss:.6f}",
        f"CV acc={acc:.4f} +/- {acc_std:.4f}, macro-F1={f1:.4f}",
        f"parametry: {params}",
    ] + ([f"top mylone pary: {'; '.join(conf_lines[:5])}"] if conf_lines else []))
    common.append_results(desc, [
        f"OOF logloss: **{loss:.6f}**",
        f"CV accuracy: **{acc:.4f}** (+/- {acc_std:.4f})",
        f"CV macro-F1: {f1:.4f}",
        f"Parametry: {params}",
        f"Najczesciej mylone pary: {'; '.join(conf_lines[:5]) if conf_lines else 'brak'}",
    ])
    print(f"[done] artefakty w {common.ARTIFACT_DIR} ({tag}_*)")


if __name__ == "__main__":
    main()
