# DODAWANIE-DANYCH — instrukcja dla PW

Cel: wypełnić `name-that-llm/data/` plikami konkursu **Name That LLM**
(https://www.kaggle.com/competitions/name-that-llm, konto **PiotrSzutt**).

## 1. Skąd pobrać

Opcja A — przycisk na stronie konkursu:
1. Zaloguj się na kaggle.com jako **PiotrSzutt**.
2. Wejdź na https://www.kaggle.com/competitions/name-that-llm
3. Zaakceptuj Rules (jeśli jeszcze nie) → zakładka **Data** → **Download All**.
4. Rozpakuj archiwum (`name-that-llm.zip` lub podobne).

Opcja B — API (wygodniejsze, z cookie/tokenem z konta):
```bash
pip install kaggle
# plik kaggle.json (Account -> Create New API Token) do ~/.kaggle/kaggle.json
kaggle competitions download -c name-that-llm -p name-that-llm/data/_download
cd name-that-llm/data && unzip _download/*.zip -d . && rm -rf _download
```

## 2. Co wrzucić

Do katalogu `name-that-llm/data/` (repo jest gitignored na zawartość — NIE commituj danych):

| Plik | Prawdopodobna nazwa | Musi być? |
|---|---|---|
| Train | `train.csv` (lub `.parquet`/`.json`) | TAK |
| Test | `test.csv` | TAK |
| Sample submission | `sample_submission.csv` | TAK |
| Opisy kolumn / metadata | np. `*.json`, opis na stronie Data | mile widziane |

Pipeline rozpoznaje też inne nazwy (`training`, `sample_sub`, itd.) i formaty
(csv/parquet/jsonl) — ale najprościej: wrzuć pliki pod kanonicznymi nazwami z zipa.

## 3. Wymagany schemat (auto-detekcja)

- **train**: kolumna tekstowa (`text`/`passage`/`content`...), kolumna id (`id`/`ID`...),
  kolumna etykiety (`target`/`label`/`model`...).
- **test**: id + tekst (etykiety ukryte).
- **sample_submission**: id + kolumna(y) predykcji. Pipeline sam wykrywa, czy
  submission ma format **top-1** (1 kolumna) czy **top-3** (3 kolumny rankowane).

Jeeli schemat odbiega od powyższych kandydatów, edytuj listy kandydatów
w `scripts/common.py` (`ID_CANDIDATES`, `TEXT_CANDIDATES`, `LABEL_CANDIDATES`)
albo zgłoś mi nazwy kolumn — dopasuję loader.

## 4. Weryfikacja po wrzuceniu

```bash
cd name-that-llm
python3 scripts/01_eda.py          # wydrukuje wykryty schemat + statystyki
```

Jeśli EDA wydrukuje `Schema OK: id/text/target, 18 klas, N=4000` — dane są gotowe
i `bash make_candidate_submissions.sh` policzy baseliny i submissiony.

## 5. Dodatkowo sprawdź na stronie konkursu (bo nie mam dostępu do sieci)

- zakładka **Evaluation** — potwierdź metrykę (accuracy?) i format submissionu;
- zakładka **Rules** — czy dozwolone pretrenowane modele offline (Kaggle Models/Datasets) — ważne dla Baseline 2;
- limity code competition (runtime, GPU, internet off) — ważne dla notebooka `kaggle/ntllm_submission_notebook.py`;
- deadline i dzienne limity submisyj.
