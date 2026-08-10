import type { gmail_v1 } from "googleapis";

export interface NewOnMarketEmail {
  messageId: string;
  reportUrl: string;
  subject: string;
  internalDate: number;
}

const DEFAULT_QUERY = 'label:"NEW ON MARKET" newer_than:2d';

export async function findLatestNewOnMarketEmail(
  gmail: gmail_v1.Gmail,
): Promise<NewOnMarketEmail> {
  const query =
    process.env.NEW_ON_MARKET_GMAIL_QUERY?.trim() ||
    DEFAULT_QUERY;

  console.log(`Searching Gmail with: ${query}`);

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 10,
  });

  const messages = listResponse.data.messages ?? [];

  if (messages.length === 0) {
    throw new Error(`No NEW ON MARKET email found with query: ${query}`);
  }

  const candidates: NewOnMarketEmail[] = [];

  for (const message of messages) {
    if (!message.id) continue;

    const response = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "full",
    });

    const subject = getHeader(response.data, "Subject") ?? "";
    const internalDate = Number(response.data.internalDate ?? 0);
    const body = collectMessageText(response.data.payload);
    const reportUrl = extractRmlsReportUrl(body);

    if (!reportUrl) continue;

    candidates.push({
      messageId: message.id,
      reportUrl,
      subject,
      internalDate,
    });
  }

  if (candidates.length === 0) {
    throw new Error(
      "Found NEW ON MARKET email(s), but none contained an RMLS public report URL.",
    );
  }

  candidates.sort((a, b) => b.internalDate - a.internalDate);

  const latest = candidates[0];

  console.log(`Using email: ${latest.subject}`);
  console.log(`RMLS report: ${latest.reportUrl}`);

  return latest;
}

function getHeader(
  message: gmail_v1.Schema$Message,
  name: string,
): string | null {
  const header = message.payload?.headers?.find(
    (candidate) => candidate.name?.toLowerCase() === name.toLowerCase(),
  );

  return header?.value ?? null;
}

function collectMessageText(
  payload: gmail_v1.Schema$MessagePart | undefined,
): string {
  if (!payload) return "";

  const parts: string[] = [];

  if (payload.body?.data) {
    parts.push(decodeBase64Url(payload.body.data));
  }

  for (const part of payload.parts ?? []) {
    parts.push(collectMessageText(part));
  }

  return parts.join("\n");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractRmlsReportUrl(value: string): string | null {
  const decoded = value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&");

  const reportPattern =
    /https?:\/\/www\.rmlsweb\.com\/v2\/public\/report\.asp\?[^\s"'<>]+/gi;

  const matches = Array.from(
    decoded.matchAll(reportPattern),
  ).map((match) => ({
    url: cleanReportUrl(match[0]),
    index: match.index ?? 0,
  }));

  if (matches.length === 0) {
    return null;
  }

  const uniqueMatches = matches.filter(
    (match, index, all) =>
      all.findIndex(
        (candidate) => candidate.url === match.url,
      ) === index,
  );

  if (uniqueMatches.length === 1) {
    console.log(
      "RMLS email contained one public report link; using it.",
    );

    return uniqueMatches[0].url;
  }

  /*
   * Normal RMLS daily auto-emails can contain two public-report links:
   *
   * 1. "newest matches" - only listings newly matched by that email
   * 2. "complete list of available matches" - the full current result set
   *
   * Hot Listings needs the complete result set. Prefer the URL whose
   * nearby email text identifies it as the complete-list link.
   *
   * Manual/test emails may contain only one link, which is handled above.
   */
  const completeListMatch = uniqueMatches.find(
    (match) => {
      const contextStart = Math.max(
        0,
        match.index - 240,
      );
      const precedingContext = normalizeEmailText(
        decoded.slice(
          contextStart,
          match.index,
        ),
      );

      return /complete list of available matches/i.test(
        precedingContext,
      );
    },
  );

  if (completeListMatch) {
    console.log(
      `RMLS email contained ${uniqueMatches.length} public report links; ` +
        "using the complete list of available matches.",
    );

    return completeListMatch.url;
  }

  /*
   * Some MIME/plain-text representations can move the URL farther away
   * from its label. As a second pass, find the phrase first and select the
   * nearest RMLS report URL that follows it.
   */
  const completePhrase =
    /complete\s+list\s+of\s+available\s+matches/i.exec(
      normalizeEmailText(decoded),
    );

  if (completePhrase) {
    const phraseIndex = decoded
      .toLowerCase()
      .indexOf(
        "complete list of available matches",
      );

    if (phraseIndex >= 0) {
      const followingMatch = uniqueMatches
        .filter(
          (match) => match.index > phraseIndex,
        )
        .sort(
          (a, b) => a.index - b.index,
        )[0];

      if (followingMatch) {
        console.log(
          `RMLS email contained ${uniqueMatches.length} public report links; ` +
            "using the report following the complete-list label.",
        );

        return followingMatch.url;
      }
    }
  }

  console.warn(
    `RMLS email contained ${uniqueMatches.length} public report links, ` +
      "but the complete-list link could not be identified. " +
      "Falling back to the first RMLS report link.",
  );

  return uniqueMatches[0].url;
}

function cleanReportUrl(value: string): string {
  return value.replace(/[)>.,]+$/, "");
}

function normalizeEmailText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
