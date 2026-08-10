import fs from "node:fs/promises";
import path from "node:path";
import type {
  CachedHotListing,
  EnrichedListing,
} from "./types.js";

const DEFAULT_CACHE_HOURS = 168;
const DEFAULT_REMOTE_PATH = "data/hot-listings-source-cache.json";

interface CacheDocument {
  schemaVersion: 1;
  generatedAt: string;
  retentionHours: number;
  listings: CachedHotListing[];
}

interface GitHubFileResponse {
  sha?: string;
  content?: string;
  encoding?: string;
}

export async function loadRollingHotListings(): Promise<CachedHotListing[]> {
  if (shouldUseGitHubCache()) {
    const remote = await readGitHubCache();
    if (remote) {
      console.log(`Loaded ${remote.length} cached hot listing(s) from GitHub.`);
      return remote;
    }
  }

  const local = await readLocalCache();
  console.log(`Loaded ${local.length} cached hot listing(s) locally.`);
  return local;
}

export function mergeRollingHotListings(
  existing: CachedHotListing[],
  incoming: EnrichedListing[],
  sourceEmailAt: string,
): CachedHotListing[] {
  const byMls = new Map<string, CachedHotListing>();

  for (const listing of existing) {
    if (!listing.mlsNumber) continue;
    byMls.set(listing.mlsNumber, listing);
  }

  for (const listing of incoming) {
    if (!listing.mlsNumber) continue;

    const previous = byMls.get(listing.mlsNumber);

    byMls.set(
      listing.mlsNumber,
      previous
        ? mergeListing(previous, listing, sourceEmailAt)
        : {
            ...listing,
            firstSeenAt: sourceEmailAt,
            lastSeenAt: sourceEmailAt,
          },
    );
  }

  const cutoff =
    Date.now() - getRetentionHours() * 60 * 60 * 1000;

  return [...byMls.values()]
    .filter((listing) => {
      const firstSeen = Date.parse(listing.firstSeenAt);
      return Number.isFinite(firstSeen) && firstSeen >= cutoff;
    })
    .sort(
      (a, b) =>
        Date.parse(b.firstSeenAt) - Date.parse(a.firstSeenAt),
    );
}

export async function saveRollingHotListings(
  listings: CachedHotListing[],
): Promise<void> {
  const document: CacheDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    retentionHours: getRetentionHours(),
    listings,
  };

  await writeLocalCache(document);

  if (shouldUseGitHubCache()) {
    await writeGitHubCache(document);
  }
}

export function getRetentionHours(): number {
  const raw = Number(process.env.HOT_LISTINGS_CACHE_HOURS ?? DEFAULT_CACHE_HOURS);

  if (!Number.isFinite(raw) || raw < 24) {
    return DEFAULT_CACHE_HOURS;
  }

  return Math.round(raw);
}

function mergeListing(
  previous: CachedHotListing,
  incoming: EnrichedListing,
  sourceEmailAt: string,
): CachedHotListing {
  const merged = {
    ...previous,
    ...incoming,
  } as CachedHotListing;

  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined || value === "") {
      (merged as Record<string, unknown>)[key] =
        (previous as Record<string, unknown>)[key] ?? value;
    }
  }

  merged.firstSeenAt = previous.firstSeenAt;
  merged.lastSeenAt = sourceEmailAt;

  return merged;
}

function shouldUseGitHubCache(): boolean {
  return /^true$/i.test(process.env.HOT_LISTINGS_PUBLISH?.trim() ?? "false");
}

function localCachePath(): string {
  return path.resolve("output", "hot-listings", "source-cache.json");
}

async function readLocalCache(): Promise<CachedHotListing[]> {
  try {
    const raw = await fs.readFile(localCachePath(), "utf8");
    const parsed = JSON.parse(raw) as CacheDocument;
    return Array.isArray(parsed.listings) ? parsed.listings : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    console.warn(`Could not read local hot-listings cache: ${String(error)}`);
    return [];
  }
}

async function writeLocalCache(document: CacheDocument): Promise<void> {
  const target = localCachePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  console.log(`Rolling cache: ${target}`);
}

async function readGitHubCache(): Promise<CachedHotListing[] | null> {
  const token = process.env.SITE_GITHUB_TOKEN?.trim();
  if (!token) return null;

  const { apiUrl, branch } = getGitHubLocation();

  const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    console.warn(
      `Could not load remote hot-listings cache (${response.status}): ${await response.text()}`,
    );
    return null;
  }

  const file = (await response.json()) as GitHubFileResponse;
  if (!file.content) return null;

  const json = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  const parsed = JSON.parse(json) as CacheDocument;

  return Array.isArray(parsed.listings) ? parsed.listings : null;
}

async function writeGitHubCache(document: CacheDocument): Promise<void> {
  const token = process.env.SITE_GITHUB_TOKEN?.trim();

  if (!token) {
    throw new Error("SITE_GITHUB_TOKEN is required to publish the hot-listings cache.");
  }

  const { apiUrl, branch } = getGitHubLocation();

  const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  let sha: string | undefined;

  if (existing.ok) {
    sha = ((await existing.json()) as GitHubFileResponse).sha;
  } else if (existing.status !== 404) {
    throw new Error(
      `Hot-listings cache check failed (${existing.status}): ${await existing.text()}`,
    );
  }

  const body: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message: `Update hot listings source cache: ${document.generatedAt.slice(0, 10)}`,
    content: Buffer.from(`${JSON.stringify(document, null, 2)}\n`, "utf8").toString("base64"),
    branch,
  };

  if (sha) body.sha = sha;

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `Hot-listings cache publish failed (${response.status}): ${await response.text()}`,
    );
  }

  console.log("Published rolling hot-listings source cache.");
}

function getGitHubLocation(): {
  apiUrl: string;
  branch: string;
} {
  const owner = process.env.SITE_GITHUB_OWNER?.trim() || "steventran06";
  const repo = process.env.SITE_GITHUB_REPO?.trim() || "steventranrealestate";
  const branch = process.env.SITE_GITHUB_BRANCH?.trim() || "main";
  const filePath =
    (process.env.SITE_HOT_LISTINGS_CACHE_PATH?.trim() || DEFAULT_REMOTE_PATH)
      .replace(/^\/+/, "");

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return {
    apiUrl: `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
    branch,
  };
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "weekly-price-drop-report",
  };
}
