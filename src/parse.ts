import { writeListingsJson } from "./output/writeListings.js";
import { parseSavedRmlsReport } from "./rmls/parseListings.js";

async function main(): Promise<void> {
  console.log("Parsing saved RMLS report...");

  const listings = await parseSavedRmlsReport();

  console.log(`Found ${listings.length} unique listing(s).`);

  for (const [index, listing] of listings.entries()) {
    console.log("");
    console.log(`${index + 1}. ${listing.address ?? "Unknown address"}`);
    console.log(`   MLS: ${listing.mlsNumber}`);
    console.log(
      `   Price: ${
        listing.currentPrice?.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }) ?? "Unknown"
      }`,
    );
    console.log(
      `   Beds: ${listing.bedrooms ?? "?"}, ` +
        `Full baths: ${listing.fullBathrooms ?? "?"}, ` +
        `Partial baths: ${listing.partialBathrooms ?? "?"}`,
    );
    console.log(`   Sqft: ${listing.squareFeet ?? "Unknown"}`);
  }

  const outputPath = await writeListingsJson(listings);

  console.log("");
  console.log(`Saved listings to: ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error("Parsing failed:");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});