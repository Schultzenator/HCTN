import { getConfig } from "./config.js";
import { HttpMetaClient, MockMetaClient } from "./meta-client.js";
import { runHouseholdOps } from "./agent.js";
import type { HouseholdInput } from "./types.js";

const config = getConfig();
const client = config.forceMock ? new MockMetaClient() : new HttpMetaClient(config);
const input: HouseholdInput = { evening: "dinner and a quick kitchen reset after work", people: 2, constraints: ["no extra shopping", "90 minutes max"], inventory: ["pasta", "vegetables", "tomato sauce"] };
const result = await runHouseholdOps(input, client);
console.log(JSON.stringify(result, null, 2));
