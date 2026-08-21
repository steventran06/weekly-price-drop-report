import type {
  gmail_v1,
} from "googleapis";

import {
  collectMessageText,
  getMessageHeader,
  searchGmailMessages,
} from "../gmail/helpers.js";

import {
  selectRmlsReportLink,
} from "../rmls/emailReportLinks.js";

import {
  getNewOnMarketGmailQuery,
} from "../gmail/queries.js";

export interface NewOnMarketEmail {
  messageId: string;
  reportUrl: string;
  subject: string;
  internalDate: number;
}

export async function findLatestNewOnMarketEmail(
  gmail: gmail_v1.Gmail,
): Promise<NewOnMarketEmail> {
  const query =
    getNewOnMarketGmailQuery();

  console.log(
    `Searching Gmail with: ${query}`,
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
    throw new Error(
      `No NEW ON MARKET email found with query: ${query}`,
    );
  }

  for (
    const message
    of messages
  ) {
    if (
      !message.id
    ) {
      continue;
    }

    const body =
      collectMessageText(
        message.payload,
      );

    /*
     * Hot Listings needs the complete result set.
     * Prefer the explicitly labeled complete-list URL,
     * with the shared helper falling back to the second
     * unique RMLS report URL when necessary.
     */
    const reportUrl =
      selectRmlsReportLink(
        body,
        "complete-list",
      );

    if (
      !reportUrl
    ) {
      continue;
    }

    const result:
      NewOnMarketEmail = {
      messageId:
        message.id,

      reportUrl,

      subject:
        getMessageHeader(
          message,
          "Subject",
        ) ??
        "",

      internalDate:
        Number(
          message.internalDate ??
          0,
        ),
    };

    console.log(
      `Using email: ${result.subject}`,
    );

    console.log(
      `RMLS report: ${result.reportUrl}`,
    );

    return result;
  }

  throw new Error(
    "Found NEW ON MARKET email(s), but none contained an RMLS public report URL.",
  );
}
