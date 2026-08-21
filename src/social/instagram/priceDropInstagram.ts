import type {
  WeeklyAnalysis,
} from "../../analysis/types.js";

import type {
  RmlsListing,
} from "../../rmls/parseListings.js";

import {
  buildPriceDropCarousel,
} from "./buildPriceDropCarousel.js";

import {
  getInstagramAutomationConfig,
} from "./config.js";

import {
  renderPriceDropCarousel,
} from "./renderPriceDropCarousel.js";

import type {
  RenderedPriceDropCarousel,
} from "./priceDropTypes.js";

export async function generatePriceDropInstagramCarousel(
  analysis: WeeklyAnalysis,
  sourceListings: RmlsListing[],
): Promise<RenderedPriceDropCarousel | null> {
  const config = getInstagramAutomationConfig();

  if (!config.enabled) {
    console.log("");
    console.log(
      "Price-drop Instagram generation disabled (INSTAGRAM_ENABLED=false).",
    );
    return null;
  }

  console.log("");
  console.log(
    "Generating Portland Home Guide price-drop carousel...",
  );

  const definition = buildPriceDropCarousel(
    analysis,
    sourceListings,
  );

  const rendered = await renderPriceDropCarousel(
    definition,
    config,
  );

  console.log(
    `Price-drop carousel rendered: ${rendered.outputDirectory}`,
  );

  for (const imagePath of rendered.imagePaths) {
    console.log(`- ${imagePath}`);
  }

  console.log(
    "The generated JPEGs will be attached to the Wednesday price-drop email for manual posting.",
  );

  return rendered;
}
