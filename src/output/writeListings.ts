import fs from "node:fs/promises";
import path from "node:path";
import type { RmlsListing } from "../rmls/parseListings.js";

export async function writeListingsJson(
  listings: RmlsListing[],
): Promise<string> {
  const outputDirectory = path.join(process.cwd(), "output");
  const outputPath = path.join(
    outputDirectory,
    "listings.json",
  );

  await fs.mkdir(outputDirectory, {
    recursive: true,
  });

  const result = {
    generatedAt: new Date().toISOString(),
    listingCount: listings.length,
    listings,
  };

  await fs.writeFile(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf8",
  );

  return outputPath;
}