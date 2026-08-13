import type {
  RedditPost,
  RelevanceResult,
} from "./types.js";

export type NtfyConfig = {
  baseUrl: string;
  topic: string;
};

export async function loadRecentlySentPostIds(
  config: NtfyConfig,
): Promise<Set<string>> {
  const url = new URL(
    `${config.baseUrl.replace(/\/$/, "")}/${config.topic}/json`,
  );

  url.searchParams.set(
    "poll",
    "1",
  );
  url.searchParams.set(
    "since",
    "12h",
  );

  const response = await fetch(
    url,
    {
      headers: {
        Accept:
          "application/x-ndjson, application/json, text/plain",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load ntfy history (${response.status}): ${await response.text()}`,
    );
  }

  const body = await response.text();
  const ids = new Set<string>();

  for (const line of body.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    try {
      const message = JSON.parse(trimmed) as {
        event?: string;
        sequence_id?: string;
      };

      if (
        message.event === "message" &&
        message.sequence_id?.startsWith("reddit-")
      ) {
        ids.add(
          message.sequence_id,
        );
      }
    } catch {
      // Ignore non-JSON keepalive/open lines if a server implementation returns any.
    }
  }

  return ids;
}

export async function sendRedditNotification(
  config: NtfyConfig,
  post: RedditPost,
  relevance: RelevanceResult,
  suggestedReply: string,
): Promise<void> {
  const sequenceId = toSequenceId(
    post.id,
  );

  const primaryCity =
    relevance.cities[0]?.name ??
    "Portland Metro";

  const subreddit =
    post.subreddit
      ? `r/${post.subreddit}`
      : "Reddit";

  const title = truncate(
    `${primaryCity} lead: ${post.title}`,
    180,
  );

  const excerpt = truncate(
    post.body,
    420,
  );

  const message = [
    `${subreddit} • ${primaryCity} • relevance ${relevance.score}`,
    "",
    excerpt
      ? `POST\n${excerpt}`
      : null,
    "",
    "SUGGESTED REPLY",
    suggestedReply,
    "",
    `OPEN REDDIT\n${post.url}`,
  ]
    .filter(
      (value): value is string =>
        value !== null,
    )
    .join("\n");

  const url =
    `${config.baseUrl.replace(/\/$/, "")}/`;

  const response = await fetch(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        topic:
          config.topic,
        title,
        message:
          truncateUtf8(
            message,
            3_700,
          ),
        click:
          post.url,
        priority:
          4,
        tags: [
          "house",
          "reddit",
        ],
        sequence_id:
          sequenceId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `ntfy publish failed (${response.status}): ${await response.text()}`,
    );
  }
}

export async function sendTestNotification(
  config: NtfyConfig,
): Promise<void> {
  const testUrl =
    "https://www.reddit.com/r/AskPortland/";

  const response = await fetch(
    `${config.baseUrl.replace(/\/$/, "")}/`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        topic:
          config.topic,
        title:
          "Reddit lead alerts are working",
        message: [
          "This is a test from weekly-price-drop-report.",
          "",
          "Future alerts will include:",
          "• Reddit title + excerpt",
          "• matched Portland Metro / SW Washington city",
          "• direct Reddit link",
          "• a copy-ready suggested response",
          "",
          `OPEN REDDIT\n${testUrl}`,
        ].join("\n"),
        click:
          testUrl,
        priority:
          3,
        tags: [
          "white_check_mark",
          "reddit",
        ],
        sequence_id:
          `reddit-test-${Date.now()}`,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `ntfy test publish failed (${response.status}): ${await response.text()}`,
    );
  }
}

export function toSequenceId(
  redditId: string,
): string {
  return (
    "reddit-" +
    redditId
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .slice(0, 48)
  );
}

function truncateUtf8(
  value: string,
  maxBytes: number,
): string {
  const encoder =
    new TextEncoder();

  if (
    encoder.encode(value).byteLength <=
    maxBytes
  ) {
    return value;
  }

  let result = "";

  for (const character of value) {
    const candidate =
      result + character;

    if (
      encoder.encode(candidate + "…").byteLength >
      maxBytes
    ) {
      break;
    }

    result = candidate;
  }

  return result.trimEnd() + "…";
}

function truncate(
  value: string,
  maxLength: number,
): string {
  const text =
    value.trim();

  if (
    text.length <=
    maxLength
  ) {
    return text;
  }

  return (
    text
      .slice(
        0,
        Math.max(
          0,
          maxLength - 1,
        ),
      )
      .trimEnd() +
    "…"
  );
}
