import type {
  gmail_v1,
} from "googleapis";

import {
  collectMessageText,
} from "../gmail/helpers.js";

import {
  selectRmlsReportLink,
} from "../rmls/emailReportLinks.js";

import {
  fetchRmlsReport,
  saveRawReportHtml,
} from "../rmls/fetchReport.js";

import {
  parseSavedRmlsReport,
} from "../rmls/parseListings.js";

import {
  saveHistoricalSnapshot,
} from "../history/saveHistoricalSnapshot.js";

import {
  publishHistoricalSnapshot,
} from "../github/publishHistoricalSnapshot.js";

import type {
  MonthlySourceEmail,
} from "./findMonthlySourceEmails.js";

export async function backfillPriceDrops(
  gmail: gmail_v1.Gmail,
  emails: MonthlySourceEmail[],
): Promise<string[]> {
  console.log("");
  console.log(
    "Backfilling historical price drops...",
  );

  if (
    emails.length ===
    0
  ) {
    console.log(
      "No PRICE DROP emails to backfill.",
    );

    return [];
  }

  const savedFiles: string[] = [];

  for (
    const email
    of emails
  ) {
    const snapshotDate =
      getSnapshotDate(
        email.internalDate,
      );

    if (
      !snapshotDate
    ) {
      console.warn(
        `Skipping Gmail message ${email.id}: could not determine email date.`,
      );

      continue;
    }

    console.log("");
    console.log(
      `Processing price-drop report for ${snapshotDate}: ${email.subject ?? "(no subject)"}`,
    );

    /*
     * Fetch the complete Gmail message because
     * our monthly source scan only loaded metadata.
     */
    const messageResponse =
      await gmail.users.messages.get({
        userId: "me",
        id: email.id,
        format: "full",
      });

    const messageText =
      collectMessageText(
        messageResponse.data.payload,
      );

    /*
     * PRICE DROP emails use the second unique
     * RMLS public-report URL for the full report.
     */
    const reportUrl =
      selectRmlsReportLink(
        messageText,
        "second",
      );

    if (
      !reportUrl
    ) {
      console.warn(
        `No RMLS report link found in PRICE DROP email from ${snapshotDate}.`,
      );

      continue;
    }

    console.log(
      `Found RMLS report: ${reportUrl}`,
    );

    /*
     * Reuse the existing weekly RMLS workflow.
     */
    const report =
      await fetchRmlsReport(
        reportUrl,
      );

    console.log(
      `HTTP status: ${report.status}`,
    );

    console.log(
      `Downloaded ${report.html.length} characters.`,
    );

    await saveRawReportHtml(
      report.html,
    );

    const listings =
      await parseSavedRmlsReport();

    console.log(
      `Parsed ${listings.length} unique listing(s).`,
    );

    if (
      listings.length ===
      0
    ) {
      console.warn(
        `No price-drop listings were parsed for ${snapshotDate}.`,
      );

      continue;
    }

    const snapshot = {
      snapshotDate,

      source: {
        gmailMessageId:
          email.id,

        subject:
          email.subject,

        internalDate:
          email.internalDate,

        reportUrl,

        capturedAt:
          new Date()
            .toISOString(),

        source:
          "monthly-price-drop-backfill",
      },

      listingCount:
        listings.length,

      listings,
    };

    /*
     * Use the email date, not today's date,
     * for the historical filename.
     */
    const snapshotDateObject =
      createPortlandNoonDate(
        snapshotDate,
      );

    const localPath =
      await saveHistoricalSnapshot(
        "price-drops",
        snapshot,
        snapshotDateObject,
      );

    savedFiles.push(
      localPath,
    );

    console.log(
      `Saved historical price-drop snapshot: ${localPath}`,
    );

    const githubUrl =
      await publishHistoricalSnapshot(
        "price-drops",
        localPath,
      );

    console.log(
      `Published historical price-drop snapshot: ${githubUrl}`,
    );
  }

  console.log("");
  console.log(
    `Backfilled ${savedFiles.length} price-drop snapshot(s).`,
  );

  return savedFiles;
}

function getSnapshotDate(
  internalDate: string | null,
): string | null {
  if (
    !internalDate
  ) {
    return null;
  }

  const timestamp =
    Number(
      internalDate,
    );

  if (
    !Number.isFinite(
      timestamp,
    )
  ) {
    return null;
  }

  const date =
    new Date(
      timestamp,
    );

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
      date,
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
    return null;
  }

  return `${year}-${month}-${day}`;
}

function createPortlandNoonDate(
  dateString: string,
): Date {
  /*
   * Noon avoids timezone rollover when the
   * date is later converted back to Portland time.
   */
  const date =
    new Date(
      `${dateString}T12:00:00-07:00`,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    throw new Error(
      `Invalid historical snapshot date: ${dateString}`,
    );
  }

  return date;
}