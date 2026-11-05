import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { addIncoming } from "../server/lib/triage-store.js";

export default defineAction({
  description: "Simulate new customer mail arriving in the support inbox (demo helper for the triage desk).",
  schema: z.object({
    count: z.number().int().min(1).max(5).default(3).describe("How many new messages arrive."),
  }),
  http: { method: "POST" },
  run: async ({ count }) => {
    const added = addIncoming(count);
    return { added: added.length, items: added };
  },
});
