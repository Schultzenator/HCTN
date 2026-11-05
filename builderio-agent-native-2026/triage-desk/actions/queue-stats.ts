import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { readAll } from "../server/lib/triage-store.js";

export default defineAction({
  description: "Triage desk statistics: item counts per status and per category.",
  readOnly: true,
  mcpTool: true,
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    const items = readAll();
    const byStatus: Record<string, number> = { pending: 0, reviewed: 0, sent: 0, rejected: 0 };
    const byCategory: Record<string, number> = {};
    for (const it of items) {
      byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
      if (it.category) byCategory[it.category] = (byCategory[it.category] ?? 0) + 1;
    }
    return { total: items.length, byStatus, byCategory };
  },
});
