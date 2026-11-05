import fs from "node:fs";
import path from "node:path";

export type TriagePriority = "low" | "normal" | "high" | "urgent";
export type TriageStatus = "pending" | "reviewed" | "sent" | "rejected";

export type TriageItem = {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: TriageStatus;
  category?: string;
  priority?: TriagePriority;
  suggestedAction?: string;
  draftReply?: string;
  humanNote?: string;
  triagedAt?: string;
  closedAt?: string;
};

const dataDir = path.resolve(process.cwd(), "data");
const storePath = path.join(dataDir, "triage-items.json");

let seq = 0;

function ensureStore(): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(seedItems(), null, 2));
  }
}

function seedItems(): TriageItem[] {
  const now = Date.now();
  return [
    {
      id: "msg-1",
      from: "anna.kowalska@example.com",
      subject: "Where is my order #48213?",
      body: "Hi! I ordered a espresso grinder last Tuesday and the tracking has not moved since Wednesday. Was it shipped at all? Thanks, Anna",
      receivedAt: new Date(now - 1000 * 60 * 42).toISOString(),
      status: "pending",
    },
    {
      id: "msg-2",
      from: "marek@example.org",
      subject: "Refund for duplicate charge",
      body: "Hello, I was charged twice for order #47990 (89.90 total twice). Please refund one of the charges. Order was placed on Friday. Best regards, Marek Wolski",
      receivedAt: new Date(now - 1000 * 60 * 95).toISOString(),
      status: "pending",
    },
    {
      id: "msg-3",
      from: "partners@streamline-io.com",
      subject: "Partnership inquiry: bulk supply for offices",
      body: "Dear team, we equip coworking spaces across Poland with coffee gear. Interested in a wholesale partnership and possibly an integration with your store. Can we talk? -- Kasia, Streamline IO",
      receivedAt: new Date(now - 1000 * 60 * 130).toISOString(),
      status: "pending",
    },
  ];
}

export function readAll(): TriageItem[] {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  const items = JSON.parse(raw) as TriageItem[];
  for (const it of items) {
    const n = Number(String(it.id).replace(/[^0-9]/g, ""));
    if (Number.isFinite(n) && n > seq) seq = n;
  }
  return items;
}

export function writeAll(items: TriageItem[]): void {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(items, null, 2));
}

export function findById(items: TriageItem[], id: string): TriageItem | undefined {
  return items.find((it) => it.id === id);
}

export function nextId(): string {
  seq += 1;
  return "msg-" + String(seq);
}

const incomingPool: Array<{ from: string; subject: string; body: string }> = [
  { from: "klientka.zofia@example.com", subject: "Grinder arrived damaged", body: "The package arrived with the hopper cracked. Photos attached to this thread. What are the next steps? Zofia" },
  { from: "dev.piotr@example.net", subject: "Discount code COFFEE10 not working", body: "Hey, the code from your newsletter fails at checkout with 'invalid code'. Is it still active?" },
  { from: "no-reply@promo-blast-4u.biz", subject: "URGENT: you won a free iPh0ne", body: "Click here to claim your prize within 24 hours!!! Best offers, cheapest prices, winner winner" },
  { from: "biuro@kancelaria-grupa.pl", subject: "Invoice VAT details correction", body: "Good morning, our accounting needs the VAT number corrected on invoice FV/2026/11/04. Can you reissue? Regards, Kancelaria Grupa" },
  { from: "tomasz.b@example.com", subject: "Return window question - 33 days", body: "Hi, I want to return the kettle but it is day 33 of ownership. Your policy says 30 days. Any flexibility? It is unopened. Tomasz" },
  { from: "ops@fleetbean.co", subject: "API access for reseller integration", body: "We resell coffee equipment and would like programmatic access to your catalog (orders, stock, pricing). Do you offer an API or B2B feed?" },
  { from: "ewa@example.com", subject: "Subscription charged after cancellation", body: "I cancelled the beans subscription last month but was charged again today. Please stop the subscription and refund. Ewa" },
  { from: "honest.jan@example.org", subject: "Praise for your support team", body: "Just wanted to say Marta on your team was wonderful and solved my shipping address change instantly. Great experience, keep it up!" },
  { from: "workshop@malybarista.pl", subject: "Bulk order: 12x hand grinders for workshops", body: "We run home barista workshops and need 12 hand grinders + spare burrs. What is your best wholesale price and lead time?" },
];

export function addIncoming(count: number): TriageItem[] {
  const items = readAll();
  const receivedBase = items.length;
  const added: TriageItem[] = [];
  for (let i = 0; i < count; i++) {
    const seedIdx = (receivedBase + i) % incomingPool.length;
    const template = incomingPool[seedIdx];
    if (!template) continue;
    added.push({
      id: nextId(),
      from: template.from,
      subject: template.subject,
      body: template.body,
      receivedAt: new Date(Date.now() - 1000 * 60 * (i + 1)).toISOString(),
      status: "pending",
    });
  }
  writeAll([...items, ...added]);
  return added;
}
