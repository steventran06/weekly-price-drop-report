import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { google } from "googleapis";

import {
  authorize,
} from "../gmail/auth.js";

import {
  getMonthlyPriceDropGmailQuery,
  getMonthlyTmoGmailQuery,
} from "../gmail/queries.js";

import {
  publishBlogPost,
} from "../github/publishBlogPost.js";

import {
  getPreviousMonthRange,
} from "./getPreviousMonthRange.js";

import {
  findMonthlySourceEmails,
} from "./findMonthlySourceEmails.js";

import {
  backfillMarketStats,
} from "./backfillMarketStats.js";

import {
  backfillPriceDrops,
} from "./backfillPriceDrops.js";

import {
  analyzeMonthlyMarketStats,
} from "./analyzeMonthlyMarketStats.js";

import {
  analyzeMonthlyPriceDrops,
} from "./analyzeMonthlyPriceDrops.js";

import {
  generateMonthlyBuyerContent,
} from "./generateMonthlyBuyerContent.js";

import {
  generateMonthlyBuyerBlog,
} from "./generateMonthlyBuyerBlog.js";

import {
  loadHistoricalMonth,
} from "./loadHistoricalMonth.js";

import {
  sendMonthlyBuyerReport,
} from "./sendMonthlyBuyerReport.js";

dotenv.config();

async function main(): Promise<void> {
  console.log(
    "================================",
  );

  console.log(
    " Monthly Portland Housing Lookback",
  );

  console.log(
    "================================",
  );

  /*
   * Step 1:
   * Determine previous calendar month.
   */
  const range =
    getPreviousMonthRange();

  console.log("");
  console.log(
    `Target month: ${range.monthName} ${range.year}`,
  );

  console.log(
    `Gmail range: after:${range.gmailAfter} before:${range.gmailBefore}`,
  );

  /*
   * Step 2:
   * Load saved historical JSON.
   */
  console.log("");
  console.log(
    "Checking saved historical data...",
  );

  let historical =
    await loadHistoricalMonth(
      range.year,
      range.month,
    );

  console.log(
    `Saved market-stat snapshots: ${historical.marketStats.length}`,
  );

  console.log(
    `Saved price-drop snapshots: ${historical.priceDrops.length}`,
  );

  /*
   * Step 3:
   * Authenticate with Gmail.
   */
  console.log("");
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
   * Step 4:
   * Find source emails.
   */
  const marketStatsEmails =
    await findMonthlySourceEmails(
      gmail,
      getMonthlyTmoGmailQuery(),
      range,
    );

  const priceDropEmails =
    await findMonthlySourceEmails(
      gmail,
      getMonthlyPriceDropGmailQuery(),
      range,
    );

  console.log("");
  console.log(
    `TMO source emails found: ${marketStatsEmails.length}`,
  );

  console.log(
    `PRICE DROP source emails found: ${priceDropEmails.length}`,
  );

  /*
   * Step 5:
   * Backfill missing market-stat history.
   */
  let savedMarketStatsFiles:
    string[] = [];

  if (
    historical.marketStats.length ===
    0
  ) {
    if (
      marketStatsEmails.length ===
      0
    ) {
      console.log("");
      console.log(
        "No market-stat history or source emails are available.",
      );

      console.log(
        "Skipping monthly report.",
      );

      return;
    }

    console.log("");
    console.log(
      "Backfilling market stats from Gmail...",
    );

    savedMarketStatsFiles =
      await backfillMarketStats(
        gmail,
        marketStatsEmails,
      );

    historical =
      await loadHistoricalMonth(
        range.year,
        range.month,
      );
  } else {
    console.log("");
    console.log(
      "Using existing market-stat history.",
    );
  }

  /*
   * Step 6:
   * Backfill missing price-drop history.
   */
  let savedPriceDropFiles:
    string[] = [];

  if (
    historical.priceDrops.length ===
      0 &&
    priceDropEmails.length >
      0
  ) {
    console.log("");
    console.log(
      "Backfilling price drops from Gmail...",
    );

    savedPriceDropFiles =
      await backfillPriceDrops(
        gmail,
        priceDropEmails,
      );

    historical =
      await loadHistoricalMonth(
        range.year,
        range.month,
      );
  } else if (
    historical.priceDrops.length >
    0
  ) {
    console.log("");
    console.log(
      `Using ${historical.priceDrops.length} existing price-drop snapshot(s).`,
    );
  } else {
    console.log("");
    console.log(
      "No price-drop history is available for this month.",
    );

    console.log(
      "Continuing without price-drop analysis.",
    );
  }

  /*
   * Step 7:
   * Analyze the month.
   */
  console.log("");
  console.log(
    "Analyzing monthly market data...",
  );

  const monthlyAnalysis =
    await analyzeMonthlyMarketStats(
      range.year,
      range.month,
    );

  const monthlyPriceDropAnalysis =
    analyzeMonthlyPriceDrops(
      historical.priceDrops,
    );

  console.log("");
  console.log(
    `${monthlyAnalysis.monthName} ${monthlyAnalysis.year} Analysis`,
  );

  console.log(
    "--------------------------------",
  );

  console.log(
    `Market snapshots: ${monthlyAnalysis.reportsAvailable}`,
  );

  console.log(
    `Price-drop snapshots: ${monthlyPriceDropAnalysis.snapshotCount}`,
  );

  console.log(
    `Single-family markets: ${monthlyAnalysis.singleFamilyMarkets.length}`,
  );

  console.log(
    `Condo markets: ${monthlyAnalysis.condoMarkets.length}`,
  );

  if (
    monthlyPriceDropAnalysis.snapshotCount >
    0
  ) {
    console.log(
      `Unique price-drop listings: ${monthlyPriceDropAnalysis.uniqueListings}`,
    );

    console.log(
      `Typical reduction: ${formatCurrency(
        monthlyPriceDropAnalysis.medianReduction,
      )}`,
    );

    console.log(
      `Largest reduction: ${formatCurrency(
        monthlyPriceDropAnalysis.largestReduction,
      )}`,
    );
  }

  /*
   * Step 8:
   * Generate article content.
   */
  console.log("");
  console.log(
    "Generating monthly housing content...",
  );

  const generatedContent =
    await generateMonthlyBuyerContent(
      monthlyAnalysis,
      monthlyPriceDropAnalysis,
    );

  /*
   * Step 9:
   * Generate Markdown.
   */
  console.log("");
  console.log(
    "Generating monthly housing blog...",
  );

  const blog =
    generateMonthlyBuyerBlog(
      generatedContent,
      monthlyAnalysis,
      monthlyPriceDropAnalysis,
    );

  /*
   * Step 10:
   * Save Markdown locally.
   */
  const outputDirectory =
    path.join(
      process.cwd(),
      "output",
      "monthly-buyer-report",
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive:
        true,
    },
  );

  const blogPath =
    path.join(
      outputDirectory,
      blog.filename,
    );

  await fs.writeFile(
    blogPath,
    blog.markdown,
    "utf8",
  );

  console.log(
    `Generated blog: ${blogPath}`,
  );

  /*
   * Step 11:
   * Publish blog.
   */
  console.log("");
  console.log(
    "Publishing monthly housing lookback...",
  );

  await publishBlogPost(
    blog,
  );

  const publicBlogUrl =
    `https://blog.steventranrealestate.com/posts/${blog.slug}/`;

  console.log(
    `Published blog: ${publicBlogUrl}`,
  );

  /*
   * Step 12:
   * Email monthly report.
   */
  console.log("");
  console.log(
    "Emailing monthly report...",
  );

  await sendMonthlyBuyerReport({
    gmail,
    marketAnalysis: monthlyAnalysis,
    priceDropAnalysis: monthlyPriceDropAnalysis,
    generatedContent,
    publicBlogUrl,
  });

  /*
   * Final summary.
   */
  console.log("");
  console.log(
    "Monthly Report Summary",
  );

  console.log(
    "----------------------",
  );

  console.log(
    `Target month: ${monthlyAnalysis.monthName} ${monthlyAnalysis.year}`,
  );

  console.log(
    `Market snapshots used: ${historical.marketStats.length}`,
  );

  console.log(
    `Price-drop snapshots used: ${historical.priceDrops.length}`,
  );

  console.log(
    `Market files backfilled: ${savedMarketStatsFiles.length}`,
  );

  console.log(
    `Price-drop files backfilled: ${savedPriceDropFiles.length}`,
  );

  console.log(
    `Unique price-drop listings analyzed: ${monthlyPriceDropAnalysis.uniqueListings}`,
  );

  console.log(
    `Published blog: ${publicBlogUrl}`,
  );

  console.log("");
  console.log(
    "Monthly housing lookback completed.",
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