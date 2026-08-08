import type {
  gmail_v1,
} from "googleapis";

import type {
  MonthRange,
} from "./getPreviousMonthRange.js";

export interface MonthlySourceEmail {
  id: string;
  threadId: string | null;

  internalDate: string | null;

  subject: string | null;
  from: string | null;

  labelIds: string[];

  snippet: string | null;
}

export async function findMonthlySourceEmails(
  gmail: gmail_v1.Gmail,
  label: string,
  range: MonthRange,
): Promise<MonthlySourceEmail[]> {
  const query = [
    `label:"${label}"`,
    `after:${range.gmailAfter}`,
    `before:${range.gmailBefore}`,
  ].join(" ");

  console.log("");
  console.log(
    `Searching Gmail with: ${query}`,
  );

  const listResponse =
    await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
    });

  const messages =
    listResponse.data.messages ??
    [];

  console.log(
    `Found ${messages.length} matching email(s) for ${range.monthName} ${range.year}.`,
  );

  const results:
    MonthlySourceEmail[] = [];

  for (
    const message
    of messages
  ) {
    if (!message.id) {
      continue;
    }

    const fullMessage =
      await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "metadata",
        metadataHeaders: [
          "Subject",
          "From",
        ],
      });

    const headers =
      fullMessage.data.payload
        ?.headers ?? [];

    results.push({
      id:
        message.id,

      threadId:
        fullMessage.data.threadId ??
        null,

      internalDate:
        fullMessage.data.internalDate ??
        null,

      subject:
        getHeader(
          headers,
          "Subject",
        ),

      from:
        getHeader(
          headers,
          "From",
        ),

      labelIds:
        fullMessage.data.labelIds ??
        [],

      snippet:
        fullMessage.data.snippet ??
        null,
    });
  }

  return results.sort(
    (a, b) =>
      Number(a.internalDate ?? 0) -
      Number(b.internalDate ?? 0),
  );
}

function getHeader(
  headers:
    gmail_v1.Schema$MessagePartHeader[],
  name: string,
): string | null {
  return (
    headers.find(
      (header) =>
        header.name?.toLowerCase() ===
        name.toLowerCase(),
    )?.value ?? null
  );
}