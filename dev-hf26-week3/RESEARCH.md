# WORK-STATE

- Status: COMPLETE (pakiet do publikacji; checklist manualny w SUBMISSION-KIT.md sekcja 6)
- Updated: 2026-10-22 (session dev-hf26-w3)
- Deadline: post ready by 2026-10-25 midday CET; challenge closes 2026-10-25 23:59 PDT (= 2026-10-26 08:59 CET)
- Next steps: see SUBMISSION-KIT.md, sekcja "Remaining manual steps (PW)"

---

# RESEARCH — DEV Hacktoberfest Week 3 "Slow and Steady" (2026)

## 0. Wazne zastrzezenie: blokada researchu online

W tej sesji srodowisko odrzucilo WSZYSTKIE wywolania narzedzi sieciowych
(`web_search`, `open_url` do dev.to, `curl`, konektory Gmail/GitHub/Thunderbird)
za kazdym razem przez approval callback. Research strony challengeu, Official
Rules, template'u submission i list zwyciezcow Week 1-2 **nie dal sie wykonac
online**. Wszystkie ponizsze punkty oznaczone **[DO WERYFIKACJI PRZEZ PW]**
musza zostac sprawdzone recznie przed publikacja. Niczego nie zgadlem ani nie
zmyslilem: ponizej jest tylko to, co wynika z briefu zadania i ogolnie
obowiazujacych zasad DEV.

URL-e do sprawdzenia (kolejnosc waznosci):

1. `https://dev.to/challenges/hacktoberfest-week3-2026-10-19` — strona challengeu
2. Link "Official Rules" na tej stronie (wg briefu jest tam wymaganyprojekt/okno czasowe)
3. Template submission (sekcja na stronie challengeu)
4. `https://dev.to/challenges/hacktoberfest-week2-2026-10-12` i week1 — zwyciezcy + struktura postow
5. `https://dev.to/t/hf26challenge` i `https://dev.to/t/devchallenge` — jak wygldaja realne zgloszenia

## 1. Co wiemy z briefu zadania (fakty z taska, nie z sieci)

- Challenge: DEV Hacktoberfest Week 3, theme **"Slow and Steady"** (produktywnosc).
- Nagrody: $2,850 / 21 zwyciezcow (21 nagrod lacznie; rozklad per kategoria nieznany [DO WERYFIKACJI]).
- Deadline: **25.10 23:59 PDT** = 26.10 08:59 CET. Post musi byc opublikowany przez PW wczesniej (plan: 25.10 poludnie CET).
- Wymagany: post o projekcie AI zbudowanym z **otwartymi modelami** (open-weight) + **template submission** (struktura narzucona przez organizatorow).
- Tagi: `#hf26challenge` `#devchallenge` + kategorie partnerskie, w tym **Best Use of Gemma** (nagroda za uzycie modeli Gemma / open-weight).
- Publikacja na koncie ownera dev.to; konto moze nie istniec — **nie rejestrowac nic**, przygotowac tresc.

## 2. Pytanie CRITICAL: nowy projekt czy istniejacy?

**[DO WERYFIKACJI PRZEZ PW]** — sprawdzic w Official Rules, czy projekt musi
powstac w oknie tygodnia (od 19.10), czy dopuszczalne sa projekty wczesniejsze.

**Podjeta decyzja (safe tor): budujemy NOWY mini-projekt powstaly w oknie
tygodnia.** Uzasadnienie:

- Nowy projekt jest kwalifikujacy sie w OBU interpretacjach regulaminu (nie ma ryzyka dyskwalifikacji za "stary" projekt).
- Opportunity Radar jest juz zgloszony do innego challenge (Open Agent Hackathon, genai.works) — recykling projektu na ten sam tydzien Hacktoberfesta byc moze tez naruszalby regulamin jednego-projektu-na-challenge [DO WERYFIKACJI].
- Nowy projekt od zera w 1 dzien to wlasnie theme "Slow and Steady" — maly, waski, dopracowany.

W RESEARCH.md nie ma potrzeby wracac do Opportunity Radar; zostaje nietkniety.

## 3. Struktura posta (wg briefu + praktyk zwycieskich postow DEV)

[DO WERYFIKACJI PRZEZ PW] — template submission ze strony challengeu jest
nadrzedny wzgledem tego rozdzialu. Ponizsza struktura to bezpieczny standard,
ktory pokrywa typowe elementy szablonow DEV challenge (What did you build /
How it works / Open model usage / Demo / Repo) i zostala uzyta w POST-DEV.md:

1. Hook: problem produktywnosciowy (hustle culture vs. consistency).
2. Co zbudowalem — Tortoise, jeden akapit + GIF/screenshot.
3. Dlaczego "slow and steady" — design philosophy.
4. Jak dziala — architektura, guardrails, deterministyczny fallback.
5. Uzycie otwartego modelu — Gemma (open-weight) przez API + opcja w pelni lokalna (Ollama); mock provider do testow offline.
6. Demo — przykladowe uruchomienie + wynik.
7. Repo + instrukcja instalacji.
8. Czego nie robi (scope discipline) + co dalej.
9. Template submission fields (wypelnic wg szablonu ze strony).

## 4. Zwyciezcy Week 1-2 (wzorce)

[DO WERYFIKACJI PRZEZ PW] — nie dostepne z tej sesji. Przed publikacja PW powinien
przejrzec 2-3 zwycieskie posty i sprawdzic:
- czy liczy sie dlugosc/dokladnosc techniczna vs. storytelling,
- czy zawieraja repo link + dzialajace demo (niemal na pewno tak),
- czy sa personalizowane (imieta, droga do rozwiazania).

## 5. Kategoria partnerska

Celujemy w **Best Use of Gemma** — model open-weight z rodziny Gemma, uzywany
glownie do selekcji zadan w planerze. Tagi na dev.to (max 4!):
`#hf26challenge`, `#devchallenge`, `#gemma`, oraz jeden z: `#productivity` /
`#opensource` / `#ai` — **[DO WERYFIKACJI]** czy strona challengeu wymaga
dodatkowego tagu kategorii partnerskiej (np. `#gemma`) — wtedy tym bardziej go
uzywamy.

## 6. Deadline - konwersja stref czasowych

- Zamkniecie: 2026-10-25 23:59 PDT (UTC-7) = **2026-10-26 08:59 CEST/CET** (25.10 CEST jeszcze, po 25.10 02:00... uwaga: 25.10.2026 to koniec DST w EU — zegary cofaja sie 25.10 o 03:00 do 02:00; PDT konczy DST 1.11, wiec 25.10 PDT = UTC-7).
- 25.10 23:59 PDT = 25.10 23:59 + 9h = 26.10 08:59 czasu polskiego (po zmianie zegara — i tak bezpiecznie).
- **Twardy plan wewnetrzny: post opublikowany do 25.10 12:00 CET.**
