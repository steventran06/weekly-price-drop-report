import fs from "node:fs/promises";
import path from "node:path";

import type {
  gmail_v1,
} from "googleapis";

import {
  extractMarketStats,
} from "../marketStats/extractMarketStats.js";

import type {
  MonthlySourceEmail,
} from "./findMonthlySourceEmails.js";

export interface HistoricalMarketStatsSnapshot {
  snapshotDate: string;

  source: {
    gmailMessageId: string;
    subject: string | null;
    internalDate: string | null;
    attachmentFilename: string;
  };

  report: Awaited<
    ReturnType<
      typeof extractMarketStats
    >
  >;
}

export async function backfillMarketStats(
  gmail: gmail_v1.Gmail,
  emails: MonthlySourceEmail[],
): Promise<string[]> {
  console.log("");
  console.log(
    "Backfilling historical market stats...",
  );

  if (
    emails.length === 0
  ) {
    console.log(
      "No market stats emails to backfill.",
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

    if (!snapshotDate) {
      console.warn(
        `Skipping Gmail message ${email.id}: could not determine email date.`,
      );

      continue;
    }

    console.log("");
    console.log(
      `Processing ${snapshotDate}: ${email.subject ?? "(no subject)"}`,
    );

    /*
     * We need the complete Gmail message here
     * so we can locate the PDF attachment.
     */
    const messageResponse =
      await gmail.users.messages.get({
        userId: "me",
        id: email.id,
        format: "full",
      });

    const attachment =
      findPdfAttachment(
        messageResponse.data.payload,
      );

    if (!attachment) {
      console.warn(
        `No PDF attachment found on ${snapshotDate}.`,
      );

      continue;
    }

    if (
      !attachment.attachmentId
    ) {
      console.warn(
        `PDF attachment on ${snapshotDate} did not include an attachment ID.`,
      );

      continue;
    }

    console.log(
      `Found PDF: ${attachment.filename}`,
    );

    /*
     * Download the actual Gmail attachment.
     */
    const attachmentResponse =
      await gmail.users.messages.attachments.get({
        userId: "me",
        messageId: email.id,
        id: attachment.attachmentId,
      });

    const encodedData =
      attachmentResponse.data.data;

    if (!encodedData) {
      console.warn(
        `Attachment data was empty for ${snapshotDate}.`,
      );

      continue;
    }

    const pdfBuffer =
      Buffer.from(
        encodedData
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
        "base64",
      );

    /*
     * Save a temporary copy of the PDF because your
     * existing extractMarketStats() expects a file path.
     */
    const tempDirectory =
      path.join(
        process.cwd(),
        "output",
        "monthly-buyer-report",
        "market-stats",
      );

    await fs.mkdir(
      tempDirectory,
      {
        recursive: true,
      },
    );

    const safePdfFilename =
      `${snapshotDate}-${sanitizeFilename(
        attachment.filename,
      )}`;

    const tempPdfPath =
      path.join(
        tempDirectory,
        safePdfFilename,
      );

    await fs.writeFile(
      tempPdfPath,
      pdfBuffer,
    );

    console.log(
      `Downloaded PDF: ${tempPdfPath}`,
    );

    /*
     * Reuse the parser you've already built.
     */
    const extracted =
      await extractMarketStats(
        tempPdfPath,
      );

    if (
      extracted.markets.length === 0
    ) {
      console.warn(
        `No markets were extracted from ${snapshotDate}.`,
      );

      continue;
    }

    const snapshot:
      HistoricalMarketStatsSnapshot = {
        snapshotDate,

        source: {
          gmailMessageId:
            email.id,

          subject:
            email.subject,

          internalDate:
            email.internalDate,

          attachmentFilename:
            attachment.filename,
        },

        report:
          extracted,
      };

    const savedPath =
      await saveHistoricalSnapshot(
        snapshot,
      );

    savedFiles.push(
      savedPath,
    );

    console.log(
      `Saved historical snapshot: ${savedPath}`,
    );
  }

  console.log("");
  console.log(
    `Backfilled ${savedFiles.length} market stats snapshot(s).`,
  );

  return savedFiles;
}

async function saveHistoricalSnapshot(
  snapshot: HistoricalMarketStatsSnapshot,
): Promise<string> {
  const year =
    snapshot.snapshotDate.slice(
      0,
      4,
    );

  const directory =
    path.join(
      process.cwd(),
      "data",
      "market-stats",
      year,
    );

  await fs.mkdir(
    directory,
    {
      recursive: true,
    },
  );

  const outputPath =
    path.join(
      directory,
      `${snapshot.snapshotDate}.json`,
    );

  await fs.writeFile(
    outputPath,
    JSON.stringify(
      snapshot,
      null,
      2,
    ),
    "utf8",
  );

  return outputPath;
}

function findPdfAttachment(
  payload:
    gmail_v1.Schema$MessagePart |
    null |
    undefined,
): {
  filename: string;
  attachmentId: string | null;
} | null {
  if (!payload) {
    return null;
  }

  /*
   * The PDF can technically exist directly on
   * this part.
   */
  const filename =
    payload.filename?.trim() ??
    "";

  const mimeType =
    payload.mimeType?.toLowerCase() ??
    "";

  const isPdf =
    mimeType ===
      "application/pdf" ||
    filename
      .toLowerCase()
      .endsWith(
        ".pdf",
      );

  if (
    isPdf &&
    filename
  ) {
    return {
      filename,

      attachmentId:
        payload.body?.attachmentId ??
        null,
    };
  }

  /*
   * Gmail messages often nest attachments
   * several levels deep.
   */
  for (
    const part
    of payload.parts ?? []
  ) {
    const found =
      findPdfAttachment(
        part,
      );

    if (found) {
      return found;
    }
  }

  return null;
}

function getSnapshotDate(
  internalDate: string | null,
): string | null {
  if (!internalDate) {
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
        part.type === "year",
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day",
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    return null;
  }

  return (
    `${year}-${month}-${day}`
  );
}

function sanitizeFilename(
  value: string,
): string {
  const cleaned =
    value
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^-|-$|/g,
        "",
      );

  return (
    cleaned ||
    "market-stats.pdf"
  );
}
