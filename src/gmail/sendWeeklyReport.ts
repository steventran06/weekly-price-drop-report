import type { gmail_v1 } from "googleapis";
import type { WeeklyAnalysis } from "../analysis/types.js";

const RECIPIENT =
  process.env.REPORT_RECIPIENT?.trim() ||
  "steven@diverserg.com";

export async function sendWeeklyReport(
  gmail: gmail_v1.Gmail,
  analysis: WeeklyAnalysis,
  reportUrl: string,
): Promise<string> {
  const subject = createSubject();
  const body = createEmailBody(analysis, reportUrl);

  const mimeMessage = [
    `To: ${RECIPIENT}`,
    `From: ${RECIPIENT}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

  const raw = Buffer.from(mimeMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
    },
  });

  if (!response.data.id) {
    throw new Error(
      "Gmail reported success but did not return a message ID.",
    );
  }

  return response.data.id;
}

function createSubject(): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return `Weekly Price Drop Report - ${date}`;
}

function createEmailBody(
  analysis: WeeklyAnalysis,
  reportUrl: string,
): string {
  const listings = [...analysis.selectedListings]
    .sort((a, b) => a.rank - b.rank)
    .map(
      (listing) => [
        `${listing.rank}. ${listing.address}`,
        `Current price: ${formatCurrency(listing.currentPrice)}`,
        `Original price: ${formatNullableCurrency(listing.originalPrice)}`,
        `Total reduction: ${formatReduction(listing.totalPriceReduction)}`,
        `Why it made the cut: ${listing.shortReason}`,
        `Concern: ${listing.concern}`,
        "",
      ].join("\n"),
    )
    .join("\n");

  const factChecks = analysis.factCheckNotes
    .map((note) => `- ${note}`)
    .join("\n");

  const commaSeparatedMls = analysis.selectedListings
    .map((listing) => listing.mlsNumber)
    .join(", ");

  return [
    "PORTLAND METRO PRICE ALERT",
    "",
    analysis.summary,
    "",
    "RMLS LISTING REPORT",
    "===================",
    "",
    "Open the report for photos, listing details and exact price changes:",
    reportUrl,
    "",
    "TOP PICKS",
    "=========",
    "",
    listings,
    "",
    "MLS NUMBERS (Copy & Paste into RMLS)",
    "====================================",
    "",
    commaSeparatedMls,
    "",
    "REEL SCRIPT",
    "===========",
    "",
    analysis.reelScript,
    "",
    "INSTAGRAM CAPTION",
    "=================",
    "",
    analysis.instagramCaption,
    "",
    "YOUTUBE SHORTS TITLE",
    "====================",
    "",
    analysis.youtubeShortsTitle,
    "",
    "YOUTUBE SHORTS DESCRIPTION",
    "==========================",
    "",
    analysis.youtubeShortsDescription,
    "",
    "YOUTUBE KEYWORDS",
    "================",
    "",
    analysis.youtubeKeywords,
    "",
    "FINAL FACT CHECK",
    "================",
    "",
    factChecks ||
      "- Confirm the exact reduction for each selected listing.",
    "",
    "Generated automatically from the RMLS PRICE DROP report.",
  ].join("\n");
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatNullableCurrency(
  value: number | null,
): string {
  if (value === null) {
    return "Verify in RMLS";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatReduction(
  value: number | null,
): string {
  if (value === null || value <= 0) {
    return "Verify price history in RMLS";
  }

  const rounded =
    Math.round(value / 5000) * 5000;

  return `About ${rounded.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })} below the original list price`;
}