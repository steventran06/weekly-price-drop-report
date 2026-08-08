import type {
  GeneratedMarketStatsContent,
} from "./generateMarketStatsContent.js";

import type {
  ExtractedMarketStats,
  MarketStats,
} from "./extractMarketStats.js";

import type {
  MarketRanking,
  MarketStatsAnalysis,
} from "./analyzeMarketStats.js";

export interface MarketStatsBlogPost {
  filename: string;
  slug: string;
  markdown: string;
}

export function generateMarketStatsBlog(
  content: GeneratedMarketStatsContent,
  stats: ExtractedMarketStats,
  analysis: MarketStatsAnalysis,
): MarketStatsBlogPost {
  const date =
    getPortlandDate();

  const slug =
    `portland-metro-housing-market-update-${date}`;

  const filename =
    `${date}-weekly-market-stats.md`;

  const title =
    escapeYamlString(
      cleanGeneratedText(
        content.blogTitle,
      ),
    );

  const description =
    escapeYamlString(
      cleanGeneratedText(
        content.blogDescription,
      ),
    );

  const metroSingleFamily =
    analysis.metroAggregate;

  const metroCondo =
    stats.markets.find(
      (market) =>
        market.area ===
          "Greater Portland Areas" &&
        market.propertyType ===
          "Condominiums",
    ) ?? null;

  const tableMarkets =
    createTableMarkets(
      stats,
    );

  const competitiveSections =
    analysis.hottestSingleFamily
      .slice(0, 3)
      .map(
        (market) =>
          createRankingSection(
            market,
            stats,
          ),
      )
      .filter(Boolean)
      .join("\n\n");

  const buyerOpportunitySections =
    analysis.strongestBuyerOpportunities
      .slice(0, 3)
      .map(
        (market) =>
          createRankingSection(
            market,
            stats,
          ),
      )
      .filter(Boolean)
      .join("\n\n");

  const buyerTakeaways =
    content.buyerTakeaways
      .map(
        (item) =>
          `- ${cleanGeneratedText(
            ensurePeriod(item),
          )}`,
      )
      .join("\n");

  const sellerTakeaways =
    content.sellerTakeaways
      .map(
        (item) =>
          `- ${cleanGeneratedText(
            ensurePeriod(item),
          )}`,
      )
      .join("\n");

  const markdown = `---
author: Steven Tran
pubDatetime: ${date}
modDatetime: ${date}
title: "${title}"
slug: ${slug}
featured: false
draft: false
tags:
  - portland-real-estate
  - portland-housing-market
  - portland-metro
  - market-update
  - housing-market
description: "${description}"
---

![](/assets/weekly-market-stats-cover.png)

${cleanGeneratedText(
  content.blogIntroduction,
)}

* * *

## 📊 Portland Metro Market at a Glance

${createMetroSnapshot(
  metroSingleFamily,
  metroCondo,
)}

${createMarketTable(
  tableMarkets,
)}

* * *

## 🔥 Where Single-Family Homes Look Most Competitive

${cleanGeneratedText(
  content.competitiveMarketsIntro,
)}

${competitiveSections}

* * *

## 🏡 Where Buyers May Have More Leverage

${cleanGeneratedText(
  content.buyerOpportunityIntro,
)}

${buyerOpportunitySections}

* * *

## 🏢 The Condo Market Is a Different Story

${cleanGeneratedText(
  content.condoMarketIntro,
)}

${createCondoComparisonTable(
  analysis,
)}

${cleanGeneratedText(
  content.condoComparisonAnalysis,
)}

* * *

## 💰 What This Could Mean for Buyers

${buyerTakeaways}

* * *

## 🏠 What This Could Mean for Sellers

${sellerTakeaways}

* * *

## Bottom Line

${cleanGeneratedText(
  content.closing,
)}

Market statistics are based on the weekly TMO Reports data used for this analysis and are subject to change. Real estate conditions can vary significantly by neighborhood, property type and price range.
`;

  return {
    filename,
    slug,
    markdown,
  };
}

function createMetroSnapshot(
  singleFamily: MarketStats | null,
  condo: MarketStats | null,
): string {
  if (
    !singleFamily &&
    !condo
  ) {
    return "";
  }

  const sections: string[] = [];

  if (singleFamily) {
    sections.push(
      `### Single-Family Homes

**Inventory:** ${formatInventory(
        singleFamily.monthsOfInventory,
      )}  
**Active listings:** ${formatNumber(
        singleFamily.activeListings,
      )}  
**Pending listings:** ${formatNumber(
        singleFamily.pendingListings,
      )}  
**Pending-to-active ratio:** ${formatPercent(
        singleFamily.pendingActiveRatio,
      )}  
**Average sale price:** ${formatCurrency(
        singleFamily.averageSalePrice,
      )}  
**Average sold DOM:** ${formatDays(
        singleFamily.averageDaysOnMarketSold,
      )}`,
    );
  }

  if (condo) {
    sections.push(
      `### Condominiums

**Inventory:** ${formatInventory(
        condo.monthsOfInventory,
      )}  
**Active listings:** ${formatNumber(
        condo.activeListings,
      )}  
**Pending listings:** ${formatNumber(
        condo.pendingListings,
      )}  
**Pending-to-active ratio:** ${formatPercent(
        condo.pendingActiveRatio,
      )}  
**Average sale price:** ${formatCurrency(
        condo.averageSalePrice,
      )}  
**Average sold DOM:** ${formatDays(
        condo.averageDaysOnMarketSold,
      )}`,
    );
  }

  return sections.join(
    "\n\n",
  );
}

function createTableMarkets(
  stats: ExtractedMarketStats,
): MarketStats[] {
  const preferredMarkets: Array<{
    area: string;
    propertyType:
      | "Single Family Residential"
      | "Condominiums";
  }> = [
    {
      area:
        "Greater Portland Areas",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Greater Portland Areas",
      propertyType:
        "Condominiums",
    },
    {
      area:
        "Northeast Portland Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "North Portland Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Southeast Portland Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Beaverton Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Beaverton Area",
      propertyType:
        "Condominiums",
    },
    {
      area:
        "Tigard, Tualatin, Sherwood and Wilsonville Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Hillsboro/Forest Grove Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Oregon City/Canby Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "Lake Oswego/West Linn Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "West Portland Area",
      propertyType:
        "Single Family Residential",
    },
    {
      area:
        "NW Portland Area",
      propertyType:
        "Single Family Residential",
    },
  ];

  return preferredMarkets
    .map((preferred) =>
      stats.markets.find(
        (market) =>
          market.area ===
            preferred.area &&
          market.propertyType ===
            preferred.propertyType,
      ),
    )
    .filter(
      (
        market,
      ): market is MarketStats =>
        Boolean(market),
    );
}

function createMarketTable(
  markets: MarketStats[],
): string {
  const rows =
    markets.map(
      (market) =>
        `| ${cleanAreaLabel(
          market.area,
        )} | ${formatPropertyType(
          market.propertyType,
        )} | ${formatNumber(
          market.activeListings,
        )} | ${formatNumber(
          market.pendingListings,
        )} | ${formatInventory(
          market.monthsOfInventory,
        )} | ${formatCurrency(
          market.averageSalePrice,
        )} | ${formatDays(
          market.averageDaysOnMarketSold,
        )} |`,
    );

  return [
    "| Area | Property Type | Active | Pending | Inventory | Avg Sale Price | Sold DOM |",
    "|---|---|---:|---:|---:|---:|---:|",
    ...rows,
  ].join("\n");
}

function createRankingSection(
  ranking: MarketRanking,
  stats: ExtractedMarketStats,
): string {
  const market =
    stats.markets.find(
      (item) =>
        item.area ===
          ranking.area &&
        item.propertyType ===
          ranking.propertyType,
    );

  if (!market) {
    return "";
  }

  return `### ${cleanAreaLabel(
    ranking.area,
  )}

**Inventory:** ${formatInventory(
    market.monthsOfInventory,
  )}  
**Pending-to-active ratio:** ${formatPercent(
    market.pendingActiveRatio,
  )}  
**Average sold DOM:** ${formatDays(
    market.averageDaysOnMarketSold,
  )}  
**Average sale price:** ${formatCurrency(
    market.averageSalePrice,
  )}`;
}

function createCondoComparisonTable(
  analysis: MarketStatsAnalysis,
): string {
  const rows =
    analysis.condoVsSingleFamily
      .slice(0, 5)
      .map(
        (item) =>
          `| ${cleanAreaLabel(
            item.area,
          )} | ${formatInventory(
            item.singleFamilyInventory,
          )} | ${formatInventory(
            item.condoInventory,
          )} | ${formatInventory(
            item.inventoryGap,
          )} |`,
      );

  return [
    "| Area | Single-Family Inventory | Condo Inventory | Inventory Gap |",
    "|---|---:|---:|---:|",
    ...rows,
  ].join("\n");
}

function cleanGeneratedText(
  value: string,
): string {
  return value
    /*
     * Escape dollar signs so Markdown math
     * plugins do not interpret prices as math.
     */
    .replace(
      /\$/g,
      "\\$",
    )

    /*
     * Replace internal shorthand with
     * consumer-friendly wording.
     */
    .replace(
      /\bMOI\b/gi,
      "months of inventory",
    )

    /*
     * Replace em/en dashes while consuming
     * surrounding whitespace.
     *
     * This prevents output such as:
     *
     * "urban core , Columbia County"
     */
    .replace(
      /\s*[—–]\s*/g,
      ", ",
    )

    /*
     * Remove spaces before commas.
     */
    .replace(
      /\s+,/g,
      ",",
    )

    /*
     * Remove accidental duplicate commas.
     */
    .replace(
      /,\s*,+/g,
      ",",
    )

    /*
     * Normalize spacing after commas.
     */
    .replace(
      /,\s*/g,
      ", ",
    )

    /*
     * Remove accidental Markdown bold
     * generated by the model.
     */
    .replace(
      /\*\*/g,
      "",
    )

    /*
     * Clean each line while preserving
     * paragraph breaks.
     */
    .split(/\r?\n/)
    .map(
      (line) =>
        line
          .replace(
            /[ \t]+/g,
            " ",
          )
          .trim(),
    )
    .join("\n")

    /*
     * Collapse excessive blank lines.
     */
    .replace(
      /\n{3,}/g,
      "\n\n",
    )

    .trim();
}

function cleanAreaLabel(
  area: string,
): string {
  return area
    .replace(
      /\s+Area$/i,
      "",
    )
    .replace(
      "Greater Portland Areas",
      "Greater Portland",
    );
}

function formatPropertyType(
  propertyType:
    MarketStats["propertyType"],
): string {
  if (
    propertyType ===
    "Single Family Residential"
  ) {
    return "Single Family";
  }

  if (
    propertyType ===
    "Condominiums"
  ) {
    return "Condominiums";
  }

  return propertyType;
}

function formatCurrency(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  const formatted =
    value.toLocaleString(
      "en-US",
      {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      },
    );

  return formatted.replace(
    "$",
    "\\$",
  );
}

function formatNumber(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
  );
}

function formatInventory(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return `${value} months`;
}

function formatPercent(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return `${value}%`;
}

function formatDays(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return `${value} days`;
}

function ensurePeriod(
  value: string,
): string {
  const cleaned =
    value.trim();

  if (
    /[.!?]$/.test(
      cleaned,
    )
  ) {
    return cleaned;
  }

  return `${cleaned}.`;
}

function getPortlandDate(): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "Could not determine Portland date.",
    );
  }

  return `${year}-${month}-${day}`;
}

function escapeYamlString(
  value: string,
): string {
  return value
    .replace(
      /\\/g,
      "\\\\",
    )
    .replace(
      /"/g,
      '\\"',
    )
    .replace(
      /\r?\n/g,
      " ",
    )
    .trim();
}
