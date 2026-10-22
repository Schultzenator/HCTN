"""Wspolne narzedzia pipeline'u Name That LLM.

Paths, IO z auto-detekcja schematu danych i formatu submissionu (top-1 / top-3),
CV po passazach, logowanie eksperymentow do EXPERIMENTS.md / RESULTS.md.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold

HERE = Path(__file__).resolve().parent
PROJECT_DIR = HERE.parent
DATA_DIR = PROJECT_DIR / "data"
OUTPUT_DIR = PROJECT_DIR / "outputs"
SUBMISSION_DIR = OUTPUT_DIR / "submissions"
ARTIFACT_DIR = OUTPUT_DIR / "artifacts"
EDA_DIR = OUTPUT_DIR / "eda"
EXPERIMENTS_MD = PROJECT_DIR / "EXPERIMENTS.md"
RESULTS_MD = PROJECT_DIR / "RESULTS.md"

for _d in (OUTPUT_DIR, SUBMISSION_DIR, ARTIFACT_DIR, EDA_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# --- kandydaci nazw plikow / kolumn (edytuj, jesli realny schemat odbiega) ---
TRAIN_NAMES = ["train", "training", "train_data", "train_set"]
TEST_NAMES = ["test", "test_data", "test_set", "public_test"]
SAMPLE_NAMES = ["sample_submission", "sampleSubmission", "sample_sub", "submission", "submission_template"]
EXTS = [".csv", ".parquet", ".json", ".jsonl"]
ID_CANDIDATES = ["id", "ID", "Id", "idx", "index"]
TEXT_CANDIDATES = ["text", "passage", "content", "body", "response", "answer", "prompt_response"]
LABEL_CANDIDATES = ["target", "label", "model", "model_name", "llm", "author", "class", "generator"]


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def find_file(data_dir: Path, base_names: list[str]) -> Path | None:
    """Znajdz plik danych po nazwach bazowych i rozszerzeniach."""
    for name in base_names:
        for ext in EXTS:
            p = data_dir / f"{name}{ext}"
            if p.exists():
                return p
    # przebieg po wszystkich plikach w katalogu (nazwa zawiera baze)
    if data_dir.exists():
        for name in base_names:
            for p in sorted(data_dir.iterdir()):
                if p.is_file() and name.lower() in p.name.lower() and p.suffix.lower() in EXTS:
                    return p
        # fallback: szukaj rekursywnie (zip mogl rozpakowac sie do podkatalogu)
        for name in base_names:
            for p in sorted(data_dir.rglob("*")):
                if p.is_file() and name.lower() in p.name.lower() and p.suffix.lower() in EXTS:
                    return p
    return None


def read_any(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    if path.suffix.lower() == ".parquet":
        return pd.read_parquet(path)
    if path.suffix.lower() in (".json", ".jsonl"):
        try:
            return pd.read_json(path, lines=path.suffix.lower() == ".jsonl")
        except ValueError:
            return pd.read_json(path, lines=True)
    raise ValueError(f"Nieobslugiwany format pliku: {path}")


def pick_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    for c in candidates:
        if c in df.columns:
            return c
    lower = {str(col).lower(): col for col in df.columns}
    for c in candidates:
        if c.lower() in lower:
            return lower[c.lower()]
    return None


def submission_format(sample: pd.DataFrame, id_col: str | None) -> dict:
    """Wykryj format submissionu z sample_submission.csv."""
    pred_cols = [c for c in sample.columns if c != id_col]
    if len(pred_cols) == 1:
        return {"mode": "top1", "cols": [pred_cols[0]]}
    if len(pred_cols) == 3:
        def _rank(col: str, idx: int) -> int:
            # kolumna z cyfra w nazwie (np. top1/target_1) -> jej cyfra, inaczej kolejnosc pliku
            for d in "123":
                if d in col:
                    return int(d)
            return idx + 10
        ranked = [c for _, c in sorted(((_rank(c, i), c) for i, c in enumerate(pred_cols)))]
        return {"mode": "top3", "cols": ranked}
    raise ValueError(
        f"Nieznany format submissionu: kolumny {list(sample.columns)}. "
        "Zaktualizuj submission_format() w scripts/common.py."
    )


def load_data(data_dir: Path | str | None = None, require_test: bool = True) -> dict:
    """Wczytaj train/test/sample_submission z auto-detekcja schematu.

    Zwraca dict: train (DataFrame), test (DataFrame|None), sample (DataFrame|None),
    meta (id_col, text_col, label_col, classes, submission_format, paths).
    """
    data_dir = Path(data_dir) if data_dir else DATA_DIR
    if not data_dir.exists():
        raise FileNotFoundError(
            f"Katalog danych {data_dir} nie istnieje. Patrz DODAWANIE-DANYCH.md."
        )

    train_path = find_file(data_dir, TRAIN_NAMES)
    test_path = find_file(data_dir, TEST_NAMES)
    sample_path = find_file(data_dir, SAMPLE_NAMES)

    if train_path is None:
        raise FileNotFoundError(
            f"Brak pliku train w {data_dir} (szukano: {TRAIN_NAMES}, ext {EXTS}). Patrz DODAWANIE-DANYCH.md."
        )

    train = read_any(train_path)
    id_col = pick_col(train, ID_CANDIDATES)
    text_col = pick_col(train, TEXT_CANDIDATES)
    label_col = pick_col(train, LABEL_CANDIDATES)
    missing = [name for name, col in (("id", id_col), ("text", text_col), ("label", label_col)) if col is None]
    if missing:
        raise ValueError(
            f"Train {train_path}: nie wykryto kolumn: {missing}. "
            f"Dostepne: {list(train.columns)}. Dostosuj *_CANDIDATES w scripts/common.py."
        )
    train = train.dropna(subset=[text_col, label_col]).reset_index(drop=True)

    test = read_any(test_path) if test_path else None
    if require_test and test is None:
        raise FileNotFoundError(f"Brak pliku test w {data_dir}. Patrz DODAWANIE-DANYCH.md.")
    if test is not None:
        # text_col moze miec inna nazwe w tescie — wykryj niezaleznie
        test_text_col = pick_col(test, TEXT_CANDIDATES) or text_col
        test_id_col = pick_col(test, ID_CANDIDATES) or id_col
    else:
        test_text_col, test_id_col = None, None

    sample = read_any(sample_path) if sample_path else None
    sub_fmt = submission_format(sample, pick_col(sample, ID_CANDIDATES) or id_col) if sample is not None else {"mode": "top1", "cols": [label_col]}

    classes = sorted(train[label_col].astype(str).unique().tolist())
    meta = {
        "data_dir": str(data_dir),
        "paths": {"train": str(train_path), "test": str(test_path), "sample": str(sample_path)},
        "id_col": id_col,
        "text_col": text_col,
        "label_col": label_col,
        "test_text_col": test_text_col,
        "test_id_col": test_id_col,
        "classes": classes,
        "n_train": len(train),
        "n_test": 0 if test is None else len(test),
        "submission_format": sub_fmt,
    }
    return {"train": train, "test": test, "sample": sample, "meta": meta}


def print_schema(meta: dict) -> None:
    fmt = meta["submission_format"]
    print("=== SCHEMA ===")
    print(f"train: {meta['n_train']} wierszy | test: {meta['n_test']} wierszy")
    print(f"kolumny: id={meta['id_col']}, text={meta['text_col']}, label={meta['label_col']}")
    print(f"klasy ({len(meta['classes'])}): {meta['classes']}")
    print(f"format submissionu: {fmt['mode']} -> kolumny {fmt['cols']}")
    print("==============")


def stratified_folds(y: np.ndarray, n_splits: int = 5, seed: int = 42) -> list[tuple[np.ndarray, np.ndarray]]:
    """CV po passazach (wiersz = passaz), stratified."""
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    return list(skf.split(np.zeros(len(y)), y))


def log_experiment(title: str, lines: list[str]) -> None:
    """Dopisz wpis eksperymentu do EXPERIMENTS.md."""
    entry = [f"## {utcnow()} — {title}"]
    entry += [f"- {ln}" for ln in lines]
    text = "\n".join(entry) + "\n\n"
    with open(EXPERIMENTS_MD, "a", encoding="utf-8") as f:
        f.write(text)
    print(f"[EXPERIMENTS.md] {title}")


def append_results(title: str, lines: list[str]) -> None:
    """Dopisz sekcje wynikow do RESULTS.md."""
    entry = [f"## {title} ({utcnow()})"]
    entry += [f"- {ln}" for ln in lines]
    text = "\n".join(entry) + "\n\n"
    with open(RESULTS_MD, "a", encoding="utf-8") as f:
        f.write(text)
    print(f"[RESULTS.md] {title}")


def save_json(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False, default=str)


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)
