import fs from "node:fs/promises";
import path from "node:path";

import type {
  HistoricalMarketStatsSnapshot,
} from "./backfillMarketStats.js";

export interface HistoricalPriceDropSnapshot {
  snapshotDate: string;

  source: {
    reportUrl?: string;
    capturedAt?: string;
    source?: string;
  };

  listingCount: number;

  listings: unknown[];
}

export interface LoadedHistoricalMonth {
  marketStats:
    HistoricalMarketStatsSnapshot[];

  priceDrops:
    HistoricalPriceDropSnapshot[];
}

export async function loadHistoricalMonth(
  year: number,
  month: number,
): Promise<LoadedHistoricalMonth> {
  const monthPrefix =
    `${year}-${String(
      month,
    ).padStart(2, "0")}-`;

  const marketStats =
    await loadJsonFiles<
      HistoricalMarketStatsSnapshot
    >(
      "market-stats",
      year,
      monthPrefix,
    );

  const priceDrops =
    await loadJsonFiles<
      HistoricalPriceDropSnapshot
    >(
      "price-drops",
      year,
      monthPrefix,
    );

  return {
    marketStats,
    priceDrops,
  };
}

async function loadJsonFiles<T>(
  type:
    | "market-stats"
    | "price-drops",
  year: number,
  monthPrefix: string,
): Promise<T[]> {
  const directory =
    path.join(
      process.cwd(),
      "data",
      type,
      String(year),
    );

  let filenames:
    string[];

  try {
    filenames =
      await fs.readdir(
        directory,
      );
  } catch (
    error: unknown
  ) {
    if (
      isNodeError(
        error,
      ) &&
      error.code ===
        "ENOENT"
    ) {
      return [];
    }

    throw error;
  }

  const monthlyFiles =
    filenames
      .filter(
        (filename) =>
          filename.startsWith(
            monthPrefix,
          ) &&
          filename.endsWith(
            ".json",
          ),
      )
      .sort();

  const results:
    T[] = [];

  for (
    const filename
    of monthlyFiles
  ) {
    const fullPath =
      path.join(
        directory,
        filename,
      );

    try {
      const raw =
        await fs.readFile(
          fullPath,
          "utf8",
        );

      const parsed =
        JSON.parse(
          raw,
        ) as T;

      results.push(
        parsed,
      );
    } catch (
      error
    ) {
      console.warn(
        `Could not load historical file: ${fullPath}`,
      );

      console.warn(
        error,
      );
    }
  }

  return results;
}

function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error
  );
}