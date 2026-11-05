import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { findById, readAll, writeAll } from "../server/lib/triage-store.js";

export default defineAction({
  description: "Reject an inbox item without sending the draft. Optional human note explaining why.",
  schema: z.object({
    itemId: z.string().min(1),
    note: z.string().optional().describe("Short internal note, e.g. 'wrong department'."),
  }),
  http: { method: "POST" },
  run: async ({ itemId, note }) => {
    const items = readAll();
    const item = findById(items, itemId);
    if (!item) fail("No inbox item with id " + itemId);
    item.status = "rejected";
    if (note) item.humanNote = note;
    item.closedAt = new Date().toISOString();
    writeAll(items);
    return { id: item.id, status: item.status };
  },
});
