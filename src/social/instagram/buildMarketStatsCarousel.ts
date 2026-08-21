import type {
  GeneratedMarketStatsContent,
} from "../../marketStats/generateMarketStatsContent.js";

import type {
  CondoVsSingleFamilyComparison,
  MarketStatsAnalysis,
  MarketRanking,
} from "../../marketStats/analyzeMarketStats.js";

import type {
  ExtractedMarketStats,
  MarketStats,
} from "../../marketStats/extractMarketStats.js";

import type {
  InstagramCarouselDefinition,
  InstagramInsightCard,
  InstagramRankingRow,
} from "./types.js";

export function buildMarketStatsCarousel(
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
  content: GeneratedMarketStatsContent,
): InstagramCarouselDefinition {
  const reportDate =
    findReportDate(stats) ||
    analysis.reportDate ||
    new Date().toISOString().slice(0, 10);

  const slug =
    toDateSlug(reportDate);

  const singleFamily =
    analysis.metroAggregate;

  const condos =
    findMetroMarket(
      stats,
      "Condominiums",
    );

  const coverStory =
    buildCoverStory(
      singleFamily,
      condos,
      analysis,
      reportDate,
    );

  const slides: InstagramCarouselDefinition["slides"] = [
    {
      filename:
        "01-cover.jpg",
      layout:
        "cover",
      eyebrow:
        "THIS WEEK'S BIGGEST STORY",
      title:
        coverStory.title,
      subtitle:
        coverStory.subtitle,
      footer:
        "Local housing data, explained clearly.",
    },

    {
      filename:
        "02-metro-at-a-glance.jpg",
      layout:
        "metro",
      eyebrow:
        "GREATER PORTLAND",
      title:
        "MARKET AT A GLANCE",
      subtitle:
        "Single-family homes and condos are moving differently.",
      statLeft: {
        value:
          formatMonths(
            singleFamily?.monthsOfInventory,
          ),
        label:
          "SINGLE-FAMILY\nMONTHS OF INVENTORY",
        detail:
          formatDomDetail(
            singleFamily,
          ),
      },
      statRight: {
        value:
          formatMonths(
            condos?.monthsOfInventory,
          ),
        label:
          "CONDO\nMONTHS OF INVENTORY",
        detail:
          formatDomDetail(
            condos,
          ),
      },
      footer:
        "Source: weekly TMO market statistics",
    },

    {
      filename:
        "03-most-competitive.jpg",
      layout:
        "ranking",
      eyebrow:
        "SINGLE-FAMILY HOMES",
      title:
        "WHERE HOMES ARE\nMOVING FASTER",
      subtitle:
        "Lower inventory and shorter marketing times can mean quicker decisions for buyers.",
      rows:
        buildRankingRows(
          analysis.hottestSingleFamily,
        ),
      footer:
        "Ranked using inventory, pending activity and sold days on market.",
    },

    {
      filename:
        "04-buyer-opportunities.jpg",
      layout:
        "ranking",
      eyebrow:
        "SINGLE-FAMILY HOMES",
      title:
        "WHERE BUYERS HAVE\nMORE CHOICE",
      subtitle:
        "Higher inventory and longer marketing times can create more room to compare options.",
      rows:
        buildRankingRows(
          analysis.strongestBuyerOpportunities,
        ),
      footer:
        "Market conditions vary by price range and individual property.",
    },
  ];

  if (
    analysis.hottestCondoMarkets.length > 0
  ) {
    slides.push({
      filename:
        "05-condos-moving-faster.jpg",
      layout:
        "ranking",
      eyebrow:
        "CONDO MARKET",
      title:
        "WHERE CONDOS ARE\nMOVING FASTER",
      subtitle:
        "Even in a slower condo market overall, some areas are tighter than others.",
      rows:
        buildRankingRows(
          analysis.hottestCondoMarkets,
        ),
      footer:
        "Condo conditions can vary sharply from one submarket to another.",
    });
  }

  if (
    analysis.strongestCondoBuyerOpportunities.length > 0
  ) {
    slides.push({
      filename:
        "06-condo-buyer-opportunities.jpg",
      layout:
        "ranking",
      eyebrow:
        "CONDO MARKET",
      title:
        "WHERE CONDO BUYERS\nHAVE MORE CHOICE",
      subtitle:
        "More inventory and longer selling times can give condo buyers additional leverage.",
      rows:
        buildRankingRows(
          analysis.strongestCondoBuyerOpportunities,
        ),
      footer:
        "Review HOA finances, reserves and documents alongside the market data.",
    });
  }

  slides.push({
    filename:
      "07-condos-vs-houses.jpg",
    layout:
      "comparison",
    eyebrow:
      "PROPERTY TYPE MATTERS",
    title:
      "CONDOS ARE A\nDIFFERENT MARKET",
    subtitle:
      "Metro-level inventory shows why buyers should not treat every property type the same.",
    statLeft: {
      value:
        formatMonths(
          singleFamily?.monthsOfInventory,
        ),
      label:
        "SINGLE-FAMILY",
      detail:
        formatComparisonDetail(
          singleFamily,
        ),
    },
    statRight: {
      value:
        formatMonths(
          condos?.monthsOfInventory,
        ),
      label:
        "CONDOS",
      detail:
        formatComparisonDetail(
          condos,
        ),
    },
    footer:
      "Months of inventory is one indicator. Location, condition and price still matter.",
  });

  const gapRows =
    buildPropertyTypeGapRows(
      analysis.condoVsSingleFamily,
    );

  if (gapRows.length > 0) {
    slides.push({
      filename:
        "08-biggest-property-type-gaps.jpg",
      layout:
        "ranking",
      eyebrow:
        "HOUSE VS CONDO",
      title:
        "THE BIGGEST\nMARKET GAPS",
      subtitle:
        "These areas show some of the widest inventory differences between houses and condos.",
      rows:
        gapRows,
      footer:
        "Inventory gaps show why property type can change negotiating leverage in the same area.",
    });
  }

  slides.push({
    filename:
      "09-buyer-playbook.jpg",
    layout:
      "insights",
    eyebrow:
      "WHAT THE DATA MEANS",
    title:
      "A BUYER PLAYBOOK\nFOR THIS WEEK",
    subtitle:
      "Three practical ways to use this week's Portland Metro numbers.",
    insights:
      buildBuyerInsights(
        singleFamily,
        condos,
        analysis,
      ),
    footer:
      "Use the market data as context, then evaluate the specific home, price and neighborhood.",
  });

  slides.push({
    filename:
      "10-takeaway.jpg",
    layout:
      "takeaway",
    eyebrow:
      "THIS WEEK'S BOTTOM LINE",
    title:
      "THE BIGGEST DIVIDE\nIS PROPERTY TYPE",
    body:
      buildSpecificTakeaway(
        singleFamily,
        condos,
        analysis,
      ),
    footer:
      "Follow Portland Home Guide for weekly local housing data.\nportlandhomeguide.com",
  });

  // The Instagram publishing client currently enforces the API-safe
  // maximum of 10 carousel items. Prefer the most detailed set possible
  // without ever creating an unpublishable carousel.
  const publishableSlides =
    slides.slice(
      0,
      10,
    );

  return {
    reportDate,
    slug,
    caption:
      content.instagramCaption.trim(),
    slides:
      publishableSlides,
  };
}

interface CoverStory {
  title: string;
  subtitle: string;
}

interface CoverStoryCandidate extends CoverStory {
  score: number;
}

/**
 * Pick the strongest cover story from the actual weekly market data.
 *
 * This is intentionally deterministic rather than AI-written: the cover
 * should always be traceable to numbers already in the report. Candidates
 * are scored by how far they deviate from the relevant metro baseline.
 */
function buildCoverStory(
  singleFamily: MarketStats | null,
  condos: MarketStats | null,
  analysis: MarketStatsAnalysis,
  reportDate: string,
): CoverStory {
  const candidates: CoverStoryCandidate[] = [];
  const date =
    formatDisplayDate(reportDate);

  if (
    singleFamily?.monthsOfInventory !== null &&
    singleFamily?.monthsOfInventory !== undefined &&
    condos?.monthsOfInventory !== null &&
    condos?.monthsOfInventory !== undefined &&
    singleFamily.monthsOfInventory > 0 &&
    condos.monthsOfInventory > 0
  ) {
    const ratio =
      condos.monthsOfInventory /
      singleFamily.monthsOfInventory;
    const gap =
      condos.monthsOfInventory -
      singleFamily.monthsOfInventory;

    if (ratio >= 1.35) {
      candidates.push({
        score:
          (ratio - 1) * 100 +
          Math.max(0, gap) * 10,
        title:
          `CONDOS HAVE ${formatRatio(ratio)}X\nTHE INVENTORY`,
        subtitle:
          `${formatMonths(condos.monthsOfInventory)} months for condos vs ${formatMonths(singleFamily.monthsOfInventory)} for single-family • ${date}`,
      });
    }
  }

  const hottest =
    analysis.hottestSingleFamily[0];

  if (
    hottest &&
    singleFamily?.monthsOfInventory !== null &&
    singleFamily?.monthsOfInventory !== undefined &&
    hottest.monthsOfInventory !== null &&
    hottest.monthsOfInventory > 0 &&
    singleFamily.monthsOfInventory > 0
  ) {
    const inventoryTightness =
      singleFamily.monthsOfInventory /
      hottest.monthsOfInventory;
    const domLift =
      relativeSpeedLift(
        singleFamily.averageDaysOnMarketSold,
        hottest.averageDaysOnMarketSold,
      );

    if (inventoryTightness >= 1.2) {
      candidates.push({
        score:
          (inventoryTightness - 1) * 100 +
          domLift * 45,
        title:
          buildAreaHeadline(
            hottest.area,
            "IS MOVING FASTER",
          ),
        subtitle:
          `${formatMonths(hottest.monthsOfInventory)} months inventory • ${formatPlainDays(hottest.averageDaysOnMarketSold)} sold DOM • ${date}`,
      });
    }
  }

  const buyerOpportunity =
    analysis.strongestBuyerOpportunities[0];

  if (
    buyerOpportunity &&
    singleFamily?.monthsOfInventory !== null &&
    singleFamily?.monthsOfInventory !== undefined &&
    buyerOpportunity.monthsOfInventory !== null &&
    buyerOpportunity.monthsOfInventory > 0 &&
    singleFamily.monthsOfInventory > 0
  ) {
    const inventoryLift =
      buyerOpportunity.monthsOfInventory /
      singleFamily.monthsOfInventory;
    const domLift =
      relativeSlowdownLift(
        singleFamily.averageDaysOnMarketSold,
        buyerOpportunity.averageDaysOnMarketSold,
      );

    if (inventoryLift >= 1.25) {
      candidates.push({
        score:
          (inventoryLift - 1) * 100 +
          domLift * 35,
        title:
          buildAreaHeadline(
            buyerOpportunity.area,
            "GIVES BUYERS MORE CHOICE",
          ),
        subtitle:
          `${formatMonths(buyerOpportunity.monthsOfInventory)} months inventory • ${formatPlainDays(buyerOpportunity.averageDaysOnMarketSold)} sold DOM • ${date}`,
      });
    }
  }

  const condoOpportunity =
    analysis.strongestCondoBuyerOpportunities[0];

  if (
    condoOpportunity &&
    condos?.monthsOfInventory !== null &&
    condos?.monthsOfInventory !== undefined &&
    condoOpportunity.monthsOfInventory !== null &&
    condoOpportunity.monthsOfInventory > 0 &&
    condos.monthsOfInventory > 0
  ) {
    const inventoryLift =
      condoOpportunity.monthsOfInventory /
      condos.monthsOfInventory;

    if (inventoryLift >= 1.35) {
      candidates.push({
        score:
          (inventoryLift - 1) * 85,
        title:
          buildAreaHeadline(
            condoOpportunity.area,
            "HAS A LOT OF CONDO INVENTORY",
          ),
        subtitle:
          `${formatMonths(condoOpportunity.monthsOfInventory)} months of condo inventory vs ${formatMonths(condos.monthsOfInventory)} metro-wide • ${date}`,
      });
    }
  }

  const winner =
    candidates.sort(
      (a, b) =>
        b.score - a.score,
    )[0];

  return winner ?? {
    title:
      "PORTLAND METRO\nHOUSING MARKET",
    subtitle:
      `Weekly snapshot • ${date}`,
  };
}

function buildAreaHeadline(
  area: string,
  message: string,
): string {
  const clean =
    cleanAreaName(area)
      .toUpperCase();

  // Long TMO area labels can overflow a cover headline. Keep the place
  // name when it is concise; otherwise lead with the finding instead.
  if (clean.length <= 24) {
    return `${clean}\n${message}`;
  }

  return message.includes("BUYERS")
    ? `BUYERS HAVE MORE\nCHOICE IN ONE MARKET`
    : `ONE PORTLAND MARKET\n${message}`;
}

function relativeSpeedLift(
  metroDom: number | null | undefined,
  localDom: number | null | undefined,
): number {
  if (
    metroDom === null ||
    metroDom === undefined ||
    localDom === null ||
    localDom === undefined ||
    metroDom <= 0 ||
    localDom >= metroDom
  ) {
    return 0;
  }

  return (
    metroDom - localDom
  ) / metroDom;
}

function relativeSlowdownLift(
  metroDom: number | null | undefined,
  localDom: number | null | undefined,
): number {
  if (
    metroDom === null ||
    metroDom === undefined ||
    localDom === null ||
    localDom === undefined ||
    metroDom <= 0 ||
    localDom <= metroDom
  ) {
    return 0;
  }

  return (
    localDom - metroDom
  ) / metroDom;
}

function formatRatio(
  value: number,
): string {
  if (value >= 2) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
}

function findMetroMarket(
  stats: ExtractedMarketStats,
  propertyType: MarketStats["propertyType"],
): MarketStats | null {
  return (
    stats.markets.find(
      (market) =>
        market.area ===
          "Greater Portland Areas" &&
        market.propertyType ===
          propertyType,
    ) ?? null
  );
}

function findReportDate(
  stats: ExtractedMarketStats,
): string | null {
  let latest:
    {
      value: string;
      timestamp: number;
    } | null =
    null;

  for (const market of stats.markets) {
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

function buildRankingRows(
  rankings: MarketRanking[],
): InstagramRankingRow[] {
  return rankings
    .slice(
      0,
      3,
    )
    .map(
      (market) => ({
        rank:
          market.rank,
        area:
          cleanAreaName(
            market.area,
          ),
        primary:
          `${formatMonths(market.monthsOfInventory)} months inventory`,
        secondary:
          [
            formatPercent(
              market.pendingActiveRatio,
            ),
            formatDays(
              market.averageDaysOnMarketSold,
            ),
          ]
            .filter(Boolean)
            .join(" • "),
      }),
    );
}

function buildPropertyTypeGapRows(
  comparisons: CondoVsSingleFamilyComparison[],
): InstagramRankingRow[] {
  return comparisons
    .filter(
      (comparison) =>
        comparison.inventoryGap !== null &&
        comparison.singleFamilyInventory !== null &&
        comparison.condoInventory !== null,
    )
    .sort(
      (a, b) =>
        (b.inventoryGap ?? -Infinity) -
        (a.inventoryGap ?? -Infinity),
    )
    .slice(
      0,
      3,
    )
    .map(
      (comparison, index) => ({
        rank:
          index + 1,
        area:
          cleanAreaName(
            comparison.area,
          ),
        primary:
          `${formatMonths(comparison.singleFamilyInventory)} mo houses vs ${formatMonths(comparison.condoInventory)} mo condos`,
        secondary:
          `+${formatMonths(comparison.inventoryGap)} mo condo inventory`,
      }),
    );
}

function buildBuyerInsights(
  singleFamily: MarketStats | null,
  condos: MarketStats | null,
  analysis: MarketStatsAnalysis,
): InstagramInsightCard[] {
  const hot =
    analysis.hottestSingleFamily[0];

  const flexible =
    analysis.strongestBuyerOpportunities[0];

  const insights: InstagramInsightCard[] = [];

  if (hot) {
    insights.push({
      title:
        `Move faster in ${cleanAreaName(hot.area)}`,
      body:
        `${formatMonths(hot.monthsOfInventory)} months of house inventory and ${formatPlainDays(hot.averageDaysOnMarketSold)} sold DOM means well-positioned listings can require quicker decisions.`,
    });
  }

  if (condos) {
    insights.push({
      title:
        "Compare condo options",
      body:
        `Metro condos are at ${formatMonths(condos.monthsOfInventory)} months of inventory and ${formatPlainDays(condos.averageDaysOnMarketSold)} sold DOM, giving many buyers more time than the detached-home market.`,
    });
  }

  if (flexible) {
    insights.push({
      title:
        `Look for leverage in ${cleanAreaName(flexible.area)}`,
      body:
        `${formatMonths(flexible.monthsOfInventory)} months of house inventory and ${formatPlainDays(flexible.averageDaysOnMarketSold)} sold DOM can mean more time to compare homes and negotiate terms.`,
    });
  }

  if (
    insights.length < 3 &&
    singleFamily
  ) {
    insights.push({
      title:
        "Use the metro average carefully",
      body:
        `Greater Portland houses are at ${formatMonths(singleFamily.monthsOfInventory)} months of inventory, but neighborhood-level conditions can be much tighter or looser.`,
    });
  }

  return insights.slice(0, 3);
}

function buildSpecificTakeaway(
  singleFamily: MarketStats | null,
  condos: MarketStats | null,
  analysis: MarketStatsAnalysis,
): string {
  if (
    singleFamily &&
    condos &&
    singleFamily.monthsOfInventory !== null &&
    condos.monthsOfInventory !== null
  ) {
    const inventoryGap =
      condos.monthsOfInventory -
      singleFamily.monthsOfInventory;

    const hot =
      analysis.hottestSingleFamily[0];

    const hotContext =
      hot
        ? ` In ${cleanAreaName(hot.area)}, houses are tighter still at ${formatMonths(hot.monthsOfInventory)} months.`
        : "";

    return (
      `Greater Portland houses are at ${formatMonths(singleFamily.monthsOfInventory)} months of inventory and ${formatPlainDays(singleFamily.averageDaysOnMarketSold)} sold DOM, versus ${formatMonths(condos.monthsOfInventory)} months and ${formatPlainDays(condos.averageDaysOnMarketSold)} for condos. ` +
      `That's ${inventoryGap.toFixed(1)} more months of condo inventory.${hotContext} The strategy should change with the property type and neighborhood.`
    );
  }

  const hot =
    analysis.hottestSingleFamily[0];

  const flexible =
    analysis.strongestBuyerOpportunities[0];

  if (hot && flexible) {
    return (
      `${cleanAreaName(hot.area)} is one of the tighter house markets at ${formatMonths(hot.monthsOfInventory)} months of inventory, while ${cleanAreaName(flexible.area)} is at ${formatMonths(flexible.monthsOfInventory)} months. ` +
      "The practical takeaway: negotiating leverage changes substantially by location, property type and price point."
    );
  }

  return (
    "This week's data shows meaningful differences by property type and submarket. Use the local inventory, pending activity and selling time before deciding how aggressive to be on a specific home."
  );
}

function cleanAreaName(
  area: string,
): string {
  return area
    .replace(
      /\s+Area$/i,
      "",
    )
    .replace(
      "Tigard, Tualatin, Sherwood and Wilsonville",
      "Tigard / Tualatin / Sherwood / Wilsonville",
    );
}

function formatMonths(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  return value.toFixed(1);
}

function formatDays(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return `${Math.round(value)} sold DOM`;
}

function formatPlainDays(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "N/A";
  }

  return `${Math.round(value)} days`;
}

function formatPercent(
  value: number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return `${value.toFixed(1)}% pending ratio`;
}

function formatDomDetail(
  market: MarketStats | null | undefined,
): string {
  if (
    !market ||
    market.averageDaysOnMarketSold === null
  ) {
    return "Sold DOM unavailable";
  }

  return `${Math.round(market.averageDaysOnMarketSold)} days average sold DOM`;
}

function formatComparisonDetail(
  market: MarketStats | null | undefined,
): string {
  if (!market) {
    return "Market data unavailable";
  }

  const details = [
    market.averageDaysOnMarketSold === null
      ? null
      : `${Math.round(market.averageDaysOnMarketSold)} sold DOM`,
    market.pendingActiveRatio === null
      ? null
      : `${market.pendingActiveRatio.toFixed(1)}% pending ratio`,
  ].filter(
    (value): value is string =>
      Boolean(value),
  );

  return details.join(" • ");
}

function toDateSlug(
  reportDate: string,
): string {
  const parsed =
    new Date(reportDate);

  if (
    !Number.isNaN(
      parsed.getTime(),
    )
  ) {
    const year =
      parsed.getUTCFullYear();
    const month =
      String(
        parsed.getUTCMonth() + 1,
      ).padStart(
        2,
        "0",
      );
    const day =
      String(
        parsed.getUTCDate(),
      ).padStart(
        2,
        "0",
      );

    return `${year}-${month}-${day}`;
  }

  return reportDate
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    ) || "latest";
}

function formatDisplayDate(
  reportDate: string,
): string {
  const parsed =
    new Date(reportDate);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return reportDate;
  }

  return new Intl.DateTimeFormat(
    "en-US",
    {
      month:
        "long",
      day:
        "numeric",
      year:
        "numeric",
      timeZone:
        "UTC",
    },
  ).format(
    parsed,
  );
}
