import { inspectSavedRmlsReport } from "./rmls/inspectReport.js";

async function main(): Promise<void> {
  console.log("Inspecting saved RMLS report...");

  const result = await inspectSavedRmlsReport();

  console.log("");
  console.log("Page summary");
  console.log("------------");
  console.log(`Title: ${result.title || "(no title)"}`);
  console.log(`Tables: ${result.tables}`);
  console.log(`Images: ${result.images}`);
  console.log(`Links: ${result.links}`);
  console.log(
    `Possible listing blocks: ${result.possibleListingBlocks}`,
  );

  console.log("");
  console.log("Sample text");
  console.log("-----------");

  for (const [index, text] of result.sampleText.entries()) {
    console.log(`${index + 1}. ${text}`);
  }

  console.log("");
  console.log("Sample links");
  console.log("------------");

  for (const [index, link] of result.sampleLinks.entries()) {
    console.log(
      `${index + 1}. ${link.text || "(no text)"} -> ${link.href}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error("Inspection failed:");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});