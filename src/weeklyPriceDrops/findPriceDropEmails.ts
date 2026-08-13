import type {
  gmail_v1,
} from "googleapis";

import {
  buildRecentLabelQuery,
  collectMessageText,
  getMessageHeader,
  searchGmailMessages,
} from "../gmail/helpers.js";

import {
  extractRmlsReportLinks,
  selectRmlsReportLink,
} from "../rmls/emailReportLinks.js";

export interface PriceDropEmail {
  id: string;
  subject: string;
  receivedAt: string;
  rmlsLinks: string[];
  reportUrl: string | null;
}

const DEFAULT_LOOKBACK_DAYS =
  5;

export async function findPriceDropEmails(
  gmail: gmail_v1.Gmail,
): Promise<PriceDropEmail[]> {
  const query =
    process.env.PRICE_DROP_GMAIL_QUERY?.trim() ||
    buildRecentLabelQuery(
      "PRICE DROP",
      DEFAULT_LOOKBACK_DAYS,
    );

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
          "full",
        newestFirst:
          true,
      },
    );

  console.log(
    `Found ${messages.length} matching email(s).`,
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
      (message) => {
        const body =
          collectMessageText(
            message.payload,
          );

        const rmlsLinks =
          extractRmlsReportLinks(
            body,
          );

        /*
         * PRICE DROP auto-emails use the second unique
         * RMLS public-report link for the full report.
         */
        const reportUrl =
          selectRmlsReportLink(
            body,
            "second",
          );

        return {
          id:
            message.id,

          subject:
            getMessageHeader(
              message,
              "Subject",
            ) ??
            "(No subject)",

          receivedAt:
            message.internalDate
              ? new Date(
                  Number(
                    message.internalDate,
                  ),
                ).toISOString()
              : "Unknown",

          rmlsLinks,
          reportUrl,
        };
      },
    );
}
