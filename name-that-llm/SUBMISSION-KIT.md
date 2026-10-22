# SUBMISSION-KIT — jak wyslac submission na Kaggle (dla PW)

Cel: minimalna liczba klikniec przy maksymalnej pewnosci, ze submission ma wlasciwy
format. Konto: **PiotrSzutt**. Finalny submit robisz TY przez UI (zadany w TASK).

> Wazne: z tego srodowiska nie mam dostepu do sieci — czesc informacji o konkursie
> jest niezweryfikowana. Punkt 0 to 2 minuty sprawdzenia na stronie konkursu;
> reszta pipeline'u jest na to odporna (auto-detekcja formatu).

## 0. Sprawdz na stronie konkursu (2 min, wplywa na wybor sciezki)

Otworz https://www.kaggle.com/competitions/name-that-llm :

1. **Code Competition czy klasyczna?** — zakladka **Overview** lub **Rules**:
   jesli jest "Submit via Notebooks" / "Code Competition" → tylko sciezka B (nizej).
   Jesli jest przycisk "Submit Predictions" na stronie → sciezka A tez mozliwa.
2. **Evaluation** — jaka metryka i format submissionu:
   - 1 kolumna predykcji = top-1 accuracy;
   - 3 kolumny = top-3 (pipeline sam wykrywa z `sample_submission.csv`).
   - Jesli format inny niz 1 lub 3 kolumny predykcji → wyslij mi screen/wypisz
     kolumny sample_submission, dopasuje `scripts/common.py: submission_format()`.
3. **Rules → External data / pretrained models** — czy wolno uzywac offline
   pretrenowanych modeli (Kaggle Models/Datasets)? Kluczowe dla Baseline 2
   (sentence-transformers) i dalszych iteracji (duze modele).
4. **Deadline + limity submisyj dziennych** (zakladka Overview) — wpisz je w
   kalendarz; trzymaj zapas na ostatni dzien.

## 1. Przed pierwszym submitem — lokalny pipeline

Po wrzuceniu danych do `name-that-llm/data/` (instrukcja: `DODAWANIE-DANYCH.md`):

```bash
cd name-that-llm
python3 -m pip install -r requirements.txt   # raz
bash make_candidate_submissions.sh           # EDA + B1 + B2 + 3 kandydaty + walidacja
```

- Wyniki CV znajdziesz w `RESULTS.md` / `EXPERIMENTS.md`, metryki w
  `outputs/artifacts/*_meta.json`, kandydatow w `outputs/submissions/cand*.csv`
  (kazdy przelozony przez walidator formatu `scripts/05_validate_submission.py`).
- Jesli w printed output jest `SMOKE-TEST NA MOCKU` — dane realne nie zostaly
  wykryte; patrz DODAWANIE-DANYCH.md.
- Kolejnosc kandydatow wg oczekiwanej jakosci: `cand1_b1_lr.csv` (TF-IDF+LR),
  `cand3_blend6040.csv` (blend 60/40), `cand2_b2.csv` (embeddings/stylometria).
  Wybieraj wg CV, nie "na oko".

## 2A. Sciezka A — klasyczny submit CSV (jesli punkt 0.1 na to pozwala)

1. https://www.kaggle.com/competitions/name-that-llm → zakladka **Submit Predictions**.
2. Upload plik z `outputs/submissions/` (np. `cand1_b1_lr.csv`).
3. Trzymaj firme w nazwie submissionu w UI (opis), np. `PSNET b1_tfidf_lr CV=0.42`.

## 2B. Sciezka B — Code Competition (notebook submission)

1. https://www.kaggle.com/competitions/name-that-llm → **Code** → **New Notebook**.
2. **Add Input** → *Competition* → `name-that-llm` (przycisk **+** przy datasecie).
3. Wklej zawartosc `kaggle/ntllm_submission_notebook.py` jako komorki kodu
   (plik podzielony sekcjami `# %%` — 4 komorki: config+IO, wczytanie, model+CV,
   submission). Wersja offline, czysty sklearn — internet w notebooku moze byc OFF.
4. **Run All** — sprawdź, ze ostatnia komorka drukuje `submission.csv zapisany`
   oraz CV accuracy (zapisz te liczbe — porownamy z public LB).
5. **Save Version → Save & Run All (Commit)** → poczekaj na zakonczenie →
   w widoku notebooka **Submit to Competition**.
6. Po submicie: **zapisz public LB score** w EXPERIMENTS.md (kolumna Uwagi /
   komentarz pod wpisem) — to our ground truth do iteracji.

## 3. Czego oczekiwac

- CV na 4000 passazy ~18 klas: random = ~5.5%; sensowny baseline stylometryczny
  zwykle 25-60% zaleznie od tematyki passazy. Nie panikuj przy niskim LB —
  to sygnal do iteracji (n-gramy char, dluzsze konteksty, modele jezykowe offline).
- Public LB liczony na czesci testu — moze odbiegac od CV o kilka punktow.
- Jesli dzien submisyj zostal wykorzystany: zapisz `cand*.csv`, wyslij jutro.

## 4. Checklist przed wyslaniem

- [ ] Dane w `data/` wg DODAWANIE-DANYCH.md, `make_candidate_submissions.sh` przebiegl caly
- [ ] `05_validate_submission.py` zwrocil `WALIDACJA OK` dla pliku, ktory wysylasz
- [ ] Wiesz z punktu 0, czy submit idzie przez UI (A) czy notebook (B)
- [ ] Masz zapisane CV lokalne do porownania z public LB po submicie
