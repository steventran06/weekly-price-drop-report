import type {
  ExtractedMarketStats,
  MarketStats,
} from "./extractMarketStats.js";

export interface MarketRanking {
  rank: number;

  area: string;

  propertyType:
    MarketStats["propertyType"];

  monthsOfInventory:
    number | null;

  pendingActiveRatio:
    number | null;

  averageDaysOnMarketSold:
    number | null;

  averageSalePrice:
    number | null;
}

export interface CondoVsSingleFamilyComparison {
  area: string;

  singleFamilyInventory:
    number | null;

  condoInventory:
    number | null;

  inventoryGap:
    number | null;

  singleFamilyPendingRatio:
    number | null;

  condoPendingRatio:
    number | null;

  singleFamilyDom:
    number | null;

  condoDom:
    number | null;
}

export interface MarketStatsAnalysis {
  reportDate:
    string | null;

  metroAggregate:
    MarketStats | null;

  hottestSingleFamily:
    MarketRanking[];

  strongestBuyerOpportunities:
    MarketRanking[];

  hottestCondoMarkets:
    MarketRanking[];

  strongestCondoBuyerOpportunities:
    MarketRanking[];

  fastestSingleFamilyMarkets:
    MarketRanking[];

  slowestSingleFamilyMarkets:
    MarketRanking[];

  condoVsSingleFamily:
    CondoVsSingleFamilyComparison[];

  summary: {
    totalMarketsAnalyzed:
      number;

    singleFamilyMarketsAnalyzed:
      number;

    condoMarketsAnalyzed:
      number;
  };
}

export function analyzeMarketStats(
  extracted:
    ExtractedMarketStats,
): MarketStatsAnalysis {
  const localMarkets =
    extracted.markets.filter(
      (market) =>
        market.area !==
        "Greater Portland Areas",
    );

  const singleFamilyMarkets =
    localMarkets.filter(
      (market) =>
        market.propertyType ===
        "Single Family Residential",
    );

  const condoMarkets =
    localMarkets.filter(
      (market) =>
        market.propertyType ===
        "Condominiums",
    );

  const metroAggregate =
    extracted.markets.find(
      (market) =>
        market.area ===
          "Greater Portland Areas" &&
        market.propertyType ===
          "Single Family Residential",
    ) ?? null;

  const hottestSingleFamily =
    rankMarkets(
      singleFamilyMarkets,
      compareHotMarkets,
      5,
    );

  const strongestBuyerOpportunities =
    rankMarkets(
      singleFamilyMarkets,
      compareBuyerOpportunityMarkets,
      5,
    );

  const hottestCondoMarkets =
    rankMarkets(
      condoMarkets,
      compareHotMarkets,
      5,
    );

  const strongestCondoBuyerOpportunities =
    rankMarkets(
      condoMarkets,
      compareBuyerOpportunityMarkets,
      5,
    );

  const fastestSingleFamilyMarkets =
    rankMarkets(
      singleFamilyMarkets.filter(
        (market) =>
          market.averageDaysOnMarketSold !==
          null,
      ),

      (
        a,
        b,
      ) =>
        numericAsc(
          a.averageDaysOnMarketSold,
          b.averageDaysOnMarketSold,
        ),

      5,
    );

  const slowestSingleFamilyMarkets =
    rankMarkets(
      singleFamilyMarkets.filter(
        (market) =>
          market.averageDaysOnMarketSold !==
          null,
      ),

      (
        a,
        b,
      ) =>
        numericDesc(
          a.averageDaysOnMarketSold,
          b.averageDaysOnMarketSold,
        ),

      5,
    );

  const condoVsSingleFamily =
    buildCondoVsSingleFamilyComparisons(
      singleFamilyMarkets,
      condoMarkets,
    );

  return {
    reportDate:
      findReportDate(
        extracted.markets,
      ),

    metroAggregate,

    hottestSingleFamily,

    strongestBuyerOpportunities,

    hottestCondoMarkets,

    strongestCondoBuyerOpportunities,

    fastestSingleFamilyMarkets,

    slowestSingleFamilyMarkets,

    condoVsSingleFamily,

    summary: {
      totalMarketsAnalyzed:
        localMarkets.length,

      singleFamilyMarketsAnalyzed:
        singleFamilyMarkets.length,

      condoMarketsAnalyzed:
        condoMarkets.length,
    },
  };
}

function compareHotMarkets(
  a:
    MarketStats,

  b:
    MarketStats,
): number {
  /*
   * Primary signal:
   * Lower months of inventory =
   * more competitive market.
   */
  const inventoryComparison =
    numericAsc(
      a.monthsOfInventory,
      b.monthsOfInventory,
    );

  if (
    inventoryComparison !==
    0
  ) {
    return inventoryComparison;
  }

  /*
   * Tie breaker:
   * Higher pending/active ratio =
   * stronger buyer activity.
   */
  const pendingComparison =
    numericDesc(
      a.pendingActiveRatio,
      b.pendingActiveRatio,
    );

  if (
    pendingComparison !==
    0
  ) {
    return pendingComparison;
  }

  /*
   * Final tie breaker:
   * Lower sold DOM =
   * faster-moving market.
   */
  return numericAsc(
    a.averageDaysOnMarketSold,
    b.averageDaysOnMarketSold,
  );
}

function compareBuyerOpportunityMarkets(
  a:
    MarketStats,

  b:
    MarketStats,
): number {
  /*
   * Primary signal:
   * Higher inventory =
   * more buyer choice.
   */
  const inventoryComparison =
    numericDesc(
      a.monthsOfInventory,
      b.monthsOfInventory,
    );

  if (
    inventoryComparison !==
    0
  ) {
    return inventoryComparison;
  }

  /*
   * Lower pending ratio can indicate
   * less buyer competition.
   */
  const pendingComparison =
    numericAsc(
      a.pendingActiveRatio,
      b.pendingActiveRatio,
    );

  if (
    pendingComparison !==
    0
  ) {
    return pendingComparison;
  }

  /*
   * Longer sold DOM can mean buyers
   * have more time and potentially
   * more room to negotiate.
   */
  return numericDesc(
    a.averageDaysOnMarketSold,
    b.averageDaysOnMarketSold,
  );
}

function rankMarkets(
  markets:
    MarketStats[],

  compareFn: (
    a:
      MarketStats,

    b:
      MarketStats,
  ) => number,

  limit:
    number,
): MarketRanking[] {
  return [
    ...markets,
  ]
    .filter(
      (market) =>
        market.monthsOfInventory !==
          null ||
        market.averageDaysOnMarketSold !==
          null ||
        market.pendingActiveRatio !==
          null,
    )
    .sort(
      compareFn,
    )
    .slice(
      0,
      limit,
    )
    .map(
      (
        market,
        index,
      ) => ({
        rank:
          index + 1,

        area:
          market.area,

        propertyType:
          market.propertyType,

        monthsOfInventory:
          market.monthsOfInventory,

        pendingActiveRatio:
          market.pendingActiveRatio,

        averageDaysOnMarketSold:
          market.averageDaysOnMarketSold,

        averageSalePrice:
          market.averageSalePrice,
      }),
    );
}

function buildCondoVsSingleFamilyComparisons(
  singleFamilyMarkets:
    MarketStats[],

  condoMarkets:
    MarketStats[],
): CondoVsSingleFamilyComparison[] {
  const condosByArea =
    new Map(
      condoMarkets.map(
        (market) => [
          market.area,
          market,
        ],
      ),
    );

  return singleFamilyMarkets
    .map(
      (
        singleFamily,
      ) => {
        const condo =
          condosByArea.get(
            singleFamily.area,
          );

        if (
          !condo
        ) {
          return null;
        }

        return {
          area:
            singleFamily.area,

          singleFamilyInventory:
            singleFamily.monthsOfInventory,

          condoInventory:
            condo.monthsOfInventory,

          inventoryGap:
            calculateDifference(
              condo.monthsOfInventory,
              singleFamily.monthsOfInventory,
            ),

          singleFamilyPendingRatio:
            singleFamily.pendingActiveRatio,

          condoPendingRatio:
            condo.pendingActiveRatio,

          singleFamilyDom:
            singleFamily.averageDaysOnMarketSold,

          condoDom:
            condo.averageDaysOnMarketSold,
        };
      },
    )
    .filter(
      (
        comparison,
      ): comparison is CondoVsSingleFamilyComparison =>
        comparison !==
        null,
    )
    .sort(
      (
        a,
        b,
      ) =>
        numericDesc(
          a.inventoryGap,
          b.inventoryGap,
        ),
    );
}

function calculateDifference(
  a:
    number | null,

  b:
    number | null,
): number | null {
  if (
    a ===
      null ||
    b ===
      null
  ) {
    return null;
  }

  return Number(
    (
      a -
      b
    ).toFixed(
      1,
    ),
  );
}

function findReportDate(
  markets:
    MarketStats[],
): string | null {
  let latest:
    {
      value: string;
      timestamp: number;
    } | null =
    null;

  for (const market of markets) {
    if (!market.reportDate) {
      continue;
    }

    const timestamp =
      Date.parse(
        `${market.reportDate} 00:00:00 UTC`,
      );

    if (
      Number.isNaN(
        timestamp,
      )
    ) {
      continue;
    }

    if (
      !latest ||
      timestamp >
        latest.timestamp
    ) {
      latest = {
        value:
          market.reportDate,
        timestamp,
      };
    }
  }

  return (
    latest?.value ??
    null
  );
}

function numericAsc(
  a:
    number | null,

  b:
    number | null,
): number {
  if (
    a ===
      null &&
    b ===
      null
  ) {
    return 0;
  }

  if (
    a ===
    null
  ) {
    return 1;
  }

  if (
    b ===
    null
  ) {
    return -1;
  }

  return (
    a -
    b
  );
}

function numericDesc(
  a:
    number | null,

  b:
    number | null,
): number {
  if (
    a ===
      null &&
    b ===
      null
  ) {
    return 0;
  }

  if (
    a ===
    null
  ) {
    return 1;
  }

  if (
    b ===
    null
  ) {
    return -1;
  }

  return (
    b -
    a
  );
}