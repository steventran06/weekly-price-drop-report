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
  const decoded = value.replace(/&amp;/gi, "&");
  const match = decoded.match(
    /https:\/\/www\.rmlsweb\.com\/v2\/public\/report\.asp\?[^\s"'<>]+/i,
  );

  if (!match) return null;

  return match[0].replace(/[)>.,]+$/, "");
}
