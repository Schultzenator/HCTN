import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { findById, readAll, writeAll } from "../server/lib/triage-store.js";

export default defineAction({
  description: "Update the draft reply for one inbox item (human edits the agent's draft before approving).",
  schema: z.object({
    itemId: z.string().min(1),
    draftReply: z.string().min(1).describe("The edited draft reply."),
  }),
  http: { method: "POST" },
  run: async ({ itemId, draftReply }) => {
    const items = readAll();
    const item = findById(items, itemId);
    if (!item) fail("No inbox item with id " + itemId);
    item.draftReply = draftReply;
    writeAll(items);
    return { id: item.id, status: item.status };
  },
});
