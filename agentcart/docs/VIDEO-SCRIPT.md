# AgentCart — Demo Video Script (< 3:00, public YouTube, English)

Hard constraints (rules): under 3 minutes, publicly visible on YouTube, English, no third-party
trademarks or copyrighted music. Only show: our app UI, our code, our terminal, and the PayPal
**sandbox** checkout flow (the sponsor's own flow, no real money).

## Target runtime: 2:45

### Act 1 — Hook (00:00–00:15)

Screen: AgentCart UI, empty chat, cursor in the goal box.
VO: *"What if you could delegate your shopping — not just the browsing, but the buying?"*

### Act 2 — What it is (00:15–00:35)

Screen: static shot of the UI; simple text overlays.
VO: *"AgentCart is an autonomous shopping agent. One sentence with a budget — it plans the cart,
negotiates a discount, creates a PayPal order, and hands you the approval. You stay in control of
the money. Everything runs on the PayPal sandbox — no real money moves."*

### Act 3 — Live demo (00:35–02:00) — the core, screen recording

Setup recorded: `npm run demo` in terminal + browser at localhost:3000. Prefer the **real sandbox mode**
(already verified E2E); fall back to mock if the sandbox account acts up on camera.

Beats (keep the event timeline visible as it animates):

1. **Type the goal**: "Set up a home office for $200" → send.
2. **Plan** event appears: budget parsed, categories chosen. VO: *"It reads the budget and plans
   which needs to cover."*
3. **Picks** stream in: desk $149, stool $39. Then three *Skipping* events. VO: *"Twelve dollars
   left — the lamp, keyboard and mouse do not fit."*
4. **Negotiation** event: merchant bot grants 5% on the desk ($149 → $141.55); keyboard unlocked,
   added at $19. VO: *"So it negotiates a bundle discount, frees the budget, and retries — total
   $199.55, inside the $200 cap."*
5. **PayPal order created** — approval link appears. Click it (sandbox checkout page, short cutaway
   to keep runtime). VO: *"The buyer approves — human in the loop exactly once, at the payment."*
6. Back in the UI: **Capture** → status COMPLETED. **Refund $19** → refund event.
   VO: *"Payment captured. And after-sales works too — partial refund, same API."*

### Act 4 — How it works (02:00–02:25)

Screen: split of the two code files (paypal/client.ts gateway + agent factory).
VO: *"Under the hood: a PayPal Orders v2 gateway with a swappable brain — a deterministic planner
by default, or an LLM tool-calling planner with your own key. The budget is enforced before any
order is created, and the app is hard-locked to the sandbox."*

### Act 5 — Close (02:25–02:45)

VO: *"Agentic commerce needs agents we can trust with money — budgets, guardrails, and one clear
approval. AgentCart is what that looks like. Repo link below — built for the PayPal AI Hackathon."*
End card: project name + repo URL (our own, no sponsor logos beyond the flow already shown).

## Production checklist

- [ ] 1080p screen recording (OBS), 60 fps, cursor highlighted
- [ ] Terminal + browser windows pre-arranged; server already running before recording
- [ ] Fresh server start (empty history) so the demo timeline is clean
- [ ] Test card / sandbox buyer account pre-logged-in to avoid checkout stalls on camera
- [ ] VO recorded separately (quiet mic), EN, ~150 wpm pace — script above ≈ 380 words
- [ ] Music: self-made or verified royalty-free; no third-party trademarks in frame
      (close other tabs, neutral desktop wallpaper, no branded products visible)
- [ ] Final cut < 2:50; upload as public (not unlisted) on YouTube; paste link into the Devpost form
- [ ] Watch the cut once with the rules checklist in hand (3 min, public, English, trademarks, music)
