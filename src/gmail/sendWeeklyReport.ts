import type { gmail_v1 } from "googleapis";
import type { WeeklyAnalysis } from "../analysis/types.js";

const RECIPIENT =
  process.env.REPORT_RECIPIENT?.trim() ||
  "steven@diverserg.com";

export async function sendWeeklyReport(
  gmail: gmail_v1.Gmail,
  analysis: WeeklyAnalysis,
): Promise<string> {
  const subject = createSubject();
  const body = createEmailBody(analysis);

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
): string {
  const listings = [...analysis.selectedListings]
    .sort((a, b) => a.rank - b.rank)
    .map(
      (listing) => [
        `${listing.rank}. ${listing.address}`,
        `Current price: ${formatCurrency(listing.currentPrice)}`,
        `Exact reduction: ${listing.exactDropPlaceholder}`,
        `Why it made the cut: ${listing.shortReason}`,
        `Concern: ${listing.concern}`,
        "",
      ].join("\n"),
    )
    .join("\n");

  const factChecks = analysis.factCheckNotes
    .map((note) => `- ${note}`)
    .join("\n");

  return [
    analysis.title,
    "",
    analysis.summary,
    "",
    "TOP PICKS",
    "=========",
    "",
    listings,
    "45-SECOND SCRIPT",
    "================",
    "",
    analysis.reelScript,
    "",
    "FINAL FACT CHECK",
    "================",
    "",
    factChecks || "- Add the exact reduction for each selected listing.",
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