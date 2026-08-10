import type { WebsiteHotListingsPayload } from "../hotListings/types.js";

interface GitHubFileResponse {
  sha?: string;
}

interface GitHubPutResponse {
  content?: { html_url?: string };
  commit?: { html_url?: string };
}

export async function publishWebsiteHotListings(
  payload: WebsiteHotListingsPayload,
): Promise<string | null> {
  const shouldPublish =
    /^true$/i.test(process.env.HOT_LISTINGS_PUBLISH?.trim() ?? "false");

  if (!shouldPublish) {
    console.log(
      "HOT_LISTINGS_PUBLISH is not true. Generated the feed locally but skipped GitHub publishing.",
    );
    return null;
  }

  const token = process.env.SITE_GITHUB_TOKEN?.trim();
  const owner = process.env.SITE_GITHUB_OWNER?.trim() || "steventran06";
  const repo = process.env.SITE_GITHUB_REPO?.trim() || "steventranrealestate";
  const branch = process.env.SITE_GITHUB_BRANCH?.trim() || "main";
  const filePath =
    (process.env.SITE_HOT_LISTINGS_PATH?.trim() || "data/hot-listings.json")
      .replace(/^\/+/, "");

  if (!token) {
    throw new Error("SITE_GITHUB_TOKEN is required to publish hot listings.");
  }

  validatePayload(payload);

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const apiUrl =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const existingFile = await getExistingFile(apiUrl, token, branch);
  const json = `${JSON.stringify(payload, null, 2)}\n`;

  const requestBody: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message: existingFile?.sha
      ? `Update website hot listings: ${payload.generatedAt.slice(0, 10)}`
      : `Add website hot listings: ${payload.generatedAt.slice(0, 10)}`,
    content: Buffer.from(json, "utf8").toString("base64"),
    branch,
  };

  if (existingFile?.sha) requestBody.sha = existingFile.sha;

  console.log(`Publishing hot listings to ${owner}/${repo}/${filePath}...`);

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "weekly-price-drop-report",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      `Hot listings publish failed (${response.status}): ${await response.text()}`,
    );
  }

  const result = (await response.json()) as GitHubPutResponse;

  return (
    result.content?.html_url ??
    result.commit?.html_url ??
    `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`
  );
}

function validatePayload(payload: WebsiteHotListingsPayload): void {
  if (payload.schemaVersion !== 1 || payload.source !== "RMLS NEW ON MARKET") {
    throw new Error("Invalid website hot-listings payload.");
  }

  for (const [citySlug, listings] of Object.entries(payload.cities)) {
    if (!citySlug || !Array.isArray(listings)) {
      throw new Error("Invalid city collection in hot-listings payload.");
    }

    for (const listing of listings) {
      if (!listing.mlsNumber || !listing.address || !listing.currentPrice) {
        throw new Error(`Invalid hot listing in ${citySlug}.`);
      }
    }
  }

  for (const [key, listings] of Object.entries(payload.neighborhoods)) {
    if (!key || !Array.isArray(listings)) {
      throw new Error("Invalid neighborhood collection in hot-listings payload.");
    }
  }
}

async function getExistingFile(
  apiUrl: string,
  token: string,
  branch: string,
): Promise<GitHubFileResponse | null> {
  const response = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "weekly-price-drop-report",
    },
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `Hot listings file check failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as GitHubFileResponse;
}
