import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import type {
  ExtractedMarketStats,
} from "../../marketStats/extractMarketStats.js";

import type {
  MarketStatsAnalysis,
} from "../../marketStats/analyzeMarketStats.js";

import type {
  GeneratedMarketStatsContent,
} from "../../marketStats/generateMarketStatsContent.js";

import {
  buildMarketStatsCarousel,
} from "./buildMarketStatsCarousel.js";

import {
  getInstagramAutomationConfig,
} from "./config.js";

import {
  renderInstagramCarousel,
} from "./renderCarousel.js";

dotenv.config();

async function main(): Promise<void> {
  const baseDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
    );

  const stats =
    await readJson<ExtractedMarketStats>(
      path.join(
        baseDirectory,
        "market-stats-oregon.json",
      ),
    );

  const analysis =
    await readJson<MarketStatsAnalysis>(
      path.join(
        baseDirectory,
        "market-analysis.json",
      ),
    );

  const content =
    await readJson<GeneratedMarketStatsContent>(
      path.join(
        baseDirectory,
        "generated-content.json",
      ),
    );

  const definition =
    buildMarketStatsCarousel(
      stats,
      analysis,
      content,
    );

  const rendered =
    await renderInstagramCarousel(
      definition,
      getInstagramAutomationConfig(),
    );

  console.log("");
  console.log(
    "Instagram preview generated successfully.",
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
    const raw =
      await fs.readFile(
        filePath,
        "utf8",
      );

    return JSON.parse(
      raw,
    ) as T;
  } catch (error) {
    throw new Error(
      `Could not read ${filePath}. Run npm run market-stats first, or make sure the latest market-stats outputs are present. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Instagram preview failed:",
    );
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );
    process.exitCode = 1;
  },
);
