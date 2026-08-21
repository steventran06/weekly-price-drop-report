import fs from "node:fs/promises";
import path from "node:path";
import type {
  gmail_v1,
} from "googleapis";

import {
  findPdfAttachmentPart,
  getMessageHeader,
  searchGmailMessages,
} from "../gmail/helpers.js";

import type {
  MarketStatsRegion,
} from "./extractMarketStats.js";

export interface DownloadMarketStatsPdfOptions {
  query: string;
  region: MarketStatsRegion;
  displayName?: string;
}

export interface DownloadedMarketStatsPdf {
  filename: string;
  originalFilename: string;
  outputPath: string;
  messageId: string;
  subject: string | null;
  internalDate: string | null;
  region: MarketStatsRegion;
}

export async function downloadMarketStatsPdf(
  gmail: gmail_v1.Gmail,
  options: DownloadMarketStatsPdfOptions,
): Promise<DownloadedMarketStatsPdf | null> {
  const displayName =
    options.displayName ??
    `${options.region} TMO report`;

  const query =
    options.query.trim();

  if (!query) {
    throw new Error(
      `Gmail query is required for ${displayName}.`,
    );
  }

  console.log("");
  console.log(
    `Searching Gmail for ${displayName} with: ${query}`,
  );

  const messages =
    await searchGmailMessages(
      gmail,
      {
        query,
        maxResults:
          10,
        format:
          "full",
        newestFirst:
          true,
      },
    );

  if (
    messages.length ===
    0
  ) {
    console.log(
      `No recent ${displayName} email was found.`,
    );

    return null;
  }

  console.log(
    `Found ${messages.length} matching ${displayName} email(s).`,
  );

  for (
    const message
    of messages
  ) {
    if (
      !message.id
    ) {
      continue;
    }

    const pdfPart =
      findPdfAttachmentPart(
        message.payload,
      );

    const attachmentId =
      pdfPart?.body
        ?.attachmentId;

    if (
      !pdfPart ||
      !attachmentId
    ) {
      continue;
    }

    const originalFilename =
      pdfPart.filename?.trim() ||
      `${options.region}-market-stats.pdf`;

    const attachmentResponse =
      await gmail.users.messages.attachments.get({
        userId:
          "me",
        messageId:
          message.id,
        id:
          attachmentId,
      });

    const encodedData =
      attachmentResponse.data.data;

    if (
      !encodedData
    ) {
      console.warn(
        `PDF attachment data was empty for ${displayName} message ${message.id}; checking the next matching email.`,
      );

      continue;
    }

    const buffer =
      Buffer.from(
        encodedData
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
        "base64",
      );

    const safeFilename =
      sanitizeFilename(
        originalFilename,
      );

    const outputDirectory =
      path.join(
        process.cwd(),
        "output",
        "market-stats",
        options.region,
      );

    await fs.mkdir(
      outputDirectory,
      {
        recursive:
          true,
      },
    );

    const outputPath =
      path.join(
        outputDirectory,
        safeFilename,
      );

    await fs.writeFile(
      outputPath,
      buffer,
    );

    console.log(
      `Downloaded ${displayName}: ${outputPath}`,
    );

    return {
      filename:
        safeFilename,

      originalFilename,

      outputPath,

      messageId:
        message.id,

      subject:
        getMessageHeader(
          message,
          "Subject",
        ),

      internalDate:
        message.internalDate ??
        null,

      region:
        options.region,
    };
  }

  console.log(
    `No usable PDF attachment was found in recent ${displayName} emails.`,
  );

  return null;
}

function sanitizeFilename(
  filename: string,
): string {
  const sanitized =
    filename
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^[-.]+|[-.]+$/g,
        "",
      );

  if (
    !sanitized
  ) {
    return "market-stats.pdf";
  }

  return sanitized
    .toLowerCase()
    .endsWith(
      ".pdf",
    )
    ? sanitized
    : `${sanitized}.pdf`;
}
