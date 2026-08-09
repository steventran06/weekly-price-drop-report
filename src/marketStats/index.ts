import dotenv from "dotenv";
import { google } from "googleapis";

import {
  authorize,
} from "../gmail/auth.js";

import {
  publishBlogPost,
} from "../github/publishBlogPost.js";

import {
  publishHistoricalSnapshot,
} from "../github/publishHistoricalSnapshot.js";

import {
  publishWebsiteMarketStats,
} from "../github/publishWebsiteMarketStats.js";

import {
  saveHistoricalSnapshot,
} from "../history/saveHistoricalSnapshot.js";

import {
  downloadMarketStatsPdf,
} from "./downloadMarketStatsPdf.js";

import {
  extractMarketStats,
} from "./extractMarketStats.js";

import type {
  ExtractedMarketStats,
} from "./extractMarketStats.js";

import {
  analyzeMarketStats,
} from "./analyzeMarketStats.js";

import {
  writeMarketAnalysis,
} from "./writeMarketAnalysis.js";

import {
  generateMarketStatsContent,
} from "./generateMarketStatsContent.js";

import {
  generateMarketStatsBlog,
} from "./generateMarketStatsBlog.js";

import {
  writeMarketStatsContent,
} from "./writeMarketStatsContent.js";

import {
  sendMarketStatsReport,
} from "./sendMarketStatsReport.js";

import {
  buildWebsiteMarketStats,
} from "./buildWebsiteMarketStats.js";

dotenv.config();

async function main(): Promise<void> {
  console.log(
    "================================",
  );
  console.log(
    " Oregon + Washington TMO Stats",
  );
  console.log(
    "================================",
  );

  console.log(
    "Authenticating...",
  );

  const auth =
    await authorize();

  console.log(
    "Authentication completed.",
  );

  const gmail =
    google.gmail({
      version:
        "v1",
      auth,
    });

  /*
   * Download the newest report from each Gmail label.
   * A missing report is allowed; the other region can
   * still be processed and published.
   */
  const oregonPdf =
    await downloadMarketStatsPdf(
      gmail,
      {
        label:
          "TMO Reports",
        region:
          "oregon",
        displayName:
          "Oregon TMO report",
        newerThanDays:
          7,
      },
    );

  const washingtonPdf =
    await downloadMarketStatsPdf(
      gmail,
      {
        label:
          "WA TMO Reports",
        region:
          "washington",
        displayName:
          "Washington TMO report",
        newerThanDays:
          7,
      },
    );

  if (
    !oregonPdf &&
    !washingtonPdf
  ) {
    console.log("");
    console.log(
      "No Oregon or Washington TMO report was found in the configured lookback window.",
    );
    console.log(
      "Skipping weekly market stats workflow.",
    );

    return;
  }

  let oregonStats:
    ExtractedMarketStats | null =
    null;

  let washingtonStats:
    ExtractedMarketStats | null =
    null;

  if (oregonPdf) {
    console.log("");
    console.log(
      `Oregon PDF: ${oregonPdf.filename}`,
    );

    oregonStats =
      await extractMarketStats(
        oregonPdf.outputPath,
        {
          region:
            "oregon",
          outputFilename:
            "market-stats-oregon.json",
        },
      );

    if (
      oregonStats.markets.length ===
      0
    ) {
      console.warn(
        "No Oregon market rows were extracted.",
      );

      oregonStats =
        null;
    }
  }

  if (washingtonPdf) {
    console.log("");
    console.log(
      `Washington PDF: ${washingtonPdf.filename}`,
    );

    washingtonStats =
      await extractMarketStats(
        washingtonPdf.outputPath,
        {
          region:
            "washington",
          outputFilename:
            "market-stats-washington.json",
        },
      );

    if (
      washingtonStats.markets.length ===
      0
    ) {
      console.warn(
        "No Washington market rows were extracted.",
      );

      washingtonStats =
        null;
    }
  }

  if (
    !oregonStats &&
    !washingtonStats
  ) {
    console.log("");
    console.log(
      "TMO PDFs were found, but neither report produced market data.",
    );

    return;
  }

  /*
   * Publish ONE combined latest.json.
   *
   * This avoids the second region overwriting the first
   * region in the website repository.
   */
  const combinedStats:
    ExtractedMarketStats = {
      sourcePdf:
        [
          oregonStats?.sourcePdf,
          washingtonStats?.sourcePdf,
        ]
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          )
          .join(", "),

      extractedAt:
        new Date()
          .toISOString(),

      markets: [
        ...(
          oregonStats?.markets ??
          []
        ),
        ...(
          washingtonStats?.markets ??
          []
        ),
      ],
    };

  const attachmentFilenames =
    [
      oregonPdf?.filename,
      washingtonPdf?.filename,
    ].filter(
      (
        value,
      ): value is string =>
        Boolean(value),
    );

  const websiteMarketStats =
    buildWebsiteMarketStats(
      combinedStats,
      attachmentFilenames,
    );

  const websiteMarketStatsUrl =
    await publishWebsiteMarketStats(
      websiteMarketStats,
    );

  console.log(
    `Published combined website market stats: ${websiteMarketStatsUrl}`,
  );

  /*
   * Everything below this point remains OREGON ONLY.
   *
   * Washington rows are intentionally excluded from:
   * - historical Portland market snapshots
   * - market analysis
   * - generated blog/reel/social content
   * - the weekly market-stats email
   *
   * That preserves the behavior of the existing Portland
   * reporting workflow while still feeding WA data to the site.
   */
  if (
    !oregonStats ||
    !oregonPdf
  ) {
    console.log("");
    console.log(
      "No Oregon TMO report was available.",
    );
    console.log(
      "Washington website stats were published, but Oregon analysis/content was skipped.",
    );

    return;
  }

  const snapshotDate =
    getPortlandDate();

  const historicalSnapshot = {
    snapshotDate,

    source: {
      gmailMessageId:
        oregonPdf.messageId,

      subject:
        oregonPdf.subject,

      internalDate:
        oregonPdf.internalDate,

      attachmentFilename:
        oregonPdf.filename,

      source:
        "weekly-market-stats-workflow",
    },

    report:
      oregonStats,
  };

  const historicalPath =
    await saveHistoricalSnapshot(
      "market-stats",
      historicalSnapshot,
    );

  const historicalGitHubUrl =
    await publishHistoricalSnapshot(
      "market-stats",
      historicalPath,
    );

  console.log(
    `Published historical Oregon market stats: ${historicalGitHubUrl}`,
  );

  const analysis =
    analyzeMarketStats(
      oregonStats,
    );

  const analysisPath =
    await writeMarketAnalysis(
      analysis,
    );

  console.log("");
  console.log(
    `Saved market analysis to: ${analysisPath}`,
  );

  console.log("");
  console.log(
    "Generating Oregon market stats content...",
  );

  const generatedContent =
    await generateMarketStatsContent(
      oregonStats,
      analysis,
    );

  const blog =
    generateMarketStatsBlog(
      generatedContent,
      oregonStats,
      analysis,
    );

  const contentPaths =
    await writeMarketStatsContent(
      generatedContent,
      blog,
    );

  console.log("");
  console.log(
    "Generated Oregon market content:",
  );
  console.log(
    `- Blog: ${contentPaths.blogPath}`,
  );
  console.log(
    `- Reel: ${contentPaths.reelPath}`,
  );
  console.log(
    `- Instagram: ${contentPaths.instagramPath}`,
  );
  console.log(
    `- YouTube: ${contentPaths.youtubePath}`,
  );
  console.log(
    `- JSON: ${contentPaths.contentJsonPath}`,
  );

  console.log("");
  console.log(
    "Publishing Oregon market stats blog to website repository...",
  );

  const publishedBlogUrl =
    await publishBlogPost(
      blog,
    );

  console.log(
    `Published market stats blog: ${publishedBlogUrl}`,
  );

  console.log("");
  console.log(
    "Emailing Oregon market stats report...",
  );

  await sendMarketStatsReport(
    gmail,
    oregonStats,
    analysis,
    generatedContent,
    blog,
  );

  console.log(
    "Market stats report emailed to " +
      (
        process.env.REPORT_RECIPIENT ||
        "steven@diverserg.com"
      ),
  );

  console.log("");
  console.log(
    "Market Analysis",
  );
  console.log(
    "---------------",
  );

  console.log("");
  console.log(
    "Most Competitive Single-Family Markets",
  );

  for (
    const market
    of analysis.hottestSingleFamily
  ) {
    console.log(
      `${market.rank}. ${market.area} — ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}, ` +
        `${formatPercent(
          market.pendingActiveRatio,
        )} pending ratio, ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM`,
    );
  }

  console.log("");
  console.log(
    "Strongest Single-Family Buyer Opportunities",
  );

  for (
    const market
    of analysis.strongestBuyerOpportunities
  ) {
    console.log(
      `${market.rank}. ${market.area} — ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}, ` +
        `${formatPercent(
          market.pendingActiveRatio,
        )} pending ratio, ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM`,
    );
  }

  console.log("");
  console.log(
    "Most Competitive Condo Markets",
  );

  for (
    const market
    of analysis.hottestCondoMarkets
  ) {
    console.log(
      `${market.rank}. ${market.area} — ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}, ` +
        `${formatPercent(
          market.pendingActiveRatio,
        )} pending ratio, ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM`,
    );
  }

  console.log("");
  console.log(
    "Strongest Condo Buyer Opportunities",
  );

  for (
    const market
    of analysis.strongestCondoBuyerOpportunities
  ) {
    console.log(
      `${market.rank}. ${market.area} — ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}, ` +
        `${formatPercent(
          market.pendingActiveRatio,
        )} pending ratio, ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM`,
    );
  }

  console.log("");
  console.log(
    "Largest Condo vs Single-Family Inventory Gaps",
  );

  for (
    const comparison
    of analysis.condoVsSingleFamily.slice(
      0,
      5,
    )
  ) {
    console.log(
      `${comparison.area} — ` +
        `Single Family: ${formatInventory(
          comparison.singleFamilyInventory,
        )}, ` +
        `Condo: ${formatInventory(
          comparison.condoInventory,
        )}, ` +
        `Gap: ${formatInventory(
          comparison.inventoryGap,
        )}`,
    );
  }

  console.log("");
  console.log(
    "Historical Snapshot",
  );
  console.log(
    "-------------------",
  );
  console.log(
    `Date: ${snapshotDate}`,
  );
  console.log(
    `Local: ${historicalPath}`,
  );
  console.log(
    `GitHub: ${historicalGitHubUrl}`,
  );

  console.log("");
  console.log(
    "Market stats workflow completed.",
  );
}

function getPortlandDate(): string {
  const parts =
    new Intl.DateTimeFormat(
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
    ).formatToParts(
      new Date(),
    );

  const year =
    parts.find(
      (part) =>
        part.type ===
        "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type ===
        "day",
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

function formatPercent(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return `${value}%`;
}

function formatInventory(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return `${value} mo`;
}

function formatDays(
  value: number | null,
): string {
  if (value === null) {
    return "N/A";
  }

  return `${value}`;
}

main().catch(
  (
    error:
      unknown,
  ) => {
    console.error("");
    console.error(
      "Application failed:",
    );

    if (
      error instanceof Error
    ) {
      console.error(
        error.message,
      );
      console.error(
        error.stack,
      );
    } else {
      console.error(
        error,
      );
    }

    process.exitCode =
      1;
  },
);
