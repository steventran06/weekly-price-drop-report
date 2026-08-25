import dotenv from "dotenv";
import { google } from "googleapis";

import {
  authorize,
} from "../gmail/auth.js";

import {
  generateBlogPost,
} from "../blog/generateBlogPost.js";

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
  writeBlogPost,
} from "../output/writeBlogPost.js";

import {
  analyzeListings,
} from "../analysis/analyzeListings.js";

import {
  findPriceDropEmails,
} from "./findPriceDropEmails.js";

import {
  sendWeeklyReport,
} from "./sendWeeklyReport.js";

import {
  writeAnalysisFiles,
} from "../output/writeAnalysis.js";

import {
  fetchRmlsReport,
  saveRawReportHtml,
} from "../rmls/fetchReport.js";

import {
  parseSavedRmlsReport,
} from "../rmls/parseListings.js";

import {
  writeListingsJson,
} from "../output/writeListings.js";

import {
  generatePriceDropInstagramCarousel,
} from "../social/instagram/priceDropInstagram.js";

dotenv.config();

async function main(): Promise<void> {
  console.log(
    "================================",
  );

  console.log(
    " Weekly Price Drop Report",
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
   * Find source emails.
   */
  const emails =
    await findPriceDropEmails(
      gmail,
    );

  if (
    emails.length ===
    0
  ) {
    console.log(
      "No matching PRICE DROP source emails found.",
    );

    console.log(
      "Skipping weekly price-drop workflow.",
    );

    return;
  }

  const selectedEmail =
    emails.find(
      (email) =>
        Boolean(
          email.reportUrl,
        ),
    );

  if (
    !selectedEmail?.reportUrl
  ) {
    console.log(
      "No RMLS report links were found.",
    );

    console.log(
      "Skipping weekly price-drop workflow.",
    );

    return;
  }

  const reportLink =
    selectedEmail.reportUrl;

  console.log(
    `Using email: ${selectedEmail.subject}`,
  );

  console.log(
    `Found ${selectedEmail.rmlsLinks.length} unique RMLS report link(s) in the selected email.`,
  );

  if (
    selectedEmail.rmlsLinks.length >=
    2
  ) {
    console.log(
      "Using the second RMLS report link.",
    );
  } else {
    console.warn(
      "The selected PRICE DROP email only contained one unique RMLS report link; using that link as a fallback.",
    );
  }

  /*
   * Step 3:
   * Download RMLS report.
   */
  const report =
    await fetchRmlsReport(
      reportLink,
    );

  console.log(
    `HTTP status: ${report.status}`,
  );

  console.log(
    `Downloaded ${report.html.length} characters.`,
  );

  const rawReportPath =
    await saveRawReportHtml(
      report.html,
    );

  console.log(
    `Saved raw report to: ${rawReportPath}`,
  );

  /*
   * Step 4:
   * Parse all listings.
   */
  const listings =
    await parseSavedRmlsReport();

  console.log(
    `Parsed ${listings.length} unique listing(s).`,
  );

  if (
    listings.length ===
    0
  ) {
    console.log(
      "No listings were parsed.",
    );

    console.log(
      "Skipping price-drop workflow.",
    );

    return;
  }

  const listingsPath =
    await writeListingsJson(
      listings,
    );

  console.log(
    `Saved listings to: ${listingsPath}`,
  );

  /*
   * Step 5:
   * Save ALL price-drop listings into
   * the permanent historical dataset.
   */
  const snapshotDate =
    getPortlandDate();

  const historicalSnapshot = {
    snapshotDate,

    source: {
      reportUrl:
        reportLink,

      capturedAt:
        new Date()
          .toISOString(),

      source:
        "weekly-price-drop-workflow",
    },

    listingCount:
      listings.length,

    listings,
  };

  const historicalPath =
    await saveHistoricalSnapshot(
      "price-drops",
      historicalSnapshot,
    );

  const historicalGitHubUrl =
    await publishHistoricalSnapshot(
      "price-drops",
      historicalPath,
    );

  console.log(
    `Published historical price drops: ${historicalGitHubUrl}`,
  );

  /*
   * Console listing summary.
   */
  console.log("");

  console.log(
    "Top-level listing summary",
  );

  console.log(
    "-------------------------",
  );

  for (
    const [
      index,
      listing,
    ]
    of listings.entries()
  ) {
    const currentPrice =
      listing.currentPrice
        ? listing.currentPrice.toLocaleString(
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
        : "Unknown price";

    const originalPrice =
      listing.originalPrice
        ? listing.originalPrice.toLocaleString(
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
        : "Unknown";

    const reduction =
      listing.totalPriceReduction
        ? listing.totalPriceReduction.toLocaleString(
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
        : "Unknown";

    console.log(
      `${index + 1}. ${listing.address ?? "Unknown address"} ` +
        `— Current: ${currentPrice}, Original: ${originalPrice}, ` +
        `Reduction: ${reduction}`,
    );
  }

  console.log("");

  console.log(
    "Data collection completed.",
  );

  /*
   * Step 6:
   * AI listing analysis.
   */
  const analysis =
    await analyzeListings(
      listings,
    );

  console.log(
    `Selected ${analysis.selectedListings.length} listing(s).`,
  );

  /*
   * Generate the Portland Home Guide social carousel.
   * This is intentionally non-blocking: the Wednesday report should
   * still send even if a listing photo or carousel render fails.
   */
  let instagramImagePaths: string[] = [];
  let portlandHomeGuideCaption: string | null = null;

  try {
    const renderedCarousel =
      await generatePriceDropInstagramCarousel(
        analysis,
        listings,
      );

    instagramImagePaths =
      renderedCarousel?.imagePaths ?? [];

    portlandHomeGuideCaption =
      renderedCarousel?.caption ?? null;

    if (instagramImagePaths.length > 0) {
      console.log(
        `${instagramImagePaths.length} Portland Home Guide carousel JPEG(s) will be attached to the Wednesday email.`,
      );
    }
  } catch (error) {
    console.error(
      "Price-drop carousel generation failed; continuing with the Wednesday report.",
    );
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  /*
   * Step 7:
   * Generate blog.
   */
  console.log("");

  console.log(
    "Generating weekly blog post...",
  );

  const blogPost =
    await generateBlogPost(
      analysis,
      listings,
    );

  const blogPath =
    await writeBlogPost(
      blogPost,
    );

  console.log(
    `Generated blog post: ${blogPath}`,
  );

  /*
   * Step 8:
   * Publish blog.
   */
  console.log("");

  console.log(
    "Publishing blog post to website repository...",
  );

  const publishedBlogUrl =
    await publishBlogPost(
      blogPost,
    );

  console.log(
    `Published blog post: ${publishedBlogUrl}`,
  );

  /*
   * Step 9:
   * Save generated AI files.
   */
  const analysisPaths =
    await writeAnalysisFiles(
      analysis,
    );

  /*
   * Step 10:
   * Send weekly report.
   */
  console.log("");

  console.log(
    "Emailing weekly report...",
  );

  await sendWeeklyReport(
    gmail,
    analysis,
    reportLink,
    instagramImagePaths,
    portlandHomeGuideCaption,
  );

  console.log(
    "Weekly report emailed to " +
      (
        process.env.REPORT_RECIPIENT ||
        "steven@diverserg.com"
      ),
  );

  console.log("");

  console.log(
    "Generated AI deliverables:",
  );

  console.log(
    `- ${analysisPaths.jsonPath}`,
  );

  console.log(
    `- ${analysisPaths.reportPath}`,
  );

  console.log(
    `- ${analysisPaths.scriptPath}`,
  );

  console.log(
    `- ${analysisPaths.instagramPath}`,
  );

  console.log(
    `- ${analysisPaths.googleBusinessPostPath}`,
  );

  console.log(
    `- ${analysisPaths.youtubePath}`,
  );

  console.log("");

  console.log(
    "Selected listings",
  );

  console.log(
    "-----------------",
  );

  for (
    const listing
    of analysis.selectedListings
  ) {
    console.log(
      `${listing.rank}. ${listing.address} — ${listing.shortReason}`,
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
    `Listings stored: ${listings.length}`,
  );

  console.log(
    `Local: ${historicalPath}`,
  );

  console.log(
    `GitHub: ${historicalGitHubUrl}`,
  );

  console.log("");

  console.log(
    "Weekly report completed.",
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
      "Could not determine Portland snapshot date.",
    );
  }

  return `${year}-${month}-${day}`;
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