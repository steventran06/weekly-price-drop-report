import dotenv from "dotenv";
import { google } from "googleapis";
import { authorize } from "./gmail/auth.js";
import { generateBlogPost } from "./blog/generateBlogPost.js";
import { publishBlogPost } from "./github/publishBlogPost.js";
import { writeBlogPost } from "./output/writeBlogPost.js";
import { analyzeListings } from "./analysis/analyzeListings.js";
import { findPriceDropEmails } from "./gmail/findPriceDropEmails.js";
import { sendWeeklyReport } from "./gmail/sendWeeklyReport.js";
import { writeAnalysisFiles } from "./output/writeAnalysis.js";
import {
  fetchRmlsReport,
  saveRawReportHtml,
} from "./rmls/fetchReport.js";
import { parseSavedRmlsReport } from "./rmls/parseListings.js";
import { writeListingsJson } from "./output/writeListings.js";
dotenv.config();

async function main(): Promise<void> {
  console.log("================================");
  console.log(" Weekly Price Drop Report");
  console.log("================================");

  console.log("Authenticating...");

  const auth = await authorize();

  console.log("Authentication completed.");

  const gmail = google.gmail({
    version: "v1",
    auth,
  });

  const emails = await findPriceDropEmails(gmail);

  if (emails.length === 0) {
    console.log("No PRICE DROP emails found in the last 5 days.");
    return;
  }

  const reportLinks = emails
    .map((email) => email.firstRmlsLink)
    .filter((link): link is string => Boolean(link));

  if (reportLinks.length === 0) {
    console.log("No RMLS report links were found.");
    return;
  }

  /*
   * Use the newest matching email only.
   * Gmail normally returns newest messages first.
   */
  const reportLink = reportLinks[0];

  console.log(`Found ${reportLinks.length} RMLS report link(s).`);
  console.log("Using the newest report.");

  const report = await fetchRmlsReport(reportLink);

  console.log(`HTTP status: ${report.status}`);
  console.log(`Downloaded ${report.html.length} characters.`);

  const rawReportPath = await saveRawReportHtml(report.html);

  console.log(`Saved raw report to: ${rawReportPath}`);

  const listings = await parseSavedRmlsReport();

  console.log(`Parsed ${listings.length} unique listing(s).`);

  const listingsPath = await writeListingsJson(listings);

  console.log(`Saved listings to: ${listingsPath}`);

  console.log("");
  console.log("Top-level listing summary");
  console.log("-------------------------");

  for (const [index, listing] of listings.entries()) {
    const currentPrice = listing.currentPrice
      ? listing.currentPrice.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "Unknown price";

    const originalPrice = listing.originalPrice
      ? listing.originalPrice.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "Unknown";

    const reduction = listing.totalPriceReduction
      ? listing.totalPriceReduction.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : "Unknown";

    console.log(
      `${index + 1}. ${listing.address ?? "Unknown address"} ` +
        `— Current: ${currentPrice}, Original: ${originalPrice}, ` +
        `Reduction: ${reduction}`,
    );
  }

  console.log("");
  console.log("Data collection completed.");

  const analysis = await analyzeListings(listings);

  console.log("");
  console.log("Generating weekly blog post...");

  const blogPost = await generateBlogPost(
    analysis,
    listings,
  );

  const blogPath = await writeBlogPost(
    blogPost,
  );

  console.log(`Generated blog post: ${blogPath}`);

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

  console.log(
    `Selected ${analysis.selectedListings.length} listing(s).`,
  );

  const analysisPaths = await writeAnalysisFiles(analysis);

  console.log("");
  console.log("Emailing weekly report...");

  await sendWeeklyReport(
    gmail,
    analysis,
    reportLink,
  );

  console.log(
    "Weekly report emailed to " +
      (process.env.REPORT_RECIPIENT ||
        "steven@diverserg.com"),
  );

  console.log("");
  console.log("Generated AI deliverables:");
  console.log(`- ${analysisPaths.jsonPath}`);
  console.log(`- ${analysisPaths.reportPath}`);
  console.log(`- ${analysisPaths.scriptPath}`);
  console.log(`- ${analysisPaths.instagramPath}`);
  console.log(`- ${analysisPaths.youtubePath}`);

  console.log("");
  console.log("Selected listings");
  console.log("-----------------");

  for (const listing of analysis.selectedListings) {
    console.log(
      `${listing.rank}. ${listing.address} — ${listing.shortReason}`,
    );
  }

  console.log("");
  console.log("45-second script");
  console.log("----------------");
  console.log(analysis.reelScript);

  console.log("");
  console.log("Weekly report completed.");
}

main().catch((error: unknown) => {
  console.error("");
  console.error("Application failed:");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});