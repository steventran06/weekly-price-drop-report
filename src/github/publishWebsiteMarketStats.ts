import type {
  WebsiteMarketStats,
} from "../marketStats/buildWebsiteMarketStats.js";

import type {
  MarketStats,
  MarketStatsRegion,
} from "../marketStats/extractMarketStats.js";

interface GitHubFileResponse {
  sha?: string;
  content?: string;
  encoding?: string;
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
  incomingStats: WebsiteMarketStats,
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

  if (
    !token
  ) {
    throw new Error(
      "SITE_GITHUB_TOKEN is required to publish website market stats.",
    );
  }

  validateWebsiteMarketStats(
    incomingStats,
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

  const existingFile =
    await getExistingFile(
      apiUrl,
      token,
      branch,
    );

  const existingStats =
    parseExistingWebsiteMarketStats(
      existingFile,
    );

  const stats =
    mergeWebsiteMarketStats(
      incomingStats,
      existingStats,
    );

  validateWebsiteMarketStats(
    stats,
  );

  const json =
    JSON.stringify(
      stats,
      null,
      2,
    ) + "\n";

  JSON.parse(
    json,
  );

  const incomingRegions =
    getRegions(
      incomingStats.markets,
    );

  const existingRegions =
    getRegions(
      existingStats?.markets ??
      [],
    );

  console.log("");
  console.log(
    "Publishing latest TMO market stats to website repository...",
  );

  for (
    const region
    of [
      "oregon",
      "washington",
    ] as const
  ) {
    const label =
      region ===
      "oregon"
        ? "Oregon"
        : "Washington";

    if (
      incomingRegions.has(
        region,
      )
    ) {
      console.log(
        `${label}: updating with current parsed data.`,
      );

      continue;
    }

    if (
      existingRegions.has(
        region,
      )
    ) {
      console.log(
        `${label}: current data unavailable; preserving existing website data.`,
      );

      continue;
    }

    console.log(
      `${label}: no current or existing website data available.`,
    );
  }

  console.log(
    `TMO report date: ${stats.reportDate}`,
  );

  console.log(
    `Markets: ${stats.markets.length}`,
  );

  console.log(
    `Oregon markets: ${countRegion(stats.markets, "oregon")}`,
  );

  console.log(
    `Washington markets: ${countRegion(stats.markets, "washington")}`,
  );

  console.log(
    `Destination: ${owner}/${repo}/${filePath}`,
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

  if (
    existingFile?.sha
  ) {
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

  if (
    !response.ok
  ) {
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

  if (
    result.content?.html_url
  ) {
    return result.content.html_url;
  }

  if (
    result.commit?.html_url
  ) {
    return result.commit.html_url;
  }

  return (
    `https://github.com/` +
    `${owner}/${repo}/blob/` +
    `${branch}/${filePath}`
  );
}

function mergeWebsiteMarketStats(
  incoming: WebsiteMarketStats,
  existing: WebsiteMarketStats | null,
): WebsiteMarketStats {
  if (
    !existing
  ) {
    return incoming;
  }

  const updatedRegions =
    getRegions(
      incoming.markets,
    );

  const preservedMarkets =
    existing.markets.filter(
      (market) =>
        market.sourceRegion &&
        !updatedRegions.has(
          market.sourceRegion,
        ),
    );

  const markets = [
    ...incoming.markets,
    ...preservedMarkets,
  ].sort(
    (a, b) => {
      const regionCompare =
        String(
          a.sourceRegion ??
          "",
        ).localeCompare(
          String(
            b.sourceRegion ??
            "",
          ),
        );

      if (
        regionCompare !==
        0
      ) {
        return regionCompare;
      }

      return (
        a.page -
        b.page
      );
    },
  );

  const regionReportDates = {
    oregon:
      updatedRegions.has(
        "oregon",
      )
        ? incoming.regionReportDates?.oregon ??
          deriveRegionReportDate(
            incoming.markets,
            "oregon",
          ) ??
          undefined
        : existing.regionReportDates?.oregon ??
          deriveRegionReportDate(
            existing.markets,
            "oregon",
          ) ??
          undefined,

    washington:
      updatedRegions.has(
        "washington",
      )
        ? incoming.regionReportDates?.washington ??
          deriveRegionReportDate(
            incoming.markets,
            "washington",
          ) ??
          undefined
        : existing.regionReportDates?.washington ??
          deriveRegionReportDate(
            existing.markets,
            "washington",
          ) ??
          undefined,
  };

  const reportDate =
    latestIsoDate(
      [
        incoming.reportDate,
        existing.reportDate,
        regionReportDates.oregon,
        regionReportDates.washington,
      ],
    ) ??
    incoming.reportDate;

  return {
    source:
      "TMO",

    reportDate,

    generatedAt:
      new Date()
        .toISOString(),

    regionReportDates,

    markets,
  };
}

function parseExistingWebsiteMarketStats(
  file: GitHubFileResponse | null,
): WebsiteMarketStats | null {
  if (
    !file?.content
  ) {
    return null;
  }

  if (
    file.encoding &&
    file.encoding !==
      "base64"
  ) {
    throw new Error(
      `Existing website market stats used unsupported encoding ${file.encoding}; refusing to publish because regional preservation cannot be guaranteed.`,
    );
  }

  try {
    const json =
      Buffer.from(
        file.content.replace(
          /\s+/g,
          "",
        ),
        "base64",
      ).toString(
        "utf8",
      );

    const parsed =
      JSON.parse(
        json,
      ) as WebsiteMarketStats;

    validateWebsiteMarketStats(
      parsed,
    );

    return parsed;
  } catch (
    error
  ) {
    const message =
      error instanceof Error
        ? error.message
        : String(
            error,
          );

    throw new Error(
      "Could not safely read the existing website market stats. " +
        "Refusing to publish because doing so could erase a regional dataset. " +
        message,
    );
  }
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

  for (
    const market
    of stats.markets
  ) {
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

  if (
    !response.ok
  ) {
    const errorText =
      await response.text();

    throw new Error(
      `Website market stats file check failed (${response.status}): ${errorText}`,
    );
  }

  return await response.json() as GitHubFileResponse;
}

function getRegions(
  markets: MarketStats[],
): Set<MarketStatsRegion> {
  const regions =
    new Set<MarketStatsRegion>();

  for (
    const market
    of markets
  ) {
    if (
      market.sourceRegion ===
        "oregon" ||
      market.sourceRegion ===
        "washington"
    ) {
      regions.add(
        market.sourceRegion,
      );
    }
  }

  return regions;
}

function countRegion(
  markets: MarketStats[],
  region: MarketStatsRegion,
): number {
  return markets.filter(
    (market) =>
      market.sourceRegion ===
      region,
  ).length;
}

function deriveRegionReportDate(
  markets: MarketStats[],
  region: MarketStatsRegion,
): string | null {
  const timestamps =
    markets
      .filter(
        (market) =>
          market.sourceRegion ===
          region &&
          Boolean(
            market.reportDate,
          ),
      )
      .map(
        (market) => {
          const parsed =
            Date.parse(
              market.reportDate ??
              "",
            );

          return Number.isFinite(
            parsed,
          )
            ? parsed
            : null;
        },
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      )
      .sort(
        (a, b) =>
          b - a,
      );

  if (
    timestamps.length ===
    0
  ) {
    return null;
  }

  const date =
    new Date(
      timestamps[0],
    );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() +
      1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getUTCDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join(
    "-",
  );
}

function latestIsoDate(
  values: Array<
    string |
    null |
    undefined
  >,
): string | null {
  const dates =
    values
      .filter(
        (
          value,
        ): value is string =>
          Boolean(
            value &&
            /^\d{4}-\d{2}-\d{2}$/.test(
              value,
            ),
          ),
      )
      .sort()
      .reverse();

  return (
    dates[0] ??
    null
  );
}
