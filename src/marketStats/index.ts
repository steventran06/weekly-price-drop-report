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

import {
  validateRegionalMarketStats,
} from "./marketStatsHelpers.js";

import {
  updateWebsiteYoutube,
} from "../youtube/index.js";

import type {
  DownloadedMarketStatsPdf,
} from "./downloadMarketStatsPdf.js";

import type {
  MarketStatsRegion,
} from "./extractMarketStats.js";

import {
  generateAndMaybePublishMarketStatsInstagram,
} from "../social/instagram/marketStatsInstagram.js";

dotenv.config();

async function main(): Promise<void> {
  /*
   * YouTube sync is intentionally independent from the TMO workflow.
   * If YouTube changes its public page markup or a playlist fetch fails,
   * market stats should still continue and publish normally.
   */
  try {
    await updateWebsiteYoutube();
  } catch (error) {
    console.error(
      "YouTube sync failed; continuing with market stats without changing youtube.json.",
    );
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

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

  const oregonStats =
    await extractUsableRegionStats(
      oregonPdf,
      "oregon",
      "market-stats-oregon.json",
    );

  const washingtonStats =
    await extractUsableRegionStats(
      washingtonPdf,
      "washington",
      "market-stats-washington.json",
    );

  if (
    !oregonStats &&
    !washingtonStats
  ) {
    console.log("");
    console.log(
      "Neither regional TMO report produced a complete, publishable dataset.",
    );
    console.log(
      "The website latest.json will NOT be changed.",
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
      oregonStats
        ? oregonPdf?.filename
        : null,
      washingtonStats
        ? washingtonPdf?.filename
        : null,
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

  /*
   * buildWebsiteMarketStats() already normalizes every regional row to
   * the canonical TMO report date. Reuse those normalized Oregon rows
   * for all downstream Portland analysis/content as a second line of
   * defense against malformed or unexpectedly ordered PDF text.
   */
  const normalizedOregonStats:
    ExtractedMarketStats | null =
    oregonStats
      ? {
          ...oregonStats,
          markets:
            websiteMarketStats.markets.filter(
              (market) =>
                market.sourceRegion ===
                "oregon",
            ),
        }
      : null;

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
    !normalizedOregonStats ||
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
      normalizedOregonStats,
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
      normalizedOregonStats,
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
      normalizedOregonStats,
      analysis,
    );

  const blog =
    generateMarketStatsBlog(
      generatedContent,
      normalizedOregonStats,
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

  /*
   * Instagram carousel generation is intentionally non-blocking.
   * The rendered JPEGs are attached to the weekly email so they can
   * be saved to a phone and posted manually. SVG source files stay
   * local and are never attached.
   */
  let instagramImagePaths: string[] = [];

  try {
    const renderedInstagram =
      await generateAndMaybePublishMarketStatsInstagram(
        normalizedOregonStats,
        analysis,
        generatedContent,
      );

    instagramImagePaths =
      renderedInstagram?.imagePaths ?? [];

    if (instagramImagePaths.length > 0) {
      console.log(
        `${instagramImagePaths.length} Instagram JPEG(s) will be attached to the weekly email.`,
      );
    }
  } catch (error) {
    console.error(
      "Instagram workflow failed; continuing with the weekly market stats workflow.",
    );
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

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
    normalizedOregonStats,
    analysis,
    generatedContent,
    blog,
    instagramImagePaths,
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

async function extractUsableRegionStats(
  pdf: DownloadedMarketStatsPdf | null,
  region: MarketStatsRegion,
  outputFilename: string,
): Promise<ExtractedMarketStats | null> {
  const label =
    region ===
    "oregon"
      ? "Oregon"
      : "Washington";

  if (
    !pdf
  ) {
    console.log("");
    console.log(
      `${label} TMO report was not found.`,
    );
    console.log(
      `${label} website data will be preserved if it already exists.`,
    );

    return null;
  }

  console.log("");
  console.log(
    `${label} PDF: ${pdf.filename}`,
  );

  try {
    const stats =
      await extractMarketStats(
        pdf.outputPath,
        {
          region,
          outputFilename,
        },
      );

    const validation =
      validateRegionalMarketStats(
        stats,
        region,
      );

    if (
      !validation.usable
    ) {
      console.warn(
        `${label} TMO data is incomplete and will NOT replace existing website data.`,
      );

      for (
        const reason
        of validation.reasons
      ) {
        console.warn(
          `- ${reason}`,
        );
      }

      return null;
    }

    console.log(
      `${label} markets ready for website publish: ${stats.markets.length}`,
    );

    return stats;
  } catch (
    error
  ) {
    console.warn(
      `${label} TMO parsing failed. Existing ${label} website data will be preserved.`,
    );

    if (
      error instanceof Error
    ) {
      console.warn(
        error.message,
      );
    } else {
      console.warn(
        error,
      );
    }

    return null;
  }
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
