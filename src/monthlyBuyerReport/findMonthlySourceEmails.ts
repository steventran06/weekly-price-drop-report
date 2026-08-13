import type {
  gmail_v1,
} from "googleapis";

import {
  buildLabelDateRangeQuery,
  getMessageHeader,
  searchGmailMessages,
} from "../gmail/helpers.js";

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
  const query =
    buildLabelDateRangeQuery(
      label,
      range.gmailAfter,
      range.gmailBefore,
    );

  console.log("");
  console.log(
    `Searching Gmail with: ${query}`,
  );

  const messages =
    await searchGmailMessages(
      gmail,
      {
        query,
        maxResults:
          100,
        format:
          "metadata",
        metadataHeaders: [
          "Subject",
          "From",
        ],
        newestFirst:
          false,
      },
    );

  console.log(
    `Found ${messages.length} matching email(s) for ${range.monthName} ${range.year}.`,
  );

  return messages
    .filter(
      (
        message,
      ): message is gmail_v1.Schema$Message & {
        id: string;
      } =>
        Boolean(
          message.id,
        ),
    )
    .map(
      (message) => ({
        id:
          message.id,

        threadId:
          message.threadId ??
          null,

        internalDate:
          message.internalDate ??
          null,

        subject:
          getMessageHeader(
            message,
            "Subject",
          ),

        from:
          getMessageHeader(
            message,
            "From",
          ),

        labelIds:
          message.labelIds ??
          [],

        snippet:
          message.snippet ??
          null,
      }))
    .sort(
      (a, b) =>
        Number(
          a.internalDate ??
          0,
        ) -
        Number(
          b.internalDate ??
          0,
        ),
    );
}
