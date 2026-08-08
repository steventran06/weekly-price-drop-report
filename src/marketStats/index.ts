import dotenv from "dotenv";
import { google } from "googleapis";

import { authorize } from "../gmail/auth.js";
import { publishBlogPost } from "../github/publishBlogPost.js";

import { downloadMarketStatsPdf } from "./downloadMarketStatsPdf.js";
import { extractMarketStats } from "./extractMarketStats.js";
import { analyzeMarketStats } from "./analyzeMarketStats.js";
import { writeMarketAnalysis } from "./writeMarketAnalysis.js";
import { generateMarketStatsContent } from "./generateMarketStatsContent.js";
import { generateMarketStatsBlog } from "./generateMarketStatsBlog.js";
import { writeMarketStatsContent } from "./writeMarketStatsContent.js";
import { sendMarketStatsReport } from "./sendMarketStatsReport.js";

dotenv.config();

async function main(): Promise<void> {
  console.log("================================");
  console.log(" Portland Metro Market Stats");
  console.log("================================");

  /*
   * Step 1:
   * Authenticate with Gmail.
   */
  console.log("Authenticating...");

  const auth =
    await authorize();

  console.log(
    "Authentication completed.",
  );

  const gmail =
    google.gmail({
      version: "v1",
      auth,
    });

  /*
   * Step 2:
   * Find and download the newest TMO Reports PDF.
   *
   * downloadMarketStatsPdf() should return null when
   * no matching email exists within the configured
   * Gmail search window.
   */
  const pdf =
    await downloadMarketStatsPdf(
      gmail,
    );

  /*
   * IMPORTANT:
   * No current TMO email means there is nothing to process.
   *
   * Exit successfully so Render does NOT treat this as a
   * failed cron job.
   *
   * Nothing below this point will run:
   * - PDF extraction
   * - OpenAI
   * - blog generation
   * - GitHub publishing
   * - report email
   */
  if (!pdf) {
    console.log("");
    console.log(
      "No TMO Reports email found in the last 5 days.",
    );

    console.log(
      "Skipping weekly market stats workflow.",
    );

    console.log("");
    console.log(
      "Market stats workflow completed with no source data.",
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
   * Extract structured market data
   * from every page of the PDF.
   */
  const stats =
    await extractMarketStats(
      pdf.outputPath,
    );

  /*
   * Safety check:
   * Don't generate content from an empty extraction.
   */
  if (
    stats.markets.length === 0
  ) {
    console.log("");
    console.log(
      "No market data was extracted from the TMO report.",
    );

    console.log(
      "Skipping content generation and publishing.",
    );

    return;
  }

  /*
   * Step 4:
   * Analyze and rank the markets.
   */
  const analysis =
    analyzeMarketStats(
      stats,
    );

  /*
   * Step 5:
   * Save structured market-analysis JSON.
   */
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
   * Generate blog, Reel, Instagram
   * and YouTube content.
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
   * Assemble the Markdown blog.
   */
  const blog =
    generateMarketStatsBlog(
      generatedContent,
      stats,
      analysis,
    );

  /*
   * Step 8:
   * Save generated deliverables locally.
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
   * Publish the Markdown post to the
   * real-estate blog GitHub repository.
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
   * Email the complete market package.
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
   * Console analysis summary.
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
    "Fastest Single-Family Markets",
  );

  for (
    const market
    of analysis.fastestSingleFamilyMarkets
  ) {
    console.log(
      `${market.rank}. ${market.area} — ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM, ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}`,
    );
  }

  console.log("");
  console.log(
    "Slowest Single-Family Markets",
  );

  for (
    const market
    of analysis.slowestSingleFamilyMarkets
  ) {
    console.log(
      `${market.rank}. ${market.area} — ` +
        `${formatDays(
          market.averageDaysOnMarketSold,
        )} DOM, ` +
        `${formatInventory(
          market.monthsOfInventory,
        )}`,
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
        `Gap: ${formatInventoryGap(
          comparison.inventoryGap,
        )}`,
    );
  }

  /*
   * Greater Portland aggregate.
   */
  if (
    analysis.metroAggregate
  ) {
    const metro =
      analysis.metroAggregate;

    console.log("");
    console.log(
      "Greater Portland Single-Family Aggregate",
    );

    console.log(
      "----------------------------------------",
    );

    console.log(
      [
        `Active: ${formatNumber(
          metro.activeListings,
        )}`,

        `Pending: ${formatNumber(
          metro.pendingListings,
        )}`,

        `Pending Ratio: ${formatPercent(
          metro.pendingActiveRatio,
        )}`,

        `Inventory: ${formatInventory(
          metro.monthsOfInventory,
        )}`,

        `Avg Original List: ${formatCurrency(
          metro.averageOriginalListPrice,
        )}`,

        `Avg Final List: ${formatCurrency(
          metro.averageFinalListPrice,
        )}`,

        `Avg Sale: ${formatCurrency(
          metro.averageSalePrice,
        )}`,

        `Sold DOM: ${formatDays(
          metro.averageDaysOnMarketSold,
        )}`,

        `Active DOM: ${formatDays(
          metro.averageDaysOnMarketActive,
        )}`,
      ].join(" | "),
    );
  }

  /*
   * Print the entire extracted dataset
   * for debugging / Render logs.
   */
  console.log("");
  console.log(
    "Full Market Summary",
  );

  console.log(
    "-------------------",
  );

  for (
    const market
    of stats.markets
  ) {
    console.log(
      [
        market.area,

        market.propertyType,

        `Active: ${formatNumber(
          market.activeListings,
        )}`,

        `Pending: ${formatNumber(
          market.pendingListings,
        )}`,

        `Pending Ratio: ${formatPercent(
          market.pendingActiveRatio,
        )}`,

        `Inventory: ${formatInventory(
          market.monthsOfInventory,
        )}`,

        `Closed: ${formatNumber(
          market.closedListingsThreeMonths,
        )}`,

        `Avg Original: ${formatCurrency(
          market.averageOriginalListPrice,
        )}`,

        `Avg Final: ${formatCurrency(
          market.averageFinalListPrice,
        )}`,

        `Avg Sale: ${formatCurrency(
          market.averageSalePrice,
        )}`,

        `Sold DOM: ${formatDays(
          market.averageDaysOnMarketSold,
        )}`,

        `Active DOM: ${formatDays(
          market.averageDaysOnMarketActive,
        )}`,
      ].join(" | "),
    );
  }

  console.log("");
  console.log(
    "Analysis Summary",
  );

  console.log(
    "----------------",
  );

  console.log(
    `Report date: ${
      analysis.reportDate ??
      "Unknown"
    }`,
  );

  console.log(
    `Markets analyzed: ${analysis.summary.totalMarketsAnalyzed}`,
  );

  console.log(
    `Single-family markets: ${analysis.summary.singleFamilyMarketsAnalyzed}`,
  );

  console.log(
    `Condo markets: ${analysis.summary.condoMarketsAnalyzed}`,
  );

  console.log("");
  console.log(
    "Market stats workflow completed.",
  );
}

function formatCurrency(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      maximumFractionDigits:
        0,
    },
  );
}

function formatNumber(
  value: number | null,
): string {
  if (
    value === null
  ) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
  );
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

function formatInventoryGap(
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
  (error: unknown) => {
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

    process.exitCode = 1;
  },
);