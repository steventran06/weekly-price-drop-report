import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import type {
  WeeklyAnalysis,
} from "../../analysis/types.js";

import type {
  RmlsListing,
} from "../../rmls/parseListings.js";

import {
  generatePriceDropInstagramCarousel,
} from "./priceDropInstagram.js";

dotenv.config();

interface ListingsOutput {
  listings: RmlsListing[];
}

async function main(): Promise<void> {
  const outputDirectory = path.join(
    process.cwd(),
    "output",
  );

  const analysis = await readJson<WeeklyAnalysis>(
    path.join(
      outputDirectory,
      "weekly-analysis.json",
    ),
  );

  const listingsOutput = await readJson<ListingsOutput>(
    path.join(
      outputDirectory,
      "listings.json",
    ),
  );

  const rendered =
    await generatePriceDropInstagramCarousel(
      analysis,
      listingsOutput.listings,
    );

  if (!rendered) {
    throw new Error(
      "Price-drop carousel generation is disabled.",
    );
  }

  console.log("");
  console.log(
    "Price-drop carousel preview generated successfully.",
  );
  console.log(
    `Output: ${rendered.outputDirectory}`,
  );
  console.log(
    `Manifest: ${rendered.manifestPath}`,
  );
}

async function readJson<T>(
  filePath: string,
): Promise<T> {
  try {
    const raw = await fs.readFile(
      filePath,
      "utf8",
    );

    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(
      `Could not read ${filePath}. Run the weekly price-drop workflow first, or make sure the latest output files are present. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

main().catch((error) => {
  console.error("");
  console.error(
    "Price-drop carousel preview failed:",
  );
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exitCode = 1;
});
