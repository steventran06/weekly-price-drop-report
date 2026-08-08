import fs from "node:fs/promises";
import path from "node:path";
import type { gmail_v1 } from "googleapis";

interface DownloadedMarketStatsPdf {
  filename: string;
  outputPath: string;
  messageId: string;
}

export async function downloadMarketStatsPdf(
  gmail: gmail_v1.Gmail,
): Promise<DownloadedMarketStatsPdf> {
  const query =
    'label:"TMO Reports" newer_than:5d';

  console.log(
    `Searching Gmail for market stats PDF with: ${query}`,
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
    throw new Error(
      "No recent TMO Reports emails were found.",
    );
  }

  console.log(
    `Found ${messages.length} matching email(s).`,
  );

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

    const pdfPart = parts.find(
      (part) => {
        const filename =
          part.filename?.toLowerCase() ?? "";

        return (
          part.mimeType ===
            "application/pdf" ||
          filename.endsWith(".pdf")
        );
      },
    );

    if (
      !pdfPart ||
      !pdfPart.body?.attachmentId
    ) {
      continue;
    }

    const attachmentResponse =
      await gmail.users.messages.attachments.get(
        {
          userId: "me",
          messageId: message.id,
          id:
            pdfPart.body
              .attachmentId,
        },
      );

    const encodedData =
      attachmentResponse.data.data;

    if (!encodedData) {
      throw new Error(
        `PDF attachment data was empty for message ${message.id}.`,
      );
    }

    const buffer =
      Buffer.from(
        encodedData
          .replace(/-/g, "+")
          .replace(/_/g, "/"),
        "base64",
      );

    const filename =
      pdfPart.filename?.trim() ||
      "market-stats.pdf";

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

    const safeFilename =
      sanitizeFilename(
        filename,
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
      `Downloaded market stats PDF: ${outputPath}`,
    );

    return {
      filename:
        safeFilename,
      outputPath,
      messageId:
        message.id,
    };
  }

  throw new Error(
    "No PDF attachment was found in recent TMO Reports emails.",
  );
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

function sanitizeFilename(
  filename: string,
): string {
  return filename
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-",
    )
    .replace(
      /-+/g,
      "-",
    );
}