"""Wygeneruj syntetyczne dane w formacie konkursu (smoke-test pipeline'u).

Tworzy data/mock/{train.csv,test.csv,sample_submission.csv}:
- 18 "modeli", passaze 40-250 slow, stylometryczne odcisky palcow per klasa
  (inne rozklady dlugosci zdan, interpunkcji, slownictwa funkcji).
- Cel: weryfikacja mechaniki pipeline'u, NIE realna jakosc.

Uzycie:
    python3 scripts/00_make_mock_data.py                # domyslnie data/mock
    python3 scripts/00_make_mock_data.py --out data/mock --n-train 4000 --n-test 1000
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import numpy as np
import pandas as pd

MODELS = [
    "gpt-5.2", "gpt-5.2-mini", "claude-opus-4.6", "claude-haiku-4.5",
    "gemini-3-pro", "gemini-3-flash", "llama-4-maverick", "llama-4-scout",
    "mistral-large-3", "qwen-3-max", "deepseek-v4", "grok-4",
    "command-a-01", "kimi-k2", "glm-5", "phi-5", "gemma-3-27b", "ernie-5.0",
]

NOUNS = ("system model data text language task problem process result function structure "
         "network layer pattern feature vector example question answer response token "
         "sequence context meaning knowledge reasoning evidence method approach").split()
VERBS = ("is are was were becomes remains produces generates processes describes explains "
         "shows suggests defines analyzes evaluates transforms creates supports considers").split()
ADJ = ("complex simple large small significant notable different similar important "
       "interesting clear useful modern technical natural robust subtle").split()
CONN = ("moreover however therefore furthermore additionally meanwhile consequently "
        "nevertheless otherwise instead similarly meanwhile accordingly").split()

# odcisk palca stylistyczny per model-rodzina: (srednia dl. zdania, preferencja interpunkcji/fillerow)
def style_for(idx: int) -> dict:
    rng = random.Random(1234 + idx)
    return {
        "sent_len": rng.choice([int(rng.gauss(9, 1)), int(rng.gauss(14, 2)), int(rng.gauss(22, 3))]),
        "comma_rate": rng.uniform(0.02, 0.12),
        "semicolon_rate": rng.uniform(0.0, 0.02),
        "dash_rate": rng.uniform(0.0, 0.02),
        "connector_rate": rng.uniform(0.0, 0.06),
        "adverb_rate": rng.uniform(0.0, 0.05),
        "sig": idx,  # deterministyczny odcisk w doborze slownictwa
    }


def make_sentence(rng: random.Random, style: dict) -> str:
    n = max(3, int(rng.gauss(style["sent_len"], 3)))
    words: list[str] = []
    for j in range(n):
        r = rng.random()
        if r < style["connector_rate"] and j % 4 == 0:
            words.append(rng.choice(CONN))
        elif r < 0.35:
            words.append(rng.choice(NOUNS))
        elif r < 0.55:
            words.append(rng.choice(VERBS))
        elif r < 0.75:
            words.append(rng.choice(ADJ))
        else:
            words.append(rng.choice(NOUNS + ADJ))
    sent = " ".join(words)
    # interpunkcja jako odcisk klasy
    out = []
    for w in sent.split():
        out.append(w)
        r = rng.random()
        if r < style["comma_rate"]:
            out[-1] = w + ","
        elif r < style["comma_rate"] + style["semicolon_rate"]:
            out[-1] = w + ";"
        elif r < style["comma_rate"] + style["semicolon_rate"] + style["dash_rate"]:
            out[-1] = w + " —"
    sent = " ".join(out).replace(" ;", ";").replace(" — —", " —")
    return sent[0].upper() + sent[1:] + "."


def make_passage(rng: random.Random, model_idx: int, min_words: int = 40, max_words: int = 250) -> str:
    style = style_for(model_idx)
    target_words = rng.randint(min_words, max_words)
    sentences = []
    while sum(len(s.split()) for s in sentences) < target_words:
        sentences.append(make_sentence(rng, style))
    # odcisk klasy: lekko rozny slownik per model (deterministyczny shift)
    rng2 = random.Random(999 + model_idx)
    shift = {rng2.choice(NOUNS + ADJ): rng2.choice(NOUNS + ADJ) for _ in range(5)}
    text = " ".join(sentences)
    for a, b in shift.items():
        text = text.replace(f" {a} ", f" {b} ")
    return text


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/mock")
    ap.add_argument("--n-train", type=int, default=4000)
    ap.add_argument("--n-test", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    ids = []
    k = 0
    for i in range(args.n_train):
        midx = i % len(MODELS)
        ids.append(i)
        rows.append(make_passage(random.Random(args.seed * 100000 + i), midx))
    train = pd.DataFrame({"id": ids, "text": rows, "target": [MODELS[i % len(MODELS)] for i in range(len(rows))]})

    test_rows, test_ids = [], []
    for i in range(args.n_test):
        midx = random.Random(args.seed * 777 + i).randrange(len(MODELS))
        test_ids.append(10_000_000 + i)
        test_rows.append(make_passage(random.Random(args.seed * 555 + i), midx))
    test = pd.DataFrame({"id": test_ids, "text": test_rows})

    sample = pd.DataFrame({"id": test_ids, "target": MODELS[0]})

    train.to_csv(out_dir / "train.csv", index=False)
    test.to_csv(out_dir / "test.csv", index=False)
    sample.to_csv(out_dir / "sample_submission.csv", index=False)
    print(f"mock zapisany w {out_dir}: train={len(train)} test={len(test)} klasy={len(MODELS)}")


if __name__ == "__main__":
    main()
