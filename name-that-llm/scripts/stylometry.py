"""Ręczne cechy stylometryczne (EDA + fallback Baseline 2).

FEATURE_NAMES ma dokładnie tyle elementów, ile zwraca stylometric_vector().
"""
from __future__ import annotations

import re

import numpy as np

_SENT_RE = re.compile(r"[^.!?]+[.!?]+|[^.!?]+$")
_WORD_RE = re.compile(r"[A-Za-z0-9']+")

FUNCTION_WORDS = list(dict.fromkeys([
    "the", "a", "an", "and", "or", "but", "if", "because", "so",
    "of", "to", "in", "on", "for", "with", "at", "by", "from", "as",
    "is", "are", "was", "were", "be", "been", "it", "its",
    "this", "that", "these", "there", "not",
    "can", "could", "will", "would", "may", "might", "must", "should",
    "we", "they", "their", "our",
    "however", "moreover", "furthermore", "additionally", "therefore", "thus",
    "importantly", "notably", "overall", "summary", "first", "finally",
]))

# (znak, nazwa cechy)
PUNCTUATION = [(c, c) for c in ".,!?;:'\"-()"] + [
    ("\u2014", "emdash"),
    ("\u2026", "ellipsis"),
]

_BASE_NAMES = [
    "n_words", "n_chars", "avg_word_len", "n_sentences", "avg_sent_len_words",
    "type_token_ratio", "long_word_ratio", "uppercase_ratio", "digit_ratio",
    "whitespace_ratio",
]

FEATURE_NAMES = (
    _BASE_NAMES
    + [f"punct_{n}" for _, n in PUNCTUATION]
    + [f"func_{w}" for w in FUNCTION_WORDS]
)


def _safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


def stylometric_vector(text: str) -> list:
    words = _WORD_RE.findall(str(text))
    lower = [w.lower() for w in words]
    n_words = len(words)
    n_chars = len(text)
    sentences = [s for s in _SENT_RE.findall(text) if s.strip()]
    counts = {}
    for w in lower:
        counts[w] = counts.get(w, 0) + 1
    feats = [
        float(n_words),
        float(n_chars),
        _safe_div(sum(len(w) for w in words), n_words),
        float(len(sentences)),
        _safe_div(n_words, len(sentences)),
        _safe_div(len(set(lower)), n_words),
        _safe_div(sum(1 for w in words if len(w) > 7), n_words),
        _safe_div(sum(1 for c in text if c.isupper()), n_chars),
        _safe_div(sum(1 for c in text if c.isdigit()), n_chars),
        _safe_div(sum(1 for c in text if c.isspace()), n_chars),
    ]
    per_k = 1000.0
    feats += [_safe_div(text.count(p) * per_k, n_chars) for p, _ in PUNCTUATION]
    feats += [_safe_div(counts.get(w, 0) * per_k, n_words) for w in FUNCTION_WORDS]
    return feats


def stylometric_features(texts) -> np.ndarray:
    return np.asarray([stylometric_vector(t) for t in texts], dtype=np.float64)
