import dotenv from "dotenv";

import { buildWebsiteEvents } from "./buildWebsiteEvents.js";
import { publishWebsiteEvents } from "../github/publishWebsiteEvents.js";

dotenv.config();

async function main(): Promise<void> {
  console.log("================================");
  console.log(" Website Upcoming Events");
  console.log("================================");

  const events = await buildWebsiteEvents();

  console.log("");
  console.log(`Collected ${events.eventCount} upcoming event(s).`);

  const url = await publishWebsiteEvents(events);

  console.log(`Published website events: ${url}`);
}

main().catch((error: unknown) => {
  console.error("Events workflow failed:");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
