"""Name That LLM — notebook pod Kaggle code competition (bez internetu, czysty sklearn).

Jak uzyc (szczegoly w SUBMISSION-KIT.md):
1. Kaggle -> Competition -> New Notebook.
2. Wklej caly ten plik jako komorki kodu (przy # %% zaczyna sie komorka).
3. Add Input -> Competition -> name-that-llm (przycisk + przy zestawie danych).
4. Settings: Internet OFF (code competition i tak wymaga offline w submicie).
5. Save Version -> Save & Run All (Commit) -> zakladka Output -> Submit.

Wersja offline: sklearn only, bez pobierania modeli. Cel: pewny baseline do
weryfikacji pipeline'u na public LB; docelowo podmieniac feature'y na lepsze
(nie odwrotnie — od tego jest pipeline lokalny w repo).
"""
# %% [code] 1 — imports i konfiguracja
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import FeatureUnion, Pipeline

SEED = 42
N_FOLDS = 5
INPUT_DIRS = [Path("/kaggle/input"), Path("data")]  # druga sciezka: lokalny smoke-test
TABLE_EXTS = {".csv", ".json", ".jsonl", ".parquet"}

ID_CANDIDATES = ["id", "ID", "Id", "idx", "index"]
TEXT_CANDIDATES = ["text", "passage", "content", "body", "response", "answer", "prompt_response"]
LABEL_CANDIDATES = ["target", "label", "model", "model_name", "llm", "author", "class", "generator"]


def read_table(p: Path) -> pd.DataFrame:
    if p.suffix.lower() == ".csv":
        return pd.read_csv(p)
    if p.suffix.lower() == ".jsonl":
        return pd.read_json(p, lines=True)
    if p.suffix.lower() == ".json":
        return pd.read_json(p)
    if p.suffix.lower() in {".parquet", ".pq"}:
        return pd.read_parquet(p)
    raise ValueError(p)


def pick_col(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    lower = {str(col).lower(): col for col in df.columns}
    for c in candidates:
        if c.lower() in lower:
            return lower[c.lower()]
    return None


def find_tables():
    files = []
    for d in INPUT_DIRS:
        if d.exists():
            files += [p for p in sorted(d.rglob("*")) if p.suffix.lower() in TABLE_EXTS]
    train = test = sample = None
    for p in files:
        n = p.name.lower()
        if sample is None and ("sample" in n or "submission" in n):
            sample = p
            continue
        if p.suffix.lower() not in TABLE_EXTS:
            continue
        try:
            df = read_table(p)
        except Exception as e:  # noqa: BLE001
            print(f"[warn] {p}: {e}")
            continue
        has_label = pick_col(df, LABEL_CANDIDATES) is not None
        if has_label and (train is None or "train" in n):
            train = (p, df)
        elif not has_label and (test is None or "test" in n):
            test = (p, df)
    return train, test, sample


# %% [code] 2 — wczytanie danych i walidacja schematu
train_pair, test_pair, sample_path = find_tables()
assert train_pair is not None, "Nie znaleziono pliku train (kolumna tekstowa + etykieta) w input!"
assert test_pair is not None, "Nie znaleziono pliku test!"
assert sample_path is not None, "Nie znaleziono sample_submission!"
train = train_pair[1].dropna().reset_index(drop=True)
test = test_pair[1]

id_col = pick_col(train, ID_CANDIDATES)
text_col = pick_col(train, TEXT_CANDIDATES)
label_col = pick_col(train, LABEL_CANDIDATES)
assert text_col and label_col, f"Brak kolumn tekst/etykieta w {list(train.columns)}"
test_text_col = pick_col(test, TEXT_CANDIDATES) or text_col
test_id_col = pick_col(test, ID_CANDIDATES) or id_col

sample = read_table(sample_path)
classes = sorted(train[label_col].astype(str).unique())
print(f"train={len(train)} test={len(test)} klasy={len(classes)}")
print(f"id={id_col} text={text_col} label={label_col}")
print(f"sample kolumny: {list(sample.columns)}")

# %% [code] 3 — model: TF-IDF char(1-5)+word(1-2) + LogReg
def build_features():
    return FeatureUnion([
        ("char", TfidfVectorizer(analyzer="char", ngram_range=(1, 5), min_df=2,
                                 sublinear_tf=True)),
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=2,
                                 sublinear_tf=True)),
    ])


C = 2.0  # wynik lokalnego tuningu; przy realnych danych warto przetestowac 0.5-8
texts = train[text_col].astype(str).values
y = train[label_col].astype(str).values
folds = list(StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=SEED)
             .split(np.zeros(len(y)), y))

oof = np.zeros((len(y), len(classes)))
for k, (tr_idx, va_idx) in enumerate(folds):
    fe = build_features()
    Xtr, Xva = fe.fit_transform(texts[tr_idx]), fe.transform(texts[va_idx])
    clf = LogisticRegression(C=C, max_iter=4000, solver="lbfgs")
    clf.fit(Xtr, y[tr_idx])
    proba = clf.predict_proba(Xva)
    col_of = {c: i for i, c in enumerate(clf.classes_)}
    for i, cls in enumerate(classes):
        if cls in col_of:
            oof[va_idx, i] = proba[:, col_of[cls]]
    pred = classes[np.argmax(oof[va_idx], axis=1)]
    print(f"fold {k+1}/{N_FOLDS}: acc={accuracy_score(y[va_idx], pred):.4f} "
          f"macroF1={f1_score(y[va_idx], pred, average='macro'):.4f}")

oof_pred = classes[np.argmax(oof, axis=1)]
cv_acc = accuracy_score(y, oof_pred)
cv_f1 = f1_score(y, oof_pred, average="macro")
print(f"\nCV accuracy={cv_acc:.4f}  macro-F1={cv_f1:.4f}")

# %% [code] 4 — final fit + submission.csv (format z sample_submission)
fe = build_features()
X_all = fe.fit_transform(texts)
clf = LogisticRegression(C=C, max_iter=4000, solver="lbfgs")
clf.fit(X_all, y)
proba = clf.predict_proba(fe.transform(test[test_text_col].astype(str).values))
test_proba = np.zeros((len(test), len(classes)))
col_of = {c: i for i, c in enumerate(clf.classes_)}
for i, cls in enumerate(classes):
    if cls in col_of:
        test_proba[:, i] = proba[:, col_of[cls]]

sample_id_col = sample.columns[0]
pred_cols = [c for c in sample.columns if c != sample_id_col]
sub = pd.DataFrame({sample_id_col: sample[sample_id_col].values})
if len(pred_cols) == 1:
    sub[pred_cols[0]] = [classes[i] for i in np.argmax(test_proba, axis=1)]
elif len(pred_cols) == 3:
    top3 = np.argsort(-test_proba, axis=1)[:, :3]
    for j, col in enumerate(sorted(pred_cols)):
        sub[col] = [classes[i] for i in top3[:, j]]
else:
    raise ValueError(f"Nieznany format sample_submission: {list(sample.columns)}")

assert list(sub.columns) == list(sample.columns)
assert len(sub) == len(sample)
sub.to_csv("submission.csv", index=False)
print("submission.csv zapisany:")
print(sub.head())
print(sub[pred_cols[0]].value_counts())
