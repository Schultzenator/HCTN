# Opportunity Radar — final submission kit

Stan na 27.10.2026: materiały lokalne gotowe. **Zgłoszenie online: NIE WYSŁANO.** Publikację filmu, push i wysłanie wykonuje PW.

## Termin i formularz

- Termin operacyjny PW: **27.10.2026 23:45 UTC = 28.10.2026 00:45 Europe/Warsaw**.
- Oficjalna strona, sprawdzona 27.10.2026, pokazuje 23:59 UTC. Zachowujemy wcześniejszy termin 23:45 UTC jako bufor.
- [Wydarzenie i regulamin](https://hackathon.genai.works/event/open-agent-hackathon-2026).
- [Logowanie HackOS](https://hackathon.genai.works/sign-in). Po zalogowaniu otwórz workspace wydarzenia i formularz zgłoszenia. Dokładne pola i limity należy sprawdzić w formularzu.

## Dane do formularza

| Pole | Wartość |
| --- | --- |
| Project name | Opportunity Radar |
| Primary track | Track 01 — Solving Fragmented Intelligence |
| Tagline | Turn fragmented opportunity listings into one evidence-backed, ranked brief. |
| Team | Agent Foundry |
| Team member | Piotr Szutt — solo builder |
| GitHub repository | https://github.com/Schultzenator/HCTN |
| Project / README | https://github.com/Schultzenator/HCTN/tree/main/open-agent-hackathon-2026 |
| Description | Dwa akapity EN poniżej |
| Demo video URL | **[PW: WSTAW PUBLICZNY LUB UNLISTED LINK YOUTUBE PO UPLOADZIE]** |
| Demo file | [opportunity-radar-demo.mp4](open-agent-hackathon-2026/opportunity-radar-demo.mp4) — 90 s, 1920×1080, 30 fps, angielskie podpisy, bez narracji |
| Slides URL | **[PW: WSTAW LINK DO OPUBLIKOWANEGO HTML/PDF]** |
| Slides content | [SUBMISSION-SLIDES.md](SUBMISSION-SLIDES.md) — pełna treść wszystkich 9 slajdów w Marp Markdown |
| Slides viewer | [SUBMISSION-SLIDES.html](SUBMISSION-SLIDES.html) — samodzielny HTML, bez zasobów zewnętrznych |
| Slides PDF | [SUBMISSION-SLIDES.pdf](SUBMISSION-SLIDES.pdf) — wersja do uploadu |
| Sponsor explanation | Gotowy tekst EN poniżej |
| Pre-existing components | Implementacja 77a0e64 z 21.10.2026, przed oknem 22–27.10. Ujawnić w formularzu |
| Colab | N/A — Node.js / TypeScript CLI |

Lokalny origin wskazuje `/home/schultze/Factory/HCTN`. Nie zmieniono remote ani nie wykonano push. Linki GitHub odnoszą się do istniejącego repo; nowe materiały wymagają publikacji przez PW i sprawdzenia dostępu bez logowania.

## Description (EN, ready to paste)

Opportunity Radar helps developers find relevant hackathons, bounties and open-source opportunities without manually comparing fragmented listings. It federates source records, normalizes evidence URLs and merges connected duplicates while retaining source attribution. Opportunities without valid HTTP(S) evidence links are excluded before ranking. The result is a profile-based Markdown brief with scores, explanations and provenance links, giving users a clear starting point for reviewing the original sources.

The project is a strict TypeScript/Node.js CLI and library with pluggable source and model interfaces. Its reproducible offline demo turns eight synthetic records into six deduplicated opportunities and five evidence-backed recommendations; all 20 tests pass. Live mode supports GitHub issue search with a disclosed fixture fallback. An OpenAI-compatible adapter provides a configuration point for external ranking, including a provisioned Meterless/Nemotron endpoint, but no actual Meterless/Nemotron execution has been verified. Zetaris integration is not implemented. The current build demonstrates the fragmented-intelligence workflow, with sponsor integration remaining incomplete.

## Sponsor technology explanation (EN, ready to paste)

**Meterless and NVIDIA Nemotron.** We implemented a generic OpenAI-compatible ModelProvider adapter in `open-agent-hackathon-2026/src/llm/openai.ts`. It sends a POST request to `{MODEL_BASE_URL}/chat/completions` using `MODEL_API_KEY` and the exact `MODEL_NAME` supplied by the provisioned service. This is a configuration and provisioning point for a compatible Meterless-hosted NVIDIA Nemotron endpoint, not evidence of a completed Meterless or NVIDIA integration. No sponsor endpoint or model identifier is hardcoded. The adapter has a 30-second timeout, requests JSON text output, and the ranking layer validates IDs, coverage, finite scores in [0,100] and nonempty explanations. Contract tests use fake HTTP fetchers. We have not provisioned or executed a verified Meterless/Nemotron call, and we do not claim measured NVIDIA performance, model quality or sponsor infrastructure usage. The demo uses a deterministic mock with no external LLM. Meterless prompt-library integration is not implemented.

To complete this integration, we need account-issued endpoint configuration and credentials, a verified Nemotron model identifier, and a real successful request with a redacted execution record and validated report. Eligible opportunity descriptions, evidence links and the profile would be sent to that configured endpoint. Actual compatibility must be confirmed against the provisioned service.

**Zetaris.** There is no Zetaris connector, query execution or deployed federated view in this build. The exported SourceProvider interface is an architectural extension point only. A future connector would query a real Zetaris view, map rows into normalized Opportunity records with stable IDs and provenance, and feed the existing deduplication and evidence gate. A real data connection, implemented connector and execution evidence are still missing. Local federation across fixture providers must not be presented as Zetaris usage.

**Cursor.** Cursor was not used. We claim no Cursor usage, integration or sponsor bonus.

**Current compliance status.** Required sponsor integrations are incomplete. This submission kit discloses that limitation and does not establish eligibility or compliance with sponsor requirements. PW must retain these disclosures in the entry and resolve eligibility with the organizer if necessary.

## Pre-existing components disclosure (EN)

The core Opportunity Radar implementation was committed on 21 October 2026 at 08:58:18 +02:00 as `77a0e6422165ed328fa071ff4f470426810601e1`, before the 22–27 October build window. It includes the TypeScript CLI/library, fixture datasets, federation, deduplication, evidence gate, mock ranking, OpenAI-compatible adapter and tests. Dependencies include TypeScript and Node.js type definitions. Work added on 27 October consists of a reproducible captioned demo video, a nine-slide deck and submission documentation. These materials do not change the implementation date or complete sponsor integrations. Organizer confirmation is needed for eligibility and the appropriate track.

## Slajdy i film

Deck zawiera: problem i użytkowników, wynik 8/6/5, przepływ i stack, widok rzeczywistego raportu, ranking i ograniczenia evidence, testy i zakres live, uczciwy status sponsorów oraz dalszy rozwój i ujawnienie wcześniejszego kodu. Cała treść znajduje się w jednym `SUBMISSION-SLIDES.md`.

Film to montaż renderowanych stron rzeczywistego outputu `npm run demo`, przewijanych przez kolejne rekomendacje, zmiany profilu na `design` oraz wyniku `npm test`. Podpisy objaśniają przepływ, deduplikację i evidence. Ostatnia plansza ujawnia status sponsorów i wcześniejszy kod. To odtwarzalna prezentacja outputu terminala, bez symulowania sponsor API ani nagrania live. Skrypt i surowe outputy: [submission/](open-agent-hackathon-2026/submission/).

Odtworzenie filmu: `python3 open-agent-hackathon-2026/submission/build-video.py` (Pillow, Node/npm, ffmpeg; ścieżkę ffmpeg można podać przez `FFMPEG`).

Odtworzenie slajdów:

```bash
bash open-agent-hackathon-2026/submission/build-slides.sh
```

## Pozostałe kroki PW

- [ ] Upload gotowego MP4 na osobne konto YouTube. Wstaw URL powyżej i sprawdź odtwarzanie bez logowania.
- [ ] Opublikuj deck HTML lub wgraj PDF. Wstaw publiczny link powyżej. Lokalna ścieżka nie jest linkiem dla sędziów.
- [ ] Opublikuj nowe materiały na GitHub, jeśli mają być dostępne w repo. To zadanie kończy się lokalnym commitem.
- [ ] Zaloguj się do HackOS, potwierdź solo Piotr Szutt / Agent Foundry i właściwy track.
- [ ] Zachowaj ujawnienie wcześniejszego kodu i braków sponsorów. Nie deklaruj wykonanych integracji.
- [ ] Wklej opis, sponsor explanation i linki, sprawdź wszystkie wymagane pola oraz dostęp do repo bez logowania.
- [ ] Wyślij przed terminem operacyjnym, sprawdź status Submitted i zapisz URL oraz czas potwierdzenia.

Końcowy URL zgłoszenia: **[PW: DO UZUPEŁNIENIA PO WYSŁANIU]**. Potwierdzenie wysyłki: **BRAK**.

## Weryfikacja lokalna

27.10.2026: `npm test` 20/20 pass, `npm run typecheck` exit 0, `npm run demo` wynik 8/6/5. Testy HTTP używają atrap. Weryfikacja filmu, decka i commit są opisane w [WORK-STATE.md](WORK-STATE.md). Commit zestawu jest dostarczony w `submission-kit.bundle`: `git bundle list-heads submission-kit.bundle`. Standardowy commit w tym checkoutcie blokuje montowanie `.git` tylko do odczytu. Osobny lokalny commit ma dotychczasowy HEAD jako rodzica; bieżący HEAD i indeks nie zostały zmienione. Bundle należy zaimportować w checkoutcie z zapisywalnym `.git`.

Ten plik w repo zastępuje dla tego zestawu wcześniejszy handoff `../SUBMISSION-GENAI.md`, którego nie modyfikowano. Nie wykonano rejestracji, wysyłki online ani push.
