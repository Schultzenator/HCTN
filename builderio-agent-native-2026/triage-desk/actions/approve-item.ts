import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { findById, readAll, writeAll } from "../server/lib/triage-store.js";

export default defineAction({
  description: "Approve an inbox item: send the (edited) draft reply and close the item. This is the human's final call.",
  schema: z.object({
    itemId: z.string().min(1),
    finalReply: z.string().optional().describe("Optional final reply text. Defaults to the current draft."),
  }),
  http: { method: "POST" },
  run: async ({ itemId, finalReply }) => {
    const items = readAll();
    const item = findById(items, itemId);
    if (!item) fail("No inbox item with id " + itemId);
    if (!finalReply && !item.draftReply) fail("Nothing to send: no draft for " + itemId);
    if (finalReply) item.draftReply = finalReply;
    item.status = "sent";
    item.closedAt = new Date().toISOString();
    writeAll(items);
    return { id: item.id, status: item.status, sentReply: item.draftReply };
  },
});
