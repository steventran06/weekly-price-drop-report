import { load } from "cheerio";

import type {
  NewConstructionBuilder,
  NewConstructionCommunity,
} from "./types.js";

interface PageImageMetadata {
  finalUrl: string;
  title: string;
  imageUrl: string;
}

export interface CommunityImageStats {
  found: number;
  fallback: number;
  fetchFailures: number;
  uniquePagesFetched: number;
}

interface CachedPageResult {
  metadata: PageImageMetadata | null;
  failed: boolean;
}

const GENERIC_TOKENS = new Set([
  "and",
  "at",
  "by",
  "collection",
  "community",
  "for",
  "home",
  "homes",
  "luxury",
  "new",
  "nw",
  "of",
  "phase",
  "sale",
  "the",
]);

export async function enrichCommunityImages(
  builders: NewConstructionBuilder[],
  communities: NewConstructionCommunity[],
): Promise<{
  communities: NewConstructionCommunity[];
  stats: CommunityImageStats;
}> {
  const builderById = new Map(
    builders.map((builder) => [builder.id, builder]),
  );
  const timeoutMs = readInteger(
    process.env.NEW_CONSTRUCTION_IMAGE_TIMEOUT_MS,
    8_000,
    2_000,
    20_000,
  );
  const concurrency = readInteger(
    process.env.NEW_CONSTRUCTION_IMAGE_CONCURRENCY,
    6,
    1,
    10,
  );

  const uniqueUrls = [
    ...new Set(
      communities
        .map((community) => clean(community.sourceUrl))
        .filter(Boolean),
    ),
  ];

  console.log("");
  console.log(
    `Checking community page images (${uniqueUrls.length} unique official URLs, concurrency ${concurrency})...`,
  );

  const pageResults = await mapWithConcurrency(
    uniqueUrls,
    concurrency,
    async (url): Promise<[string, CachedPageResult]> => {
      try {
        const metadata = await fetchPageImageMetadata(
          url,
          timeoutMs,
        );
        return [url, { metadata, failed: false }];
      } catch {
        return [url, { metadata: null, failed: true }];
      }
    },
  );

  const cache = new Map(pageResults);
  let found = 0;
  let fallback = 0;
  const fetchFailures = pageResults.filter(
    ([, result]) => result.failed,
  ).length;

  const next = communities.map((community) => {
    const builder = builderById.get(community.builderId);
    const page = cache.get(clean(community.sourceUrl));

    if (
      builder &&
      page?.metadata?.imageUrl &&
      isCommunityPageMatch(
        community,
        builder,
        page.metadata,
      )
    ) {
      found += 1;
      return {
        ...community,
        imageUrl: page.metadata.imageUrl,
        imageSourceUrl: community.sourceUrl,
        imageAlt:
          `${community.name} by ${builder.name} in ${community.city}`,
      };
    }

    fallback += 1;
    const {
      imageUrl: _oldImageUrl,
      imageSourceUrl: _oldImageSourceUrl,
      imageAlt: _oldImageAlt,
      ...withoutImage
    } = community;

    return withoutImage;
  });

  console.log(
    `Community images found: ${found}; builder-logo fallback: ${fallback}; page fetch failures: ${fetchFailures}.`,
  );

  return {
    communities: next,
    stats: {
      found,
      fallback,
      fetchFailures,
      uniquePagesFetched: uniqueUrls.length,
    },
  };
}

async function fetchPageImageMetadata(
  sourceUrl: string,
  timeoutMs: number,
): Promise<PageImageMetadata | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const response = await fetch(sourceUrl, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; StevenTranRealEstate/1.0; +https://steventranrealestate.com)",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") || "";
    if (
      contentType &&
      !contentType.toLowerCase().includes("text/html")
    ) {
      return null;
    }

    const html = await response.text();
    const $ = load(html);

    const title = firstNonEmpty([
      $("meta[property='og:title']").attr("content"),
      $("meta[name='twitter:title']").attr("content"),
      $("title").first().text(),
      $("h1").first().text(),
    ]);

    const rawImage = firstNonEmpty([
      $("meta[property='og:image:secure_url']").attr("content"),
      $("meta[property='og:image']").attr("content"),
      $("meta[name='twitter:image']").attr("content"),
      $("meta[name='twitter:image:src']").attr("content"),
      $("link[rel='image_src']").attr("href"),
    ]);

    const imageUrl = resolveHttpUrl(
      rawImage,
      response.url || sourceUrl,
    );

    if (!imageUrl) {
      return null;
    }

    return {
      finalUrl: response.url || sourceUrl,
      title: clean(title),
      imageUrl,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isCommunityPageMatch(
  community: NewConstructionCommunity,
  builder: NewConstructionBuilder,
  page: PageImageMetadata,
): boolean {
  const builderTokens = new Set(
    tokens(builder.name),
  );
  const communityTokens = tokens(community.name).filter(
    (token) =>
      !GENERIC_TOKENS.has(token) &&
      !builderTokens.has(token),
  );

  if (communityTokens.length === 0) {
    return false;
  }

  const haystack = new Set([
    ...tokens(page.title),
    ...tokens(safeUrlPath(page.finalUrl)),
  ]);
  const overlap = communityTokens.filter(
    (token) => haystack.has(token),
  );

  if (communityTokens.length === 1) {
    return (
      communityTokens[0].length >= 5 &&
      overlap.length === 1
    );
  }

  return overlap.length >= 2;
}

function tokens(value: string): string[] {
  return clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function safeUrlPath(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return "";
  }
}

function resolveHttpUrl(
  value: string,
  baseUrl: string,
): string {
  if (!clean(value)) {
    return "";
  }

  try {
    const url = new URL(decodeHtmlEntities(value), baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    return url.href;
  } catch {
    return "";
  }
}

function decodeHtmlEntities(value: string): string {
  return clean(value)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, "/");
}

function firstNonEmpty(
  values: Array<string | undefined>,
): string {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return "";
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;

  async function run(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) {
        return;
      }

      output[index] = await worker(values[index]);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(concurrency, values.length),
      },
      () => run(),
    ),
  );

  return output;
}

function readInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(parsed, max));
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
