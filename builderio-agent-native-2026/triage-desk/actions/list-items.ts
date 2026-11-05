import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { readAll } from "../server/lib/triage-store.js";

export default defineAction({
  description: "List support inbox items on the triage desk. Optional status filter; omit for the whole queue.",
  readOnly: true,
  mcpTool: true,
  schema: z.object({
    status: z.enum(["pending", "reviewed", "sent", "rejected"]).optional().describe("Filter by status."),
  }),
  http: { method: "GET" },
  run: async ({ status }) => {
    const items = readAll()
      .slice()
      .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
    return { items: status ? items.filter((it) => it.status === status) : items };
  },
});
