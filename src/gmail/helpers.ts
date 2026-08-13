import type {
  gmail_v1,
} from "googleapis";

export interface SearchGmailMessagesOptions {
  query: string;
  maxResults?: number;
  format?: "full" | "metadata";
  metadataHeaders?: string[];
  newestFirst?: boolean;
}

export function buildRecentLabelQuery(
  label: string,
  newerThanDays: number,
  extraTerms: string[] = [],
): string {
  const escapedLabel =
    label.replace(
      /(["\\])/g,
      "\\$1",
    );

  return [
    `label:"${escapedLabel}"`,
    `newer_than:${newerThanDays}d`,
    ...extraTerms,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildLabelDateRangeQuery(
  label: string,
  after: string,
  before: string,
  extraTerms: string[] = [],
): string {
  const escapedLabel =
    label.replace(
      /(["\\])/g,
      "\\$1",
    );

  return [
    `label:"${escapedLabel}"`,
    `after:${after}`,
    `before:${before}`,
    ...extraTerms,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function searchGmailMessages(
  gmail: gmail_v1.Gmail,
  options: SearchGmailMessagesOptions,
): Promise<gmail_v1.Schema$Message[]> {
  const format =
    options.format ??
    "full";

  const listResponse =
    await gmail.users.messages.list({
      userId:
        "me",
      q:
        options.query,
      maxResults:
        options.maxResults ??
        10,
    });

  const messageRefs =
    listResponse.data.messages ??
    [];

  const messages:
    gmail_v1.Schema$Message[] = [];

  for (
    const messageRef
    of messageRefs
  ) {
    if (
      !messageRef.id
    ) {
      continue;
    }

    const response =
      await gmail.users.messages.get({
        userId:
          "me",
        id:
          messageRef.id,
        format,
        metadataHeaders:
          format === "metadata"
            ? options.metadataHeaders
            : undefined,
      });

    messages.push(
      response.data,
    );
  }

  if (
    options.newestFirst !==
    false
  ) {
    messages.sort(
      (a, b) =>
        parseInternalDate(
          b.internalDate,
        ) -
        parseInternalDate(
          a.internalDate,
        ),
    );
  }

  return messages;
}

export function getMessageHeader(
  message:
    gmail_v1.Schema$Message,
  name: string,
): string | null {
  return getHeaderFromParts(
    message.payload?.headers ??
      [],
    name,
  );
}

export function getHeaderFromParts(
  headers:
    gmail_v1.Schema$MessagePartHeader[],
  name: string,
): string | null {
  return (
    headers.find(
      (header) =>
        header.name
          ?.toLowerCase() ===
        name.toLowerCase(),
    )?.value ??
    null
  );
}

export function collectMessageText(
  payload:
    | gmail_v1.Schema$MessagePart
    | null
    | undefined,
): string {
  if (
    !payload
  ) {
    return "";
  }

  const pieces:
    string[] = [];

  if (
    payload.body?.data
  ) {
    pieces.push(
      decodeBase64Url(
        payload.body.data,
      ),
    );
  }

  for (
    const part
    of payload.parts ??
    []
  ) {
    pieces.push(
      collectMessageText(
        part,
      ),
    );
  }

  return pieces
    .filter(Boolean)
    .join("\n");
}

export function decodeBase64Url(
  value:
    | string
    | null
    | undefined,
): string {
  if (
    !value
  ) {
    return "";
  }

  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  return Buffer.from(
    normalized,
    "base64",
  ).toString(
    "utf8",
  );
}

export function flattenMessageParts(
  payload:
    | gmail_v1.Schema$MessagePart
    | null
    | undefined,
): gmail_v1.Schema$MessagePart[] {
  if (
    !payload
  ) {
    return [];
  }

  const result:
    gmail_v1.Schema$MessagePart[] = [
      payload,
    ];

  for (
    const part
    of payload.parts ??
    []
  ) {
    result.push(
      ...flattenMessageParts(
        part,
      ),
    );
  }

  return result;
}


export function findPdfAttachmentPart(
  payload:
    | gmail_v1.Schema$MessagePart
    | null
    | undefined,
): gmail_v1.Schema$MessagePart | null {
  return (
    flattenMessageParts(
      payload,
    ).find(
      (part) => {
        const filename =
          part.filename
            ?.trim()
            .toLowerCase() ??
          "";

        return (
          part.mimeType ===
            "application/pdf" ||
          filename.endsWith(
            ".pdf",
          )
        );
      },
    ) ??
    null
  );
}

export function parseInternalDate(
  value:
    | string
    | null
    | undefined,
): number {
  const parsed =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}
