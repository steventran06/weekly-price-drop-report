import type {
  WebsiteMarketStats,
} from "../marketStats/buildWebsiteMarketStats.js";

interface GitHubFileResponse {
  sha?: string;
}

interface GitHubPutResponse {
  content?: {
    html_url?: string;
  };

  commit?: {
    html_url?: string;
  };
}

export async function publishWebsiteMarketStats(
  stats: WebsiteMarketStats,
): Promise<string> {
  const token =
    process.env.SITE_GITHUB_TOKEN?.trim();

  const owner =
    process.env.SITE_GITHUB_OWNER?.trim() ||
    "steventran06";

  const repo =
    process.env.SITE_GITHUB_REPO?.trim() ||
    "steventranrealestate";

  const branch =
    process.env.SITE_GITHUB_BRANCH?.trim() ||
    "main";

  const configuredPath =
    process.env.SITE_MARKET_STATS_PATH?.trim() ||
    "data/market-stats/latest.json";

  if (!token) {
    throw new Error(
      "SITE_GITHUB_TOKEN is required to publish website market stats.",
    );
  }

  validateWebsiteMarketStats(
    stats,
  );

  const filePath =
    configuredPath.replace(
      /^\/+/, 
      "",
    );

  const encodedPath =
    filePath
      .split("/")
      .map(
        (part) =>
          encodeURIComponent(
            part,
          ),
      )
      .join("/");

  const apiUrl =
    `https://api.github.com/repos/` +
    `${owner}/${repo}/contents/${encodedPath}`;

  const json =
    JSON.stringify(
      stats,
      null,
      2,
    ) + "\n";

  /*
   * Parse the final serialized payload once before
   * making any GitHub request. This catches accidental
   * non-JSON values or serialization problems locally.
   */
  JSON.parse(
    json,
  );

  const oregonCount =
    stats.markets.filter(
      (market) =>
        market.sourceRegion ===
        "oregon",
    ).length;

  const washingtonCount =
    stats.markets.filter(
      (market) =>
        market.sourceRegion ===
        "washington",
    ).length;

  console.log("");
  console.log(
    "Publishing latest TMO market stats to website repository...",
  );
  console.log(
    `TMO report date: ${stats.reportDate}`,
  );
  console.log(
    `Markets: ${stats.markets.length}`,
  );
  console.log(
    `Oregon markets: ${oregonCount}`,
  );
  console.log(
    `Washington markets: ${washingtonCount}`,
  );
  console.log(
    `Destination: ${owner}/${repo}/${filePath}`,
  );

  const existingFile =
    await getExistingFile(
      apiUrl,
      token,
      branch,
    );

  const requestBody: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message:
      existingFile?.sha
        ? `Update website market stats: ${stats.reportDate}`
        : `Add website market stats: ${stats.reportDate}`,

    content:
      Buffer.from(
        json,
        "utf8",
      ).toString(
        "base64",
      ),

    branch,
  };

  if (existingFile?.sha) {
    requestBody.sha =
      existingFile.sha;
  }

  const response =
    await fetch(
      apiUrl,
      {
        method:
          "PUT",

        headers: {
          Accept:
            "application/vnd.github+json",

          Authorization:
            `Bearer ${token}`,

          "X-GitHub-Api-Version":
            "2022-11-28",

          "Content-Type":
            "application/json",

          "User-Agent":
            "weekly-price-drop-report",
        },

        body:
          JSON.stringify(
            requestBody,
          ),
      },
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Website market stats publish failed (${response.status}): ${errorText}`,
    );
  }

  const result =
    await response.json() as GitHubPutResponse;

  console.log(
    existingFile?.sha
      ? "Updated website market stats."
      : "Created website market stats.",
  );

  if (result.content?.html_url) {
    return result.content.html_url;
  }

  if (result.commit?.html_url) {
    return result.commit.html_url;
  }

  return (
    `https://github.com/` +
    `${owner}/${repo}/blob/` +
    `${branch}/${filePath}`
  );
}

function validateWebsiteMarketStats(
  stats: WebsiteMarketStats,
): void {
  if (
    stats.source !==
    "TMO"
  ) {
    throw new Error(
      "Website market stats payload has an invalid source.",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      stats.reportDate,
    )
  ) {
    throw new Error(
      `Website market stats payload has an invalid reportDate: ${stats.reportDate}`,
    );
  }

  if (
    !Array.isArray(
      stats.markets,
    ) ||
    stats.markets.length ===
      0
  ) {
    throw new Error(
      "Website market stats payload does not contain any markets.",
    );
  }

  for (const market of stats.markets) {
    if (
      market.sourceRegion !==
        "oregon" &&
      market.sourceRegion !==
        "washington"
    ) {
      throw new Error(
        `Website market stats contains a market without a valid sourceRegion: ${market.area}`,
      );
    }

    if (
      !market.area ||
      market.area ===
        "Unknown Area"
    ) {
      throw new Error(
        `Website market stats contains an invalid area on page ${market.page}.`,
      );
    }
  }
}

async function getExistingFile(
  apiUrl: string,
  token: string,
  branch: string,
): Promise<GitHubFileResponse | null> {
  const response =
    await fetch(
      `${apiUrl}?ref=${encodeURIComponent(
        branch,
      )}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/vnd.github+json",

          Authorization:
            `Bearer ${token}`,

          "X-GitHub-Api-Version":
            "2022-11-28",

          "User-Agent":
            "weekly-price-drop-report",
        },
      },
    );

  if (
    response.status ===
    404
  ) {
    return null;
  }

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Website market stats file check failed (${response.status}): ${errorText}`,
    );
  }

  return await response.json() as GitHubFileResponse;
}
