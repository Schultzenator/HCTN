// Deterministic household state + planning core for the Household Ops MCP server.
// No external services, no secrets: the whole demo is self-contained.

export interface Chore { name: string; minutesPerWeek: number; }
export interface CatalogMovie { title: string; genres: string[]; minutes: number; mood: string; minAge: number; }
export interface ShoppingItem { item: string; quantity: number; addedBy: string; addedAt: string; }
export interface MoviePick { pick: CatalogMovie; reason: string; snack: string; backup: CatalogMovie | null; }

const CATALOG: CatalogMovie[] = [
  { title: "Signal to Noise", genres: ["scifi", "adventure"], minutes: 118, mood: "uplifting", minAge: 8 },
  { title: "The Ledger of Small Hours", genres: ["drama"], minutes: 126, mood: "thoughtful", minAge: 13 },
  { title: "Night of the Comet Market", genres: ["comedy", "family"], minutes: 97, mood: "playful", minAge: 0 },
  { title: "Deep Field", genres: ["documentary", "space"], minutes: 45, mood: "calm", minAge: 0 },
  { title: "Loop & Return", genres: ["animation", "family"], minutes: 88, mood: "cozy", minAge: 0 },
  { title: "Pressure Drop", genres: ["thriller", "drama"], minutes: 131, mood: "tense", minAge: 16 },
  { title: "The Quiet Frequency", genres: ["scifi", "drama"], minutes: 104, mood: "thoughtful", minAge: 12 },
  { title: "Market Day Mars", genres: ["animation", "comedy"], minutes: 76, mood: "playful", minAge: 0 },
];

const SNACKS = [
  "popcorn with smoked salt",
  "frozen grapes",
  "dark chocolate and walnuts",
  "tortilla chips and salsa",
  "apple slices with cinnamon",
];

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export class HouseholdState {
  members: string[] = ["Alex", "Sam", "Jules"];
  chores: Chore[] = [
    { name: "kitchen reset", minutesPerWeek: 70 },
    { name: "laundry cycle", minutesPerWeek: 60 },
    { name: "trash & recycling", minutesPerWeek: 30 },
    { name: "floor sweep", minutesPerWeek: 45 },
  ];
  shoppingList: ShoppingItem[] = [];
  choreRoster: Record<string, Record<string, string>> = {};

  reset(): void {
    this.shoppingList = [];
    this.choreRoster = {};
  }

  addItem(item: string, quantity: number, addedBy = "alexa+"): ShoppingItem {
    const existing = this.shoppingList.find((s) => s.item.toLowerCase() === item.toLowerCase());
    if (existing) {
      existing.quantity += quantity;
      existing.addedAt = new Date().toISOString();
      return existing;
    }
    const entry: ShoppingItem = { item, quantity, addedBy, addedAt: new Date().toISOString() };
    this.shoppingList.push(entry);
    return entry;
  }

  assignChores(weekStart?: string): Record<string, string> {
    const base = weekStart ? new Date(weekStart + "T00:00:00Z") : new Date();
    const week = isoWeekNumber(base);
    const assignments: Record<string, string> = {};
    this.chores.forEach((chore, i) => {
      const member = this.members[(i + week) % this.members.length];
      assignments[chore.name] = member;
    });
    const key = weekStart ?? ("week-" + week + "-" + base.getUTCFullYear());
    this.choreRoster[key] = assignments;
    return assignments;
  }

  planMovieNight(genre?: string, maxMinutes?: number): MoviePick | { error: string } {
    const cap = maxMinutes ?? 130;
    // Family-room default: keep picks kid-safe.
    let pool = CATALOG.filter((m) => m.minutes <= cap && m.minAge <= 12);
    if (genre) pool = pool.filter((m) => m.genres.includes(genre.toLowerCase()));
    if (pool.length === 0) {
      return { error: "No family-safe title fits genre=" + (genre ?? "any") + " under " + cap + " minutes. Try relaxing one constraint." };
    }
    const seed = stableHash((genre ?? "any") + "|" + cap + "|" + pool.length);
    const pick = pool[seed % pool.length];
    const backup = pool.length > 1 ? pool[(seed + 1) % pool.length] : null;
    const snack = SNACKS[seed % SNACKS.length];
    const reason = '"' + pick.title + '" (' + pick.minutes + " min, " + pick.mood + ", " + pick.genres.join("/") + ") fits the " + cap + "-minute window and is family-safe.";
    return { pick, reason, snack, backup };
  }

  summary(): Record<string, unknown> {
    const latestWeek = Object.keys(this.choreRoster).pop();
    return {
      members: this.members,
      shoppingList: this.shoppingList,
      shoppingListCount: this.shoppingList.length,
      chores: this.chores.map((c) => c.name),
      choreRoster: latestWeek ? { [latestWeek]: this.choreRoster[latestWeek] } : {},
      catalogSize: CATALOG.length,
    };
  }
}

export const household = new HouseholdState();
