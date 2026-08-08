import type {
  GeneratedMonthlyBuyerContent,
} from "./generateMonthlyBuyerContent.js";

import type {
  MonthlyMarketAnalysis,
  MonthlyMarketTrend,
} from "./analyzeMonthlyMarketStats.js";

import type {
  MonthlyPriceDropAnalysis,
} from "./analyzeMonthlyPriceDrops.js";

export interface MonthlyBuyerBlogPost {
  filename: string;
  slug: string;
  markdown: string;
}

export function generateMonthlyBuyerBlog(
  content:
    GeneratedMonthlyBuyerContent,

  analysis:
    MonthlyMarketAnalysis,

  priceDrops:
    MonthlyPriceDropAnalysis,
): MonthlyBuyerBlogPost {
  const publishDate =
    getPortlandDate();

  const monthSlug =
    `${analysis.monthName.toLowerCase()}-${analysis.year}`;

  const slug =
    `portland-metro-buyer-opportunity-report-${monthSlug}`;

  const filename =
    `${publishDate}-portland-metro-buyer-opportunity-report-${monthSlug}.md`;

  const currentMonth =
    getFollowingMonth(
      analysis.year,
      analysis.month,
    );

  const title =
    escapeYamlString(
      `Portland Metro Housing Market Lookback: What ${analysis.monthName} ${analysis.year} Tells Buyers About ${currentMonth.monthName}`,
    );

  const description =
    escapeYamlString(
      cleanGeneratedText(
        content.description,
      ),
    );

  const buyerTakeaways =
    content.buyerTakeaways
      .map(
        (item) =>
          `- ${cleanGeneratedText(
            ensurePeriod(
              item,
            ),
          )}`,
      )
      .join(
        "\n",
      );

  const watchNextMonth =
    content.watchNextMonth
      .map(
        (item) =>
          `- ${cleanGeneratedText(
            ensurePeriod(
              item,
            ),
          )}`,
      )
      .join(
        "\n",
      );

  const priceDropSection =
    createPriceDropSection(
      content,
      priceDrops,
    );

  const markdown = `---
author: Steven Tran
pubDatetime: ${publishDate}
modDatetime: ${publishDate}
title: "${title}"
slug: ${slug}
featured: false
draft: false
tags:
  - portland-real-estate
  - portland-housing-market
  - portland-home-buyers
  - buyer-opportunities
  - market-update
  - price-drops
description: "${description}"
---

![](/assets/monthly-buyer-opportunity-cover.png)

${cleanGeneratedText(
  content.introduction,
)}

${createDataAvailabilityNote(
  analysis,
)}

* * *

## 🏡 Where Buyers Had More Options

${cleanGeneratedText(
  content.buyerLeverageIntro,
)}

${createBuyerOpportunitySections(
  analysis,
)}

* * *

## 🔥 Where Homes Were Moving Faster

${cleanGeneratedText(
  content.competitiveMarketsIntro,
)}

${createCompetitiveMarketSections(
  analysis,
)}

* * *

## 🏢 Houses vs. Condos

${cleanGeneratedText(
  content.condoIntro,
)}

${createHouseCondoTable(
  analysis,
)}

${createCondoExplanation(
  analysis,
)}

* * *

## 📈 What Changed During ${analysis.monthName}?

${cleanGeneratedText(
  content.trendAnalysis,
)}

${createMeaningfulChangesList(
  analysis,
)}
${priceDropSection}
* * *

## 💡 What This Could Mean If You're Buying in ${currentMonth.monthName}

${buyerTakeaways}

* * *

## 👀 What I'm Watching in ${currentMonth.monthName}

${watchNextMonth}

* * *

## Bottom Line

${cleanGeneratedText(
  content.closing,
)}

Market statistics are based on the available weekly TMO Reports and historical price-drop reports analyzed for ${analysis.monthName} ${analysis.year}. Market conditions, listing availability and pricing are subject to change and can vary significantly by neighborhood, property type and price range.
`;

  return {
    filename,
    slug,
    markdown,
  };
}

function createPriceDropSection(
  content:
    GeneratedMonthlyBuyerContent,

  analysis:
    MonthlyPriceDropAnalysis,
): string {
  if (
    analysis.snapshotCount ===
      0 ||
    analysis.uniqueListings ===
      0
  ) {
    return "";
  }

  const intro =
    content.priceDropIntro
      ? cleanGeneratedText(
          content.priceDropIntro,
        )
      : "";

  const summaryParts: string[] = [];

  summaryParts.push(
    `**Unique listings with price-drop activity tracked:** ${formatWholeNumber(
      analysis.uniqueListings,
    )}`,
  );

  if (
    analysis.medianReduction !==
    null
  ) {
    summaryParts.push(
      `**Typical reduction:** ${formatCurrency(
        analysis.medianReduction,
      )}`,
    );
  }

  if (
    analysis.largestReduction !==
    null
  ) {
    summaryParts.push(
      `**Largest reduction tracked:** ${formatCurrency(
        analysis.largestReduction,
      )}`,
    );
  }

  const areaTable =
    createPriceDropAreaTable(
      analysis,
    );

  return `

* * *

## 💰 Where Sellers Were Cutting Prices

${intro}

${summaryParts.join("  \n")}

${areaTable}

A price reduction can be a useful sign of increased seller motivation, but it does not automatically mean a home is underpriced. The property's condition, location, comparable sales and current competition still matter.
`;
}

function createPriceDropAreaTable(
  analysis:
    MonthlyPriceDropAnalysis,
): string {
  const areas =
    analysis.areasWithMostPriceDrops
      .filter(
        (area) =>
          area.area &&
          !/^unknown/i.test(
            area.area,
          ),
      )
      .slice(
        0,
        5,
      );

  if (
    areas.length ===
    0
  ) {
    return "";
  }

  const rows =
    areas.map(
      (area) =>
        `| ${cleanAreaName(
          area.area,
        )} | ${formatWholeNumber(
          area.uniqueListings,
        )} | ${formatCurrency(
          area.medianReduction,
        )} |`,
    );

  return [
    "| Area | Listings With Price Drops | Typical Reduction |",
    "|---|---:|---:|",
    ...rows,
  ].join(
    "\n",
  );
}

function createDataAvailabilityNote(
  analysis:
    MonthlyMarketAnalysis,
): string {
  const dates =
    analysis.snapshotDates
      .map(
        formatSnapshotDate,
      )
      .join(
        " and ",
      );

  if (
    analysis.reportsAvailable >=
    4
  ) {
    return `> **About this report:** I reviewed ${analysis.reportsAvailable} weekly Portland Metro market reports from ${analysis.monthName} ${analysis.year} to see what changed and what those signals could mean for buyers this month.`;
  }

  return `> **About this report:** Only ${analysis.reportsAvailable} weekly market reports were available for ${analysis.monthName} ${analysis.year}, dated ${dates}. This gives us a useful snapshot of buyer conditions, but it should not be treated as a complete picture of every week of the month.`;
}

function createBuyerOpportunitySections(
  analysis:
    MonthlyMarketAnalysis,
): string {
  const markets =
    createBuyerOpportunityMarkets(
      analysis,
    ).slice(
      0,
      4,
    );

  if (
    markets.length ===
    0
  ) {
    return "The available reports did not show a clear group of areas where buyers had significantly more time or choice.";
  }

  return markets
    .map(
      (market) =>
        createSimpleMarketSection(
          market,
          "buyer",
        ),
    )
    .join(
      "\n\n",
    );
}

function createBuyerOpportunityMarkets(
  analysis:
    MonthlyMarketAnalysis,
): MonthlyMarketTrend[] {
  return [
    ...analysis.singleFamilyMarkets,
  ]
    .filter(
      isValidConsumerMarket,
    )
    .filter(
      (market) =>
        market.endingInventory !==
        null,
    )
    .filter(
      (
        market,
        index,
        all,
      ) =>
        all.findIndex(
          (item) =>
            normalizeArea(
              item.area,
            ) ===
            normalizeArea(
              market.area,
            ),
        ) ===
        index,
    )
    .sort(
      (a, b) =>
        calculateBuyerOpportunityScore(
          b,
        ) -
        calculateBuyerOpportunityScore(
          a,
        ),
    );
}

function calculateBuyerOpportunityScore(
  market:
    MonthlyMarketTrend,
): number {
  const supplyScore =
    (
      market.endingInventory ??
      0
    ) * 10;

  const sellingTimeScore =
    Math.min(
      market.endingSoldDom ??
        0,
      90,
    );

  const buyerActivityPenalty =
    market.endingPendingRatio ??
    0;

  const improvingChoiceBonus =
    Math.max(
      market.inventoryChange ??
        0,
      0,
    ) * 10;

  return (
    supplyScore +
    sellingTimeScore +
    improvingChoiceBonus -
    buyerActivityPenalty
  );
}

function createCompetitiveMarketSections(
  analysis:
    MonthlyMarketAnalysis,
): string {
  const markets =
    analysis
      .lowestEndingSingleFamilyInventory
      .filter(
        isValidConsumerMarket,
      )
      .filter(
        (
          market,
          index,
          all,
        ) =>
          all.findIndex(
            (item) =>
              normalizeArea(
                item.area,
              ) ===
              normalizeArea(
                market.area,
              ),
          ) ===
          index,
      )
      .slice(
        0,
        4,
      );

  if (
    markets.length ===
    0
  ) {
    return "The available reports did not identify a clear group of faster-moving markets.";
  }

  return markets
    .map(
      (market) =>
        createSimpleMarketSection(
          market,
          "competitive",
        ),
    )
    .join(
      "\n\n",
    );
}

function createSimpleMarketSection(
  market:
    MonthlyMarketTrend,

  type:
    | "buyer"
    | "competitive",
): string {
  const statLine =
    createMarketStatLine(
      market,
    );

  const explanation =
    type ===
    "buyer"
      ? createBuyerExplanation(
          market,
        )
      : createCompetitiveExplanation(
          market,
        );

  return `### ${cleanAreaName(
    market.area,
  )}

**${statLine}**

${explanation}`;
}

function createMarketStatLine(
  market:
    MonthlyMarketTrend,
): string {
  const parts: string[] = [];

  if (
    market.endingActiveListings !==
    null
  ) {
    parts.push(
      `${formatWholeNumber(
        market.endingActiveListings,
      )} active listings`,
    );
  }

  if (
    market.endingSoldDom !==
    null
  ) {
    parts.push(
      `about ${formatWholeNumber(
        market.endingSoldDom,
      )} days to sell`,
    );
  }

  return (
    parts.join(
      " | ",
    ) ||
    "Market conditions varied during the available reports"
  );
}

function createBuyerExplanation(
  market:
    MonthlyMarketTrend,
): string {
  const sellingTime =
    market.endingSoldDom;

  const activeChange =
    market.activeListingsChange;

  const parts: string[] = [];

  if (
    activeChange !==
      null &&
    activeChange >=
      20
  ) {
    parts.push(
      `There were ${formatWholeNumber(
        activeChange,
      )} more homes for sale in the latest report than in the earlier snapshot.`,
    );
  }

  if (
    sellingTime !==
      null &&
    sellingTime >=
      60
  ) {
    parts.push(
      "Homes were also taking longer to sell than in many parts of the metro, which can give buyers more time to compare properties and potentially negotiate.",
    );
  } else if (
    sellingTime !==
      null &&
    sellingTime >=
      45
  ) {
    parts.push(
      "Homes were taking a little longer to sell, which can reduce some of the pressure to make an immediate decision.",
    );
  }

  if (
    parts.length ===
    0
  ) {
    parts.push(
      "This area gave buyers comparatively more breathing room than the fastest-moving parts of the Portland Metro.",
    );
  }

  return parts.join(
    " ",
  );
}

function createCompetitiveExplanation(
  market:
    MonthlyMarketTrend,
): string {
  const sellingTime =
    market.endingSoldDom;

  if (
    sellingTime !==
      null &&
    sellingTime <=
      30
  ) {
    return `Homes were selling relatively quickly here, averaging about ${formatWholeNumber(
      sellingTime,
    )} days. Buyers interested in well-priced properties may need to be ready to make decisions faster than they would in slower-moving areas.`;
  }

  if (
    sellingTime !==
      null &&
    sellingTime <=
      40
  ) {
    return `Homes were selling in about ${formatWholeNumber(
      sellingTime,
    )} days on average, keeping this among the faster-moving markets in the report.`;
  }

  return "This area remained more competitive than the markets offering buyers the most time and choice.";
}

interface CondoComparison {
  area: string;

  singleFamily:
    MonthlyMarketTrend;

  condo:
    MonthlyMarketTrend;

  inventoryGap:
    number;
}

function createHouseCondoTable(
  analysis:
    MonthlyMarketAnalysis,
): string {
  const comparisons =
    createCondoComparisons(
      analysis,
    ).slice(
      0,
      6,
    );

  if (
    comparisons.length ===
    0
  ) {
    return "There was not enough matching condo and house data to create a useful comparison.";
  }

  const rows =
    comparisons.map(
      ({
        area,
        singleFamily,
        condo,
      }) =>
        `| ${cleanAreaName(
          area,
        )} | ${createCompactMarketStats(
          singleFamily,
        )} | ${createCompactMarketStats(
          condo,
        )} |`,
    );

  return [
    "| Area | Houses | Condos |",
    "|---|---|---|",
    ...rows,
  ].join(
    "\n",
  );
}

function createCompactMarketStats(
  market:
    MonthlyMarketTrend,
): string {
  const parts: string[] = [];

  if (
    market.endingActiveListings !==
    null
  ) {
    parts.push(
      `${formatWholeNumber(
        market.endingActiveListings,
      )} active`,
    );
  }

  if (
    market.endingSoldDom !==
    null
  ) {
    parts.push(
      `${formatWholeNumber(
        market.endingSoldDom,
      )} days to sell`,
    );
  }

  return (
    parts.join(
      ", ",
    ) ||
    "N/A"
  );
}

function createCondoExplanation(
  analysis:
    MonthlyMarketAnalysis,
): string {
  const comparisons =
    createCondoComparisons(
      analysis,
    );

  if (
    comparisons.length ===
    0
  ) {
    return "";
  }

  const longestDifference =
    [...comparisons]
      .filter(
        (comparison) =>
          comparison.condo
            .endingSoldDom !==
            null &&
          comparison.singleFamily
            .endingSoldDom !==
            null,
      )
      .sort(
        (a, b) => {
          const bDifference =
            (
              b.condo
                .endingSoldDom ??
              0
            ) -
            (
              b.singleFamily
                .endingSoldDom ??
              0
            );

          const aDifference =
            (
              a.condo
                .endingSoldDom ??
              0
            ) -
            (
              a.singleFamily
                .endingSoldDom ??
              0
            );

          return (
            bDifference -
            aDifference
          );
        },
      )[0];

  if (
    longestDifference &&
    longestDifference
      .condo
      .endingSoldDom !==
      null &&
    longestDifference
      .singleFamily
      .endingSoldDom !==
      null
  ) {
    return `The difference is especially noticeable in ${cleanAreaName(
      longestDifference.area,
    )}. Houses were taking about ${formatWholeNumber(
      longestDifference
        .singleFamily
        .endingSoldDom,
    )} days to sell, compared with about ${formatWholeNumber(
      longestDifference
        .condo
        .endingSoldDom,
    )} days for condos.`;
  }

  return "";
}

function createCondoComparisons(
  analysis:
    MonthlyMarketAnalysis,
): CondoComparison[] {
  const comparisons:
    CondoComparison[] = [];

  for (
    const singleFamily
    of analysis.singleFamilyMarkets
  ) {
    if (
      !isValidConsumerMarket(
        singleFamily,
      )
    ) {
      continue;
    }

    const normalizedArea =
      normalizeArea(
        singleFamily.area,
      );

    const condo =
      analysis.condoMarkets.find(
        (market) =>
          isValidConsumerMarket(
            market,
          ) &&
          normalizeArea(
            market.area,
          ) ===
            normalizedArea,
      );

    if (
      !condo
    ) {
      continue;
    }

    comparisons.push({
      area:
        singleFamily.area,

      singleFamily,

      condo,

      inventoryGap:
        (
          condo.endingInventory ??
          0
        ) -
        (
          singleFamily.endingInventory ??
          0
        ),
    });
  }

  return comparisons.sort(
    (a, b) =>
      b.inventoryGap -
      a.inventoryGap,
  );
}

function createMeaningfulChangesList(
  analysis:
    MonthlyMarketAnalysis,
): string {
  const changes =
    analysis.singleFamilyMarkets
      .filter(
        isValidConsumerMarket,
      )
      .filter(
        hasMeaningfulConsumerChange,
      )
      .filter(
        (
          market,
          index,
          all,
        ) =>
          all.findIndex(
            (item) =>
              normalizeArea(
                item.area,
              ) ===
              normalizeArea(
                market.area,
              ),
          ) ===
          index,
      )
      .sort(
        (a, b) =>
          calculateConsumerChangeImportance(
            b,
          ) -
          calculateConsumerChangeImportance(
            a,
          ),
      )
      .slice(
        0,
        4,
      );

  if (
    changes.length ===
    0
  ) {
    return "The available weekly reports did not show any major changes large enough to call out separately.";
  }

  return changes
    .map(
      (market) =>
        `- ${createConsumerChangeSentence(
          market,
        )}`,
    )
    .join(
      "\n",
    );
}

function hasMeaningfulConsumerChange(
  market:
    MonthlyMarketTrend,
): boolean {
  return (
    Math.abs(
      market.activeListingsChange ??
        0,
    ) >=
      20 ||
    Math.abs(
      market.soldDomChange ??
        0,
    ) >=
      10
  );
}

function calculateConsumerChangeImportance(
  market:
    MonthlyMarketTrend,
): number {
  return (
    Math.abs(
      market.activeListingsChange ??
        0,
    ) +
    Math.abs(
      market.soldDomChange ??
        0,
    ) *
      2
  );
}

function createConsumerChangeSentence(
  market:
    MonthlyMarketTrend,
): string {
  const area =
    cleanAreaName(
      market.area,
    );

  const parts: string[] = [];

  if (
    market.activeListingsChange !==
      null &&
    Math.abs(
      market.activeListingsChange,
    ) >=
      20
  ) {
    if (
      market.activeListingsChange >
      0
    ) {
      parts.push(
        `active listings increased by ${formatWholeNumber(
          market.activeListingsChange,
        )}`,
      );
    } else {
      parts.push(
        `there were ${formatWholeNumber(
          Math.abs(
            market.activeListingsChange,
          ),
        )} fewer active listings`,
      );
    }
  }

  if (
    market.soldDomChange !==
      null &&
    Math.abs(
      market.soldDomChange,
    ) >=
      10
  ) {
    if (
      market.soldDomChange >
      0
    ) {
      parts.push(
        `homes took about ${formatWholeNumber(
          market.soldDomChange,
        )} days longer to sell`,
      );
    } else {
      parts.push(
        `homes sold about ${formatWholeNumber(
          Math.abs(
            market.soldDomChange,
          ),
        )} days faster`,
      );
    }
  }

  return (
    `${area}: ` +
    parts.join(
      " and ",
    ) +
    "."
  );
}

function isValidConsumerMarket(
  market:
    MonthlyMarketTrend,
): boolean {
  const area =
    market.area.trim();

  if (
    !area ||
    /^unknown/i.test(
      area,
    ) ||
    /Greater Portland/i.test(
      area,
    )
  ) {
    return false;
  }

  return true;
}

function normalizeArea(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /^com\s+/,
      "",
    )
    .replace(
      /\s+area$/,
      "",
    )
    .replace(
      /\bwinsonville\b/g,
      "wilsonville",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

function cleanGeneratedText(
  value: string,
): string {
  return value
    .replace(
      /\$/g,
      "\\$",
    )
    .replace(
      /\bmonths[- ]of[- ]inventory\b/gi,
      "amount of housing available",
    )
    .replace(
      /\bpending[- ]to[- ]active(?:\s+activity|\s+ratio)?\b/gi,
      "buyer activity",
    )
    .replace(
      /\bpending ratios?\b/gi,
      "buyer activity",
    )
    .replace(
      /\bsold DOM\b/gi,
      "selling time",
    )
    .replace(
      /\bDOM\b/g,
      "days on market",
    )
    .replace(
      /\bday[- ]to[- ]day\b/gi,
      "week-to-week",
    )
    .replace(
      /\s*[—–]\s*/g,
      ", ",
    )
    .replace(
      /\*\*/g,
      "",
    )
    .trim();
}

function cleanAreaName(
  area: string,
): string {
  return area
    .replace(
      /^com\s+/i,
      "",
    )
    .replace(
      /\s+Area$/i,
      "",
    )
    .replace(
      /\bWinsonville\b/gi,
      "Wilsonville",
    )
    .trim();
}

function formatSnapshotDate(
  value: string,
): string {
  const date =
    new Date(
      `${value}T12:00:00Z`,
    );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        "UTC",

      month:
        "short",

      day:
        "numeric",
    },
  ).format(
    date,
  );
}

function formatWholeNumber(
  value: number,
): string {
  return Math.round(
    value,
  ).toLocaleString(
    "en-US",
  );
}

function formatCurrency(
  value:
    number |
    null,
): string {
  if (
    value ===
    null
  ) {
    return "N/A";
  }

  return value
    .toLocaleString(
      "en-US",
      {
        style:
          "currency",

        currency:
          "USD",

        maximumFractionDigits:
          0,
      },
    )
    .replace(
      "$",
      "\\$",
    );
}

function ensurePeriod(
  value: string,
): string {
  const cleaned =
    value.trim();

  return /[.!?]$/.test(
    cleaned,
  )
    ? cleaned
    : `${cleaned}.`;
}

function getFollowingMonth(
  year: number,
  month: number,
): {
  year: number;
  monthName: string;
} {
  const date =
    new Date(
      Date.UTC(
        year,
        month,
        1,
      ),
    );

  return {
    year:
      date.getUTCFullYear(),

    monthName:
      new Intl.DateTimeFormat(
        "en-US",
        {
          month:
            "long",

          timeZone:
            "UTC",
        },
      ).format(
        date,
      ),
  };
}

function getPortlandDate(): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Los_Angeles",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    },
  ).format(
    new Date(),
  );
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