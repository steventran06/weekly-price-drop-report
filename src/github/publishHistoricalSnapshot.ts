import fs from "node:fs/promises";
import path from "node:path";

export type HistoricalSnapshotType =
  | "market-stats"
  | "price-drops";

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

export async function publishHistoricalSnapshot(
  type: HistoricalSnapshotType,
  localFilePath: string,
): Promise<string> {
  const token =
    process.env.HISTORY_GITHUB_TOKEN?.trim() ||
    process.env.WEBSITE_GITHUB_TOKEN?.trim();

  const owner =
    process.env.HISTORY_GITHUB_OWNER?.trim() ||
    process.env.WEBSITE_GITHUB_OWNER?.trim() ||
    "steventran06";

  const repo =
    process.env.HISTORY_GITHUB_REPO?.trim() ||
    "weekly-price-drop-report";

  const branch =
    process.env.HISTORY_GITHUB_BRANCH?.trim() ||
    "main";

  const historyPath =
    process.env.HISTORY_GITHUB_PATH?.trim() ||
    "data";

  if (!token) {
    throw new Error(
      "HISTORY_GITHUB_TOKEN or WEBSITE_GITHUB_TOKEN is required.",
    );
  }

  const filename =
    path.basename(
      localFilePath,
    );

  if (
    !/^\d{4}-\d{2}-\d{2}\.json$/.test(
      filename,
    )
  ) {
    throw new Error(
      `Historical snapshot filename must use YYYY-MM-DD.json format. Received: ${filename}`,
    );
  }

  const year =
    filename.slice(
      0,
      4,
    );

  const json =
    await fs.readFile(
      localFilePath,
      "utf8",
    );

  if (
    !json.trim()
  ) {
    throw new Error(
      "Historical snapshot JSON is empty.",
    );
  }

  /*
   * Validate JSON before publishing.
   */
  JSON.parse(
    json,
  );

  const normalizedHistoryPath =
    historyPath.replace(
      /^\/+|\/+$/g,
      "",
    );

  const filePath =
    `${normalizedHistoryPath}/${type}/${year}/${filename}`;

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

  console.log(
    `Publishing historical snapshot to ${owner}/${repo}/${filePath}...`,
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
      createCommitMessage(
        type,
        filename,
        Boolean(
          existingFile?.sha,
        ),
      ),

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
      `GitHub historical snapshot publish failed (${response.status}): ${errorText}`,
    );
  }

  const result =
    await response.json() as GitHubPutResponse;

  if (
    existingFile?.sha
  ) {
    console.log(
      `Updated existing ${type} historical snapshot.`,
    );
  } else {
    console.log(
      `Created new ${type} historical snapshot.`,
    );
  }

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

async function getExistingFile(
  apiUrl: string,
  token: string,
  branch: string,
): Promise<GitHubFileResponse | null> {
  const url =
    `${apiUrl}?ref=` +
    encodeURIComponent(
      branch,
    );

  const response =
    await fetch(
      url,
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
      `GitHub historical file check failed (${response.status}): ${errorText}`,
    );
  }

  return await response.json() as GitHubFileResponse;
}

function createCommitMessage(
  type: HistoricalSnapshotType,
  filename: string,
  isUpdate: boolean,
): string {
  const label =
    type === "market-stats"
      ? "market stats"
      : "price drops";

  if (
    isUpdate
  ) {
    return (
      `Update historical ${label}: ` +
      filename
    );
  }

  return (
    `Save historical ${label}: ` +
    filename
  );
}