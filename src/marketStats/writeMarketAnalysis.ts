import fs from "node:fs/promises";
import path from "node:path";
import type { MarketStatsAnalysis } from "./analyzeMarketStats.js";

export async function writeMarketAnalysis(
  analysis: MarketStatsAnalysis,
): Promise<string> {
  const outputDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
    },
  );

  const outputPath =
    path.join(
      outputDirectory,
      "market-analysis.json",
    );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      analysis,
      null,
      2,
    ),
    "utf8",
  );

  return outputPath;
}
