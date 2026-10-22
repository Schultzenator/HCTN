# RESULTS — Name That LLM

Zbiorcze metryki baseline'ow (CV po passazach, 5-fold stratified).
Wpisy dopisywane automatycznie przez skrypty (`scripts/common.py: append_results`).

Real-data results from iteration 2 (2026-10-22). See EDA.md and EXPERIMENTS.md for data provenance and CV limitations.

---
## B1 tfidf+lr (2026-10-22 17:45 UTC)
- OOF logloss: **2.646508**
- CV accuracy: **0.1037** (+/- 0.0100)
- CV macro-F1: 0.1037
- Parametry: char(1,5)+word(1,2) min_df=2 sublinear, C=4.0, 5-fold CV
- Najczesciej mylone pary: gemini-3.8-flash -> gemini-3.7-flash: 70; gemini-3.7-flash -> gemini-3.8-flash: 65; gemini-3.6-flash -> gemini-3.7-flash: 56; gemini-3.7-flash -> gemini-3.6-flash: 50; gpt-5.6-luna -> gpt-5.6-sol: 43

