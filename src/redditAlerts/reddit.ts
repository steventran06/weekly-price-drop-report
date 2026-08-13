import * as cheerio from "cheerio";

import type {
  RedditFeed,
  RedditPost,
} from "./types.js";

const USER_AGENT =
  "weekly-price-drop-report/1.0 reddit-alerts (Portland Metro relocation monitoring)";

export async function fetchRedditFeed(
  feed: RedditFeed,
): Promise<RedditPost[]> {
  const maxRetries = parsePositiveInteger(
    process.env.REDDIT_MAX_RETRIES,
    1,
  );

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetchWithTimeout(
      feed.url,
      {
        headers: {
          Accept:
            "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": USER_AGENT,
        },
      },
      15_000,
    );

    if (response.status === 429 && attempt < maxRetries) {
      const retryDelayMs = getRetryDelayMs(
        response.headers.get("retry-after"),
      );

      console.warn(
        `  Reddit rate limited ${feed.id}; retrying in ${Math.round(retryDelayMs / 1000)}s...`,
      );

      await sleep(retryDelayMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `Reddit RSS request failed for ${feed.id} (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const xml = await response.text();

    return parseRedditAtomFeed(
      xml,
      feed,
    );
  }

  return [];
}

function parseRedditAtomFeed(
  xml: string,
  feed: RedditFeed,
): RedditPost[] {
  const $ = cheerio.load(
    xml,
    {
      xmlMode: true,
    },
  );

  const posts: RedditPost[] = [];

  $("entry").each((_: number, element: any) => {
    const entry = $(element);
    const id = cleanText(
      entry.find("id").first().text(),
    );
    const title = cleanText(
      entry.find("title").first().text(),
    );
    const updated = cleanText(
      entry.find("updated").first().text() ||
        entry.find("published").first().text(),
    );
    const url =
      entry.find('link[rel="alternate"]').attr("href") ||
      entry.find("link").first().attr("href") ||
      "";
    const author = cleanText(
      entry.find("author name").first().text(),
    );
    const contentRaw =
      entry.find("content").first().text() ||
      entry.find("summary").first().text() ||
      "";
    const body = stripHtml(contentRaw);
    const subreddit = extractSubreddit(
      url,
      body,
    );
    const publishedAt = new Date(updated);

    if (
      !id ||
      !title ||
      !url ||
      Number.isNaN(publishedAt.getTime())
    ) {
      return;
    }

    posts.push({
      id,
      title,
      url: normalizeRedditUrl(url),
      subreddit,
      author: author || null,
      publishedAt,
      body,
      feedIds: [feed.id],
      feedKinds: [feed.kind],
    });
  });

  return posts;
}

export function mergeDuplicatePosts(
  posts: RedditPost[],
): RedditPost[] {
  const merged = new Map<
    string,
    RedditPost
  >();

  for (const post of posts) {
    const key = post.id || post.url;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(
        key,
        post,
      );
      continue;
    }

    existing.feedIds = Array.from(
      new Set([
        ...existing.feedIds,
        ...post.feedIds,
      ]),
    );

    existing.feedKinds = Array.from(
      new Set([
        ...existing.feedKinds,
        ...post.feedKinds,
      ]),
    );

    if (
      post.body.length >
      existing.body.length
    ) {
      existing.body = post.body;
    }
  }

  return [...merged.values()].sort(
    (a, b) =>
      a.publishedAt.getTime() -
      b.publishedAt.getTime(),
  );
}

function stripHtml(
  html: string,
): string {
  if (!html) {
    return "";
  }

  const decoded = cheerio.load(html);

  decoded("script, style").remove();

  return cleanText(
    decoded.root().text(),
  )
    .replace(
      /submitted by\s+\/u\/\S+/gi,
      "",
    )
    .replace(
      /\[link\]\s*\[comments\]/gi,
      "",
    )
    .trim();
}

function extractSubreddit(
  url: string,
  body: string,
): string | null {
  const urlMatch = url.match(
    /reddit\.com\/r\/([^/]+)/i,
  );

  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  const bodyMatch = body.match(
    /\br\/([A-Za-z0-9_]+)/,
  );

  return bodyMatch?.[1] ?? null;
}

function normalizeRedditUrl(
  rawUrl: string,
): string {
  try {
    const url = new URL(rawUrl);

    url.protocol = "https:";
    url.hostname = "www.reddit.com";

    return url.toString();
  } catch {
    return rawUrl;
  }
}

function cleanText(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(
      url,
      {
        ...init,
        signal:
          controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : fallback;
}

function getRetryDelayMs(
  retryAfter: string | null,
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 120_000);
    }

    const dateMs = Date.parse(retryAfter);

    if (!Number.isNaN(dateMs)) {
      return Math.min(
        Math.max(dateMs - Date.now(), 1000),
        120_000,
      );
    }
  }

  return 60_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
