import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";
import { findById, readAll, writeAll } from "../server/lib/triage-store.js";

export default defineAction({
  description: "Record the agent's triage for one inbox item: category, priority, suggested action and a draft reply for human review. Use for every pending item when triaging the queue.",
  schema: z.object({
    itemId: z.string().min(1).describe("The id of the inbox item, e.g. msg-4."),
    category: z.string().min(1).describe("Short category: refund, order status, bug report, warranty, partnership, spam, invoice, subscription, praise, wholesale, other."),
    priority: z.enum(["low", "normal", "high", "urgent"]).describe("Customer-support priority."),
    suggestedAction: z.string().min(1).describe("One short internal next step, e.g. 'refund duplicate charge via Stripe'."),
    draftReply: z.string().min(1).describe("A short, warm, concrete draft reply to the customer in the language they wrote in."),
  }),
  http: { method: "POST" },
  run: async ({ itemId, category, priority, suggestedAction, draftReply }) => {
    const items = readAll();
    const item = findById(items, itemId);
    if (!item) fail("No inbox item with id " + itemId);
    item.category = category;
    item.priority = priority;
    item.suggestedAction = suggestedAction;
    item.draftReply = draftReply;
    item.status = "reviewed";
    item.triagedAt = new Date().toISOString();
    writeAll(items);
    return { id: item.id, status: item.status, next: "The draft waits for human approval on the desk." };
  },
});
