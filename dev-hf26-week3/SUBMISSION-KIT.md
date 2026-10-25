# WORK-STATE

- Status: COMPLETE (do publikacji; remaining manual steps patrz sekcja 6)
- Updated: 2026-10-22
- Deadline: publikacja do **2026-10-25 12:00 CET**; zamkniecie challenge 2026-10-25 23:59 PDT (= 2026-10-26 08:59 czasu PL)

---

# SUBMISSION-KIT — jak opublikowac zgloszenie (dla PW)

Cel: zgloszenie DEV Hacktoberfest Week 3 "Slow and Steady" 2026, projekt
**Tortoise** (katalog `dev-hf26-week3/`), post `POST-DEV.md`.

## 1. Zawartosc pakietu

| Plik | Rola |
|---|---|
| `POST-DEV.md` | gotowy draft posta na DEV (frontmatter + tresc; ~2100 slow) |
| `RESEARCH.md` | research challengeu + itemy DO WERYFIKACJI PRZED PUBLIKACJA |
| `README.md` | readme projektu (instalacja/uzycie) |
| `examples/` | backlog.md + plan-sample.md (dokladny output demo) |
| `src/`, `test/` | kod + testy (43 asercje, zero zaleznosci) |

## 2. KROK ZERO — weryfikacja regulaminu (obowiazkowe, ~10 min)

W tej sesji srodowisko zablokowalo dostep do sieci, wiec ponizsze punkty
NIE zostaly zweryfikowane online. Przed publikacja PW otwiera
`https://dev.to/challenges/hacktoberfest-week3-2026-10-19` i sprawdza:

1. **Official Rules** (link na stronie challengeu):
   - czy projekt musi powstac w oknie tygodnia (od 19.10) — jesli NIE, mozna rozwayzyc tez zgloszenie istniejacego projektu; Tortoise powstal w oknie (22.10), wiec jest bezpieczny przy obu interpretacjach;
   - wymagane tagi i limit ich liczby;
   - czy wymagany jest link do publicznego repo + dzialajacego demo;
   - czy zgloszenie = opublikowany post na dev.to z tagami, czy dodatkowo formularz.
2. **Template submission** — ustaw strukture sekcji "Submission details" w POST-DEV.md 1:1 wg szablonu ze strony (obecna sekcja to bezpieczny standard).
3. **Tagi kategorii partnerskiej "Best Use of Gemma"** — potwierdzic wymagany tag (np. `#gemma`).
4. **Zwyciezcy Week 1-2** — 2-3 posty: struktura, dlugosc, ton; dostosowac POST-DEV.md w razie duzej rozbieznosci.
5. **Konto dev.to** — czy owner ma juz konto; **NIE rejestrowac nic nowego**, publikacja tylko na istniejacym koncie ownera.

## 3. Screenshoty (obowiazkowe przed publikacja)

W srodowisku z Node >= 22.6, w katalogu `dev-hf26-week3/`:

```bash
npm run demo                 # terminal: plan output → SCREENSHOT-1
npm test                     # terminal: 43 passed → SCREENSHOT-3 (opcjonalny)
export GEMMA_API_KEY=...     # opcjonalnie, dla "Source: gemma" z prawdziwym modelem
node --experimental-strip-types src/cli.ts plan examples/backlog.md --provider gemma --budget 120
```

- SCREENSHOT-1: terminal z `npm run demo` (output jak w `examples/plan-sample.md`).
- SCREENSHOT-2: edytor z `examples/backlog.md` obok wygenerowanego `plan-2026-10-22.md`.
- SCREENSHOT-3 (opcjonalnie): przebieg testow.
- Wgrac obrazy na dev.to przy tworzeniu posta (cover editor / drag&drop) i podmienic placeholdery `[SCREENSHOT-*]` w POST-DEV.md na wygenerowane linki `![...](...)`.
- `cover_image`: najprościej SCREENSHOT-1 lub sformatowany plan.

## 4. Publikacja na dev.to (krok po kroku)

1. Zaloguj na konto ownera dev.to.
2. "Create Post" (https://dev.to/enter).
3. Frontmatter POST-DEV.md przepisz do pol formularza (dev.to nie czyta YAML z wklejonego body — tytul do tytulu, opis do "description", obrazek do cover):
   - title: `Tortoise: I Built a Productivity Tool That Plans *Less*, Not More (with an Open-Weight Model)` — jak title nie przyjmie kursywy, usunac `*...*`: `Plans Less, Not More`.
   - tags (max 4, dev.to liczy): `hf26challenge, devchallenge, gemma, productivity` — zmienic jesli regulamin wymaga innych (KROK ZERO p.2/3).
4. Wkleic tresc posta (ponizej frontmatter — bez komentarzy HTML ani sekcji `---` YAML).
5. Podmienic placeholdery screenshotow na wgrane obrazy.
6. Sprawdzic podglad: code blocki, listy, tytul nie ucięty.
7. Jesli czas pozwala (>= 2-3 h przed 25.10 12:00 CET): najpierw "Save draft", szybka korekta, potem Publish. Nie zostawiac draftu na ostatnia minute — deadline twardy.
8. Po publikacji: sprawdzic czy tagi sie przypisaly (post widoczny pod https://dev.to/t/hf26challenge), czy repo link dziala.

## 5. Deadline — konwersja stref

| Zdarzenie | PDT | Czas PL (CET/CEST) |
|---|---|---|
| Twardy plan publikacji | 2026-10-25 ~03:00 | **2026-10-25 12:00** |
| Zamkniecie challenge | 2026-10-25 23:59 | 2026-10-26 08:59 |

Uwaga: 25.10.2026 to noc zmiany zegara w UE — szczegol bez znaczenia bo publikujemy 9+ godzin przed zamknieciem.

## 6. Remaining manual steps (PW) — checklist

- [ ] KROK ZERO: Official Rules + template + tagi + zwyciezcy W1-W2 (sekcja 2)
- [ ] Commit lokalny (w sesji zablokowany przez approval policy):
      `git add dev-hf26-week3 README.md && git commit -m "Add Tortoise - slow-and-steady daily planner with Gemma (DEV Hacktoberfest Week 3 2026)"` (NIE pushowac)
- [ ] `npm run demo` + `npm test` na maszynie z Node 22.6 (w tej sesji sie nie dalo — logike zweryfikowano w sandbox TS: 43/43 asercji OK)
- [ ] Screenshoty 1-2 (+3 opcjonalnie) i podmiana placeholderow w POSCIE
- [ ] Konto dev.to istnieje / nie tworzyc nowego
- [ ] Publikacja do 2026-10-25 12:00 CET
- [ ] Po publikacji: weryfikacja tagow i linku do repo
