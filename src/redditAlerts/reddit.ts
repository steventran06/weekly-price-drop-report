import type {
  RedditPost,
  RedditSource,
} from "./types.js";

export type RedditApiConfig = {
  clientId: string;
  clientSecret: string;
  userAgent: string;
};

export type RedditApiClient = {
  accessToken: string;
  userAgent: string;
};

type RedditTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
};

type RedditListingResponse = {
  data?: {
    children?: Array<{
      kind?: string;
      data?: RedditListingPost;
    }>;
  };
};

type RedditListingPost = {
  name?: string;
  id?: string;
  title?: string;
  selftext?: string;
  subreddit?: string;
  author?: string;
  created_utc?: number;
  permalink?: string;
};

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_BASE_URL = "https://oauth.reddit.com";
const REQUEST_TIMEOUT_MS = 15_000;

export async function createRedditApiClient(
  config: RedditApiConfig,
): Promise<RedditApiClient> {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");

  const response = await fetchWithTimeout(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": config.userAgent,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    },
    REQUEST_TIMEOUT_MS,
  );

  const raw = await response.text();
  const payload = parseJson<RedditTokenResponse>(raw);

  if (!response.ok || !payload?.access_token) {
    const detail =
      payload?.error ||
      raw.slice(0, 300) ||
      response.statusText;

    throw new Error(
      `Reddit OAuth token request failed (${response.status}): ${detail}`,
    );
  }

  return {
    accessToken: payload.access_token,
    userAgent: config.userAgent,
  };
}

export async function fetchNewPosts(
  client: RedditApiClient,
  source: RedditSource,
): Promise<RedditPost[]> {
  const subredditPath = source.subreddits.join("+");
  const url = new URL(
    `/r/${subredditPath}/new`,
    API_BASE_URL,
  );

  url.searchParams.set(
    "limit",
    String(
      Math.max(
        1,
        Math.min(100, source.limit),
      ),
    ),
  );
  url.searchParams.set("raw_json", "1");

  const response = await fetchRedditJson(
    client,
    url,
  );

  const children =
    response.data?.children ?? [];

  const posts: RedditPost[] = [];

  for (const child of children) {
    const item = child.data;

    if (!item) {
      continue;
    }

    const post = normalizePost(
      item,
      source,
    );

    if (post) {
      posts.push(post);
    }
  }

  return posts;
}

export function mergeDuplicatePosts(
  posts: RedditPost[],
): RedditPost[] {
  const merged = new Map<string, RedditPost>();

  for (const post of posts) {
    const key = post.id || post.url;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, post);
      continue;
    }

    existing.sourceIds = Array.from(
      new Set([
        ...existing.sourceIds,
        ...post.sourceIds,
      ]),
    );

    existing.sourceKinds = Array.from(
      new Set([
        ...existing.sourceKinds,
        ...post.sourceKinds,
      ]),
    );

    if (post.body.length > existing.body.length) {
      existing.body = post.body;
    }
  }

  return [...merged.values()].sort(
    (a, b) =>
      a.publishedAt.getTime() -
      b.publishedAt.getTime(),
  );
}

async function fetchRedditJson(
  client: RedditApiClient,
  url: URL,
): Promise<RedditListingResponse> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${client.accessToken}`,
        "User-Agent": client.userAgent,
      },
    },
    REQUEST_TIMEOUT_MS,
  );

  const raw = await response.text();

  if (!response.ok) {
    const rateLimit = formatRateLimit(response);

    throw new Error(
      `Reddit API request failed (${response.status})${rateLimit}: ${raw.slice(0, 300)}`,
    );
  }

  const parsed = parseJson<RedditListingResponse>(raw);

  if (!parsed) {
    throw new Error(
      "Reddit API returned a non-JSON response.",
    );
  }

  return parsed;
}

function normalizePost(
  item: RedditListingPost,
  source: RedditSource,
): RedditPost | null {
  const id =
    item.name?.trim() ||
    (item.id ? `t3_${item.id}` : "");
  const title = item.title?.trim() || "";
  const permalink = item.permalink?.trim() || "";
  const createdUtc = Number(item.created_utc);

  if (
    !id ||
    !title ||
    !permalink ||
    !Number.isFinite(createdUtc)
  ) {
    return null;
  }

  return {
    id,
    title,
    url: normalizePermalink(permalink),
    subreddit: item.subreddit?.trim() || null,
    author: item.author?.trim() || null,
    publishedAt: new Date(createdUtc * 1000),
    body: item.selftext?.trim() || "",
    sourceIds: [source.id],
    sourceKinds: [source.kind],
  };
}

function normalizePermalink(
  permalink: string,
): string {
  if (/^https?:\/\//i.test(permalink)) {
    return permalink;
  }

  return `https://www.reddit.com${
    permalink.startsWith("/")
      ? permalink
      : `/${permalink}`
  }`;
}

function formatRateLimit(
  response: Response,
): string {
  const remaining = response.headers.get(
    "x-ratelimit-remaining",
  );
  const reset = response.headers.get(
    "x-ratelimit-reset",
  );
  const retryAfter = response.headers.get(
    "retry-after",
  );

  const values = [
    remaining
      ? `remaining=${remaining}`
      : null,
    reset
      ? `reset=${reset}s`
      : null,
    retryAfter
      ? `retry-after=${retryAfter}s`
      : null,
  ].filter(Boolean);

  return values.length > 0
    ? ` [${values.join(", ")}]`
    : "";
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseJson<T>(
  raw: string,
): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
