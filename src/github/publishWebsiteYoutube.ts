import {
  validateWebsiteYoutube,
} from "../youtube/buildWebsiteYoutube.js";
import type {
  YoutubeWebsiteFile,
} from "../youtube/types.js";

interface GitHubFileResponse {
  sha?: string;
  content?: string;
  encoding?: string;
}

interface GitHubPutResponse {
  content?: { html_url?: string };
  commit?: { html_url?: string };
}

export async function getExistingWebsiteYoutube(): Promise<YoutubeWebsiteFile | null> {
  const config = getGithubConfig();
  const apiUrl = getApiUrl(config.owner, config.repo, config.filePath);
  const existingFile = await getExistingFile(
    apiUrl,
    config.token,
    config.branch,
  );

  if (!existingFile?.content) {
    return null;
  }

  if (existingFile.encoding && existingFile.encoding !== "base64") {
    throw new Error(
      `Unexpected GitHub encoding for youtube.json: ${existingFile.encoding}`,
    );
  }

  try {
    const text = Buffer.from(existingFile.content, "base64").toString("utf8");
    return JSON.parse(text) as YoutubeWebsiteFile;
  } catch (error) {
    throw new Error(
      `Could not parse existing website youtube.json: ${formatError(error)}`,
    );
  }
}

export async function publishWebsiteYoutube(
  data: YoutubeWebsiteFile,
): Promise<string> {
  validateWebsiteYoutube(data);

  const config = getGithubConfig();
  const apiUrl = getApiUrl(config.owner, config.repo, config.filePath);
  const existingFile = await getExistingFile(
    apiUrl,
    config.token,
    config.branch,
  );

  const json = `${JSON.stringify(data, null, 2)}\n`;
  JSON.parse(json);

  console.log("");
  console.log("Publishing YouTube data to website repository...");
  console.log(`Destination: ${config.owner}/${config.repo}/${config.filePath}`);

  const requestBody: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message: existingFile?.sha
      ? `Update website YouTube data: ${data.generatedAt.slice(0, 10)}`
      : `Add website YouTube data: ${data.generatedAt.slice(0, 10)}`,
    content: Buffer.from(json, "utf8").toString("base64"),
    branch: config.branch,
  };

  if (existingFile?.sha) {
    requestBody.sha = existingFile.sha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${config.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "weekly-price-drop-report-youtube",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      `Website YouTube publish failed (${response.status}): ${await response.text()}`,
    );
  }

  const result = (await response.json()) as GitHubPutResponse;

  console.log(
    existingFile?.sha
      ? "Updated website YouTube data."
      : "Created website YouTube data.",
  );

  return (
    result.content?.html_url ??
    result.commit?.html_url ??
    `https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${config.filePath}`
  );
}

function getGithubConfig(): {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
} {
  const token = process.env.SITE_GITHUB_TOKEN?.trim();
  const owner = process.env.SITE_GITHUB_OWNER?.trim() || "steventran06";
  const repo = process.env.SITE_GITHUB_REPO?.trim() || "steventranrealestate";
  const branch = process.env.SITE_GITHUB_BRANCH?.trim() || "main";
  const filePath =
    (process.env.SITE_YOUTUBE_PATH?.trim() || "data/youtube.json")
      .replace(/^\/+/, "");

  if (!token) {
    throw new Error("SITE_GITHUB_TOKEN is required to publish YouTube data.");
  }

  return { token, owner, repo, branch, filePath };
}

function getApiUrl(owner: string, repo: string, filePath: string): string {
  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
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
      "User-Agent": "weekly-price-drop-report-youtube",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Website YouTube file check failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as GitHubFileResponse;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
