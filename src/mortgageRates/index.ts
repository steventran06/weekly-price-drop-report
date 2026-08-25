import dotenv from "dotenv";

import {
  fetchFredMortgageRates,
} from "./fetchFredMortgageRates.js";
import {
  buildWebsiteMortgageRates,
  validateWebsiteMortgageRates,
} from "./buildWebsiteMortgageRates.js";
import {
  writeMortgageRatesPreview,
} from "./writeMortgageRates.js";
import {
  publishWebsiteMortgageRates,
} from "../github/publishWebsiteMortgageRates.js";


dotenv.config();

async function main(): Promise<void> {
  const dryRun =
    process.env.MORTGAGE_RATES_DRY_RUN ===
    "true";

  console.log(
    "================================",
  );
  console.log(
    " Optimal Blue Mortgage Rates",
  );
  console.log(
    "================================",
  );
  console.log(
    `Mode: ${dryRun ? "PREVIEW ONLY" : "PUBLISH TO WEBSITE"}`,
  );

  const series =
    await fetchFredMortgageRates();

  const data =
    buildWebsiteMortgageRates(
      series,
    );

  validateWebsiteMortgageRates(
    data,
  );

  const previewPath =
    await writeMortgageRatesPreview(
      data,
    );

  console.log("");
  console.log(
    `Saved preview: ${previewPath}`,
  );
  console.log(
    `Latest observation date: ${data.freshness.latestObservationDate}`,
  );
  console.log(
    `Oldest observation date: ${data.freshness.oldestObservationDate}`,
  );
  console.log(
    `All 17 series on same date: ${data.freshness.allSeriesSameObservationDate ? "yes" : "no"}`,
  );
  console.log("");
  console.log(
    `30Y conforming: ${data.products.conforming30.rate.toFixed(3)}% (${data.products.conforming30.observationDate})`,
  );
  console.log(
    `15Y conforming: ${data.products.conforming15.rate.toFixed(3)}% (${data.products.conforming15.observationDate})`,
  );
  console.log(
    `30Y jumbo: ${data.products.jumbo30.rate.toFixed(3)}% (${data.products.jumbo30.observationDate})`,
  );
  console.log(
    `30Y FHA: ${data.products.fha30.rate.toFixed(3)}% (${data.products.fha30.observationDate})`,
  );
  console.log(
    `30Y VA: ${data.products.va30.rate.toFixed(3)}% (${data.products.va30.observationDate})`,
  );
  console.log(
    `30Y USDA: ${data.products.usda30.rate.toFixed(3)}% (${data.products.usda30.observationDate})`,
  );

  if (dryRun) {
    console.log("");
    console.log(
      "PREVIEW ONLY: nothing was published to GitHub.",
    );
    return;
  }

  const url =
    await publishWebsiteMortgageRates(
      data,
    );

  console.log("");
  console.log(
    `Published mortgage rates: ${url}`,
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      "Mortgage-rate workflow failed:",
    );

    if (
      error instanceof Error
    ) {
      console.error(
        error.message,
      );
      console.error(
        error.stack,
      );
    } else {
      console.error(
        error,
      );
    }

    process.exitCode = 1;
  },
);
