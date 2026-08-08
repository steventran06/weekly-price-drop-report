import fs from "node:fs/promises";
import path from "node:path";

import type {
  MarketStats,
} from "../marketStats/extractMarketStats.js";

import type {
  HistoricalMarketStatsSnapshot,
} from "./backfillMarketStats.js";

export interface MonthlyMarketTrend {
  area: string;

  propertyType:
    | "Single Family Residential"
    | "Condominiums"
    | "Unknown";

  reportsAvailable: number;

  firstSnapshotDate: string;
  lastSnapshotDate: string;

  startingInventory: number | null;
  endingInventory: number | null;
  inventoryChange: number | null;
  averageInventory: number | null;

  startingPendingRatio: number | null;
  endingPendingRatio: number | null;
  pendingRatioChange: number | null;
  averagePendingRatio: number | null;

  startingSoldDom: number | null;
  endingSoldDom: number | null;
  soldDomChange: number | null;
  averageSoldDom: number | null;

  startingAverageSalePrice: number | null;
  endingAverageSalePrice: number | null;
  averageSalePrice: number | null;

  startingActiveListings: number | null;
  endingActiveListings: number | null;
  activeListingsChange: number | null;
  averageActiveListings: number | null;

  startingPendingListings: number | null;
  endingPendingListings: number | null;
  pendingListingsChange: number | null;
  averagePendingListings: number | null;
}

export interface MonthlyMarketAnalysis {
  year: number;
  month: number;
  monthName: string;

  reportsAvailable: number;
  snapshotDates: string[];

  markets: MonthlyMarketTrend[];

  singleFamilyMarkets:
    MonthlyMarketTrend[];

  condoMarkets:
    MonthlyMarketTrend[];

  highestEndingSingleFamilyInventory:
    MonthlyMarketTrend[];

  lowestEndingSingleFamilyInventory:
    MonthlyMarketTrend[];

  largestSingleFamilyInventoryIncreases:
    MonthlyMarketTrend[];

  largestSingleFamilyInventoryDecreases:
    MonthlyMarketTrend[];

  longestSingleFamilySoldDom:
    MonthlyMarketTrend[];

  shortestSingleFamilySoldDom:
    MonthlyMarketTrend[];

  largestSingleFamilyPendingRatioDrops:
    MonthlyMarketTrend[];

  largestSingleFamilyPendingRatioIncreases:
    MonthlyMarketTrend[];

  highestEndingCondoInventory:
    MonthlyMarketTrend[];

  largestCondoInventoryIncreases:
    MonthlyMarketTrend[];
}

export async function analyzeMonthlyMarketStats(
  year: number,
  month: number,
): Promise<MonthlyMarketAnalysis> {
  const snapshots =
    await loadMonthlySnapshots(
      year,
      month,
    );

  if (
    snapshots.length === 0
  ) {
    throw new Error(
      `No historical market-stat snapshots found for ${year}-${String(
        month,
      ).padStart(2, "0")}.`,
    );
  }

  const sortedSnapshots =
    [...snapshots].sort(
      (a, b) =>
        a.snapshotDate.localeCompare(
          b.snapshotDate,
        ),
    );

  const groupedMarkets =
    groupMarkets(
      sortedSnapshots,
    );

  const markets =
    [...groupedMarkets.values()]
      .map(
        (records) =>
          createMonthlyTrend(
            records,
          ),
      )
      .sort(
        (a, b) => {
          const areaCompare =
            a.area.localeCompare(
              b.area,
            );

          if (
            areaCompare !== 0
          ) {
            return areaCompare;
          }

          return a.propertyType.localeCompare(
            b.propertyType,
          );
        },
      );

  const singleFamilyMarkets =
    markets.filter(
      (market) =>
        market.propertyType ===
        "Single Family Residential",
    );

  const condoMarkets =
    markets.filter(
      (market) =>
        market.propertyType ===
        "Condominiums",
    );

  const monthName =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month: "long",
        timeZone: "UTC",
      },
    ).format(
      new Date(
        Date.UTC(
          year,
          month - 1,
          1,
        ),
      ),
    );

  const analysis:
    MonthlyMarketAnalysis = {
      year,
      month,
      monthName,

      reportsAvailable:
        sortedSnapshots.length,

      snapshotDates:
        sortedSnapshots.map(
          (snapshot) =>
            snapshot.snapshotDate,
        ),

      markets,

      singleFamilyMarkets,

      condoMarkets,

      highestEndingSingleFamilyInventory:
        takeHighest(
          singleFamilyMarkets,
          (market) =>
            market.endingInventory,
          5,
        ),

      lowestEndingSingleFamilyInventory:
        takeLowest(
          singleFamilyMarkets,
          (market) =>
            market.endingInventory,
          5,
        ),

      largestSingleFamilyInventoryIncreases:
        takeHighest(
          singleFamilyMarkets,
          (market) =>
            market.inventoryChange,
          5,
        ),

      largestSingleFamilyInventoryDecreases:
        takeLowest(
          singleFamilyMarkets,
          (market) =>
            market.inventoryChange,
          5,
        ),

      longestSingleFamilySoldDom:
        takeHighest(
          singleFamilyMarkets,
          (market) =>
            market.endingSoldDom,
          5,
        ),

      shortestSingleFamilySoldDom:
        takeLowest(
          singleFamilyMarkets,
          (market) =>
            market.endingSoldDom,
          5,
        ),

      largestSingleFamilyPendingRatioDrops:
        takeLowest(
          singleFamilyMarkets,
          (market) =>
            market.pendingRatioChange,
          5,
        ),

      largestSingleFamilyPendingRatioIncreases:
        takeHighest(
          singleFamilyMarkets,
          (market) =>
            market.pendingRatioChange,
          5,
        ),

      highestEndingCondoInventory:
        takeHighest(
          condoMarkets,
          (market) =>
            market.endingInventory,
          5,
        ),

      largestCondoInventoryIncreases:
        takeHighest(
          condoMarkets,
          (market) =>
            market.inventoryChange,
          5,
        ),
    };

  return analysis;
}

async function loadMonthlySnapshots(
  year: number,
  month: number,
): Promise<
  HistoricalMarketStatsSnapshot[]
> {
  const directory =
    path.join(
      process.cwd(),
      "data",
      "market-stats",
      String(year),
    );

  let filenames: string[];

  try {
    filenames =
      await fs.readdir(
        directory,
      );
  } catch (
    error: unknown
  ) {
    if (
      isNodeError(error) &&
      error.code === "ENOENT"
    ) {
      return [];
    }

    throw error;
  }

  const prefix =
    `${year}-${String(
      month,
    ).padStart(2, "0")}-`;

  const monthlyFiles =
    filenames
      .filter(
        (filename) =>
          filename.startsWith(
            prefix,
          ) &&
          filename.endsWith(
            ".json",
          ),
      )
      .sort();

  const snapshots:
    HistoricalMarketStatsSnapshot[] =
    [];

  for (
    const filename
    of monthlyFiles
  ) {
    const fullPath =
      path.join(
        directory,
        filename,
      );

    const raw =
      await fs.readFile(
        fullPath,
        "utf8",
      );

    const parsed =
      JSON.parse(
        raw,
      ) as HistoricalMarketStatsSnapshot;

    if (
      !parsed.snapshotDate ||
      !parsed.report ||
      !Array.isArray(
        parsed.report.markets,
      )
    ) {
      console.warn(
        `Skipping invalid historical snapshot: ${fullPath}`,
      );

      continue;
    }

    snapshots.push(
      parsed,
    );
  }

  return snapshots;
}

interface MarketRecord {
  snapshotDate: string;
  market: MarketStats;
}

function groupMarkets(
  snapshots:
    HistoricalMarketStatsSnapshot[],
): Map<
  string,
  MarketRecord[]
> {
  const grouped =
    new Map<
      string,
      MarketRecord[]
    >();

  for (
    const snapshot
    of snapshots
  ) {
    for (
      const market
      of snapshot.report.markets
    ) {
      const key =
        createMarketKey(
          market,
        );

      const existing =
        grouped.get(key) ??
        [];

      existing.push({
        snapshotDate:
          snapshot.snapshotDate,

        market,
      });

      grouped.set(
        key,
        existing,
      );
    }
  }

  for (
    const records
    of grouped.values()
  ) {
    records.sort(
      (a, b) =>
        a.snapshotDate.localeCompare(
          b.snapshotDate,
        ),
    );
  }

  return grouped;
}

function createMarketKey(
  market: MarketStats,
): string {
  return [
    market.area.trim().toLowerCase(),

    market.propertyType
      .trim()
      .toLowerCase(),
  ].join("::");
}

function createMonthlyTrend(
  records: MarketRecord[],
): MonthlyMarketTrend {
  const first =
    records[0];

  const last =
    records[
      records.length - 1
    ];

  return {
    area:
      first.market.area,

    propertyType:
      first.market.propertyType,

    reportsAvailable:
      records.length,

    firstSnapshotDate:
      first.snapshotDate,

    lastSnapshotDate:
      last.snapshotDate,

    startingInventory:
      first.market.monthsOfInventory,

    endingInventory:
      last.market.monthsOfInventory,

    inventoryChange:
      subtractNullable(
        last.market.monthsOfInventory,
        first.market.monthsOfInventory,
      ),

    averageInventory:
      averageNullable(
        records.map(
          (record) =>
            record.market.monthsOfInventory,
        ),
      ),

    startingPendingRatio:
      first.market.pendingActiveRatio,

    endingPendingRatio:
      last.market.pendingActiveRatio,

    pendingRatioChange:
      subtractNullable(
        last.market.pendingActiveRatio,
        first.market.pendingActiveRatio,
      ),

    averagePendingRatio:
      averageNullable(
        records.map(
          (record) =>
            record.market.pendingActiveRatio,
        ),
      ),

    startingSoldDom:
      first.market.averageDaysOnMarketSold,

    endingSoldDom:
      last.market.averageDaysOnMarketSold,

    soldDomChange:
      subtractNullable(
        last.market.averageDaysOnMarketSold,
        first.market.averageDaysOnMarketSold,
      ),

    averageSoldDom:
      averageNullable(
        records.map(
          (record) =>
            record.market.averageDaysOnMarketSold,
        ),
      ),

    startingAverageSalePrice:
      first.market.averageSalePrice,

    endingAverageSalePrice:
      last.market.averageSalePrice,

    averageSalePrice:
      averageNullable(
        records.map(
          (record) =>
            record.market.averageSalePrice,
        ),
      ),

    startingActiveListings:
      first.market.activeListings,

    endingActiveListings:
      last.market.activeListings,

    activeListingsChange:
      subtractNullable(
        last.market.activeListings,
        first.market.activeListings,
      ),

    averageActiveListings:
      averageNullable(
        records.map(
          (record) =>
            record.market.activeListings,
        ),
      ),

    startingPendingListings:
      first.market.pendingListings,

    endingPendingListings:
      last.market.pendingListings,

    pendingListingsChange:
      subtractNullable(
        last.market.pendingListings,
        first.market.pendingListings,
      ),

    averagePendingListings:
      averageNullable(
        records.map(
          (record) =>
            record.market.pendingListings,
        ),
      ),
  };
}

function averageNullable(
  values:
    Array<number | null>,
): number | null {
  const validValues =
    values.filter(
      (
        value,
      ): value is number =>
        value !== null &&
        Number.isFinite(
          value,
        ),
    );

  if (
    validValues.length === 0
  ) {
    return null;
  }

  const total =
    validValues.reduce(
      (
        sum,
        value,
      ) =>
        sum + value,
      0,
    );

  return round(
    total /
      validValues.length,
    2,
  );
}

function subtractNullable(
  ending: number | null,
  starting: number | null,
): number | null {
  if (
    ending === null ||
    starting === null
  ) {
    return null;
  }

  return round(
    ending - starting,
    2,
  );
}

function takeHighest(
  markets:
    MonthlyMarketTrend[],
  selector:
    (
      market:
        MonthlyMarketTrend,
    ) => number | null,
  limit: number,
): MonthlyMarketTrend[] {
  return markets
    .filter(
      (market) =>
        selector(
          market,
        ) !== null,
    )
    .sort(
      (a, b) =>
        (
          selector(b) ??
          Number.NEGATIVE_INFINITY
        ) -
        (
          selector(a) ??
          Number.NEGATIVE_INFINITY
        ),
    )
    .slice(
      0,
      limit,
    );
}

function takeLowest(
  markets:
    MonthlyMarketTrend[],
  selector:
    (
      market:
        MonthlyMarketTrend,
    ) => number | null,
  limit: number,
): MonthlyMarketTrend[] {
  return markets
    .filter(
      (market) =>
        selector(
          market,
        ) !== null,
    )
    .sort(
      (a, b) =>
        (
          selector(a) ??
          Number.POSITIVE_INFINITY
        ) -
        (
          selector(b) ??
          Number.POSITIVE_INFINITY
        ),
    )
    .slice(
      0,
      limit,
    );
}

function round(
  value: number,
  decimals: number,
): number {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error
  );
}