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
  saveHistoricalSnapshot,
} from "../history/saveHistoricalSnapshot.js";

import {
  downloadMarketStatsPdf,
} from "./downloadMarketStatsPdf.js";

import {
  extractMarketStats,
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

dotenv.config();

async function main(): Promise<void> {
  console.log(
    "================================",
  );

  console.log(
    " Portland Metro Market Stats",
  );

  console.log(
    "================================",
  );

  /*
   * Step 1:
   * Authenticate.
   */
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
   * Step 2:
   * Find and download newest TMO report.
   */
  const pdf =
    await downloadMarketStatsPdf(
      gmail,
    );

  /*
   * Missing source data is not an error.
   */
  if (
    !pdf
  ) {
    console.log("");

    console.log(
      "No TMO Reports email found in the last 5 days.",
    );

    console.log(
      "Skipping weekly market stats workflow.",
    );

    return;
  }

  console.log("");

  console.log(
    "PDF download completed.",
  );

  console.log(
    `File: ${pdf.filename}`,
  );

  /*
   * Step 3:
   * Extract structured market data.
   */
  const stats =
    await extractMarketStats(
      pdf.outputPath,
    );

  if (
    stats.markets.length ===
    0
  ) {
    console.log("");

    console.log(
      "No market data was extracted from the TMO report.",
    );

    console.log(
      "Skipping market stats workflow.",
    );

    return;
  }

  /*
   * Step 4:
   * Save a permanent historical snapshot.
   *
   * IMPORTANT:
   * This structure intentionally mirrors
   * the monthly backfill snapshots.
   */
  const snapshotDate =
    getPortlandDate();

  const historicalSnapshot = {
    snapshotDate,

    source: {
      gmailMessageId:
        null,

      subject:
        null,

      internalDate:
        null,

      attachmentFilename:
        pdf.filename,

      source:
        "weekly-market-stats-workflow",
    },

    report:
      stats,
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
    `Published historical market stats: ${historicalGitHubUrl}`,
  );

  /*
   * Step 5:
   * Analyze markets.
   */
  const analysis =
    analyzeMarketStats(
      stats,
    );

  const analysisPath =
    await writeMarketAnalysis(
      analysis,
    );

  console.log("");

  console.log(
    `Saved market analysis to: ${analysisPath}`,
  );

  /*
   * Step 6:
   * Generate content.
   */
  console.log("");

  console.log(
    "Generating market stats content...",
  );

  const generatedContent =
    await generateMarketStatsContent(
      stats,
      analysis,
    );

  /*
   * Step 7:
   * Assemble blog Markdown.
   */
  const blog =
    generateMarketStatsBlog(
      generatedContent,
      stats,
      analysis,
    );

  /*
   * Step 8:
   * Save generated content locally.
   */
  const contentPaths =
    await writeMarketStatsContent(
      generatedContent,
      blog,
    );

  console.log("");

  console.log(
    "Generated market content:",
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

  /*
   * Step 9:
   * Publish blog.
   */
  console.log("");

  console.log(
    "Publishing market stats blog to website repository...",
  );

  const publishedBlogUrl =
    await publishBlogPost(
      blog,
    );

  console.log(
    `Published market stats blog: ${publishedBlogUrl}`,
  );

  /*
   * Step 10:
   * Email finished report.
   */
  console.log("");

  console.log(
    "Emailing market stats report...",
  );

  await sendMarketStatsReport(
    gmail,
    stats,
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

  /*
   * Console summary.
   */
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
  if (
    value === null
  ) {
    return "N/A";
  }

  return `${value}%`;
}

function formatInventory(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return `${value} mo`;
}

function formatDays(
  value: number | null,
): string {
  if (
    value === null
  ) {
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