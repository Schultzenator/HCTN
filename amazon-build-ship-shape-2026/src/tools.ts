import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { household } from "./state.js";

function text(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function registerTools(server: McpServer): void {
  server.tool(
    "household_summary",
    "One-call morning briefing for the household: members, shared shopping list, this week's chore roster, and what the movie night planner knows.",
    {},
    async () => text(household.summary())
  );

  server.tool(
    "add_grocery_item",
    "Add an item (or bump its quantity) on the shared household shopping list.",
    {
      item: z.string().min(1).describe("Item name, e.g. 'oat milk'"),
      quantity: z.number().int().min(1).default(1).describe("How many"),
    },
    async ({ item, quantity }) => text({ ok: true, list: household.addItem(item, quantity) })
  );

  server.tool(
    "get_shopping_list",
    "Read the current shared shopping list.",
    {},
    async () => text({ items: household.shoppingList })
  );

  server.tool(
    "assign_chores",
    "Deterministically assign the weekly chore roster. Same week input => same roster; the rotation is fair across members.",
    {
      week_start: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("ISO date of the week start, e.g. 2026-10-19. Defaults to the current week."),
    },
    async ({ week_start }) => text({ week: week_start ?? "current", roster: household.assignChores(week_start) })
  );

  server.tool(
    "plan_movie_night",
    "Pick a family-safe movie for tonight from the house catalog. Deterministic: same constraints => same pick.",
    {
      genre: z.string().optional().describe("e.g. comedy, scifi, animation, family"),
      max_minutes: z.number().int().min(30).max(300).optional().describe("Time budget for tonight, default 130"),
    },
    async ({ genre, max_minutes }) => text(household.planMovieNight(genre, max_minutes))
  );
}
