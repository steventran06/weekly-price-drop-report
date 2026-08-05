import type { gmail_v1 } from "googleapis";

export interface PriceDropEmail {
  id: string;
  subject: string;
  receivedAt: string;
  firstRmlsLink: string | null;
}

const EMAIL_QUERY = 'label:"PRICE DROP" newer_than:5d';

export async function findPriceDropEmails(
  gmail: gmail_v1.Gmail,
): Promise<PriceDropEmail[]> {
  console.log(`Searching Gmail with: ${EMAIL_QUERY}`);

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: EMAIL_QUERY,
    maxResults: 100,
  });

  const messages = listResponse.data.messages ?? [];

  console.log(`Found ${messages.length} matching email(s).`);

  const results: PriceDropEmail[] = [];

  for (const message of messages) {
    if (!message.id) {
      continue;
    }

    const emailResponse = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "full",
    });

    const email = emailResponse.data;
    const headers = email.payload?.headers ?? [];

    const subject =
      headers.find(
        (header) => header.name?.toLowerCase() === "subject",
      )?.value ?? "(No subject)";

    const body = extractMessageBody(email.payload);
    const firstRmlsLink = extractFirstRmlsLink(body);

    results.push({
      id: message.id,
      subject,
      receivedAt: email.internalDate
        ? new Date(Number(email.internalDate)).toISOString()
        : "Unknown",
      firstRmlsLink,
    });
  }

  return results;
}

function extractMessageBody(
  payload: gmail_v1.Schema$MessagePart | undefined,
): string {
  if (!payload) {
    return "";
  }

  const ownBody = decodeBase64Url(payload.body?.data);

  if (ownBody) {
    return ownBody;
  }

  const parts = payload.parts ?? [];

  const preferredPart =
    parts.find((part) => part.mimeType === "text/html") ??
    parts.find((part) => part.mimeType === "text/plain");

  if (preferredPart) {
    const preferredBody = extractMessageBody(preferredPart);

    if (preferredBody) {
      return preferredBody;
    }
  }

  for (const part of parts) {
    const nestedBody = extractMessageBody(part);

    if (nestedBody) {
      return nestedBody;
    }
  }

  return "";
}

function decodeBase64Url(data: string | null | undefined): string {
  if (!data) {
    return "";
  }

  const normalized = data
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  return Buffer.from(normalized, "base64").toString("utf8");
}

function extractFirstRmlsLink(body: string): string | null {
  const decodedBody = decodeHtmlEntities(body);

  const linkPattern =
    /https?:\/\/(?:www\.)?rmlsweb\.com\/v2\/public\/report\.asp\?[^\s"'<>]+/gi;

  const match = decodedBody.match(linkPattern)?.[0];

  if (!match) {
    return null;
  }

  return match.replace(/&amp;/gi, "&");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/=\r?\n/g, "");
}