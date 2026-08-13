import type {
  ExtractedMarketStats,
  MarketStatsRegion,
} from "./extractMarketStats.js";

export interface RegionalMarketStatsValidation {
  usable: boolean;
  reasons: string[];
}

export function validateRegionalMarketStats(
  stats: ExtractedMarketStats,
  region: MarketStatsRegion,
): RegionalMarketStatsValidation {
  const reasons:
    string[] = [];

  if (
    stats.markets.length ===
    0
  ) {
    reasons.push(
      "no market rows were extracted",
    );
  }

  const unknownAreas =
    stats.markets.filter(
      (market) =>
        !market.area ||
        market.area ===
          "Unknown Area",
    );

  if (
    unknownAreas.length >
    0
  ) {
    reasons.push(
      `${unknownAreas.length} market row(s) have an unknown area`,
    );
  }

  const unknownPropertyTypes =
    stats.markets.filter(
      (market) =>
        market.propertyType ===
        "Unknown",
    );

  if (
    unknownPropertyTypes.length >
    0
  ) {
    reasons.push(
      `${unknownPropertyTypes.length} market row(s) have an unknown property type`,
    );
  }

  const wrongRegion =
    stats.markets.filter(
      (market) =>
        market.sourceRegion !==
        region,
    );

  if (
    wrongRegion.length >
    0
  ) {
    reasons.push(
      `${wrongRegion.length} market row(s) are not tagged as ${region}`,
    );
  }

  if (
    Array.isArray(
      stats.failedPages,
    ) &&
    stats.failedPages.length >
      0
  ) {
    reasons.push(
      `${stats.failedPages.length} PDF page(s) failed to parse`,
    );
  }

  if (
    typeof stats.pageCount ===
      "number" &&
    stats.pageCount > 0 &&
    stats.markets.length !==
      stats.pageCount
  ) {
    reasons.push(
      `parsed ${stats.markets.length} of ${stats.pageCount} PDF page(s)`,
    );
  }

  return {
    usable:
      reasons.length ===
      0,

    reasons,
  };
}
