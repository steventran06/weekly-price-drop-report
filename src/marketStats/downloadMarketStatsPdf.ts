import fs from "node:fs/promises";
import path from "node:path";
import type { gmail_v1 } from "googleapis";

import type {
  MarketStatsRegion,
} from "./extractMarketStats.js";

export interface DownloadMarketStatsPdfOptions {
  label: string;
  region: MarketStatsRegion;
  displayName?: string;
  newerThanDays?: number;
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

interface PdfCandidate {
  messageId: string;
  attachmentId: string;
  originalFilename: string;
  subject: string | null;
  internalDate: string | null;
}

export async function downloadMarketStatsPdf(
  gmail: gmail_v1.Gmail,
  options: DownloadMarketStatsPdfOptions,
): Promise<DownloadedMarketStatsPdf | null> {
  const newerThanDays =
    options.newerThanDays ?? 7;

  const displayName =
    options.displayName ??
    `${options.region} TMO report`;

  const escapedLabel =
    options.label.replace(
      /(["\\])/g,
      "\\$1",
    );

  const query =
    `label:"${escapedLabel}" ` +
    `newer_than:${newerThanDays}d ` +
    "has:attachment";

  console.log("");
  console.log(
    `Searching Gmail for ${displayName} with: ${query}`,
  );

  const listResponse =
    await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 10,
    });

  const messages =
    listResponse.data.messages ?? [];

  if (messages.length === 0) {
    console.log(
      `No recent ${displayName} email was found.`,
    );

    return null;
  }

  console.log(
    `Found ${messages.length} matching ${displayName} email(s).`,
  );

  const candidates: PdfCandidate[] = [];

  for (const message of messages) {
    if (!message.id) {
      continue;
    }

    const fullMessage =
      await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

    const parts =
      flattenParts(
        fullMessage.data.payload,
      );

    const pdfPart =
      parts.find(
        (part) => {
          const filename =
            part.filename
              ?.trim()
              .toLowerCase() ?? "";

          return (
            part.mimeType ===
              "application/pdf" ||
            filename.endsWith(
              ".pdf",
            )
          );
        },
      );

    const attachmentId =
      pdfPart?.body?.attachmentId;

    if (
      !pdfPart ||
      !attachmentId
    ) {
      continue;
    }

    candidates.push({
      messageId:
        message.id,

      attachmentId,

      originalFilename:
        pdfPart.filename?.trim() ||
        `${options.region}-market-stats.pdf`,

      subject:
        getHeader(
          fullMessage.data.payload,
          "Subject",
        ),

      internalDate:
        fullMessage.data.internalDate ??
        null,
    });
  }

  if (candidates.length === 0) {
    console.log(
      `No PDF attachment was found in recent ${displayName} emails.`,
    );

    return null;
  }

  candidates.sort(
    (a, b) =>
      parseInternalDate(
        b.internalDate,
      ) -
      parseInternalDate(
        a.internalDate,
      ),
  );

  const selected =
    candidates[0];

  const attachmentResponse =
    await gmail.users.messages.attachments.get({
      userId: "me",
      messageId:
        selected.messageId,
      id:
        selected.attachmentId,
    });

  const encodedData =
    attachmentResponse.data.data;

  if (!encodedData) {
    throw new Error(
      `PDF attachment data was empty for ${displayName} message ${selected.messageId}.`,
    );
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
      selected.originalFilename,
    );

  const outputDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
    );

  await fs.mkdir(
    outputDirectory,
    {
      recursive: true,
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

    originalFilename:
      selected.originalFilename,

    outputPath,

    messageId:
      selected.messageId,

    subject:
      selected.subject,

    internalDate:
      selected.internalDate,

    region:
      options.region,
  };
}

function flattenParts(
  payload:
    | gmail_v1.Schema$MessagePart
    | undefined,
): gmail_v1.Schema$MessagePart[] {
  if (!payload) {
    return [];
  }

  const result:
    gmail_v1.Schema$MessagePart[] =
    [payload];

  for (
    const part
    of payload.parts ?? []
  ) {
    result.push(
      ...flattenParts(part),
    );
  }

  return result;
}

function getHeader(
  payload:
    | gmail_v1.Schema$MessagePart
    | undefined,
  name: string,
): string | null {
  const header =
    payload?.headers?.find(
      (item) =>
        item.name
          ?.toLowerCase() ===
        name.toLowerCase(),
    );

  return (
    header?.value?.trim() ||
    null
  );
}

function parseInternalDate(
  value: string | null,
): number {
  if (!value) {
    return 0;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
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

  if (!sanitized) {
    return "market-stats.pdf";
  }

  return sanitized
    .toLowerCase()
    .endsWith(".pdf")
    ? sanitized
    : `${sanitized}.pdf`;
}