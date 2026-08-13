import dotenv from "dotenv";

import {
  sendTestNotification,
} from "./ntfy.js";

dotenv.config();

async function main(): Promise<void> {
  const topic =
    process.env.NTFY_TOPIC?.trim();

  if (!topic) {
    throw new Error(
      "NTFY_TOPIC is required.",
    );
  }

  await sendTestNotification({
    baseUrl:
      process.env.NTFY_BASE_URL?.trim() ||
      "https://ntfy.sh",
    topic,
  });

  console.log(
    "Test ntfy notification sent.",
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );
  process.exitCode = 1;
});
