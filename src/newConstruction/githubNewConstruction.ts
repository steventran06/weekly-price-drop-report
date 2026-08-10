import type {
  NewConstructionData,
} from "./types.js";

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

interface WebsiteFileContext {
  apiUrl: string;
  branch: string;
  filePath: string;
  owner: string;
  repo: string;
  sha: string;
  token: string;
}

export interface LoadedWebsiteNewConstruction {
  data: NewConstructionData;
  context: WebsiteFileContext;
}

export async function loadWebsiteNewConstruction(): Promise<LoadedWebsiteNewConstruction> {
  const token = requireEnv("SITE_GITHUB_TOKEN");
  const owner =
    process.env.SITE_GITHUB_OWNER?.trim() ||
    "steventran06";
  const repo =
    process.env.SITE_GITHUB_REPO?.trim() ||
    "steventranrealestate";
  const branch =
    process.env.SITE_GITHUB_BRANCH?.trim() ||
    "main";
  const filePath = (
    process.env.SITE_NEW_CONSTRUCTION_PATH?.trim() ||
    "data/new-construction.json"
  ).replace(/^\/+/, "");

  const encodedPath = filePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const apiUrl =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

  const response = await fetch(
    `${apiUrl}?ref=${encodeURIComponent(branch)}`,
    {
      headers: githubHeaders(token),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Could not load website new-construction data (${response.status}): ${errorText}`,
    );
  }

  const file = await response.json() as GitHubFileResponse;

  if (!file.sha || !file.content) {
    throw new Error(
      "GitHub response did not include the new-construction file content and SHA.",
    );
  }

  const raw = Buffer.from(
    file.content.replace(/\n/g, ""),
    file.encoding === "base64" ? "base64" : "utf8",
  ).toString("utf8");

  let data: NewConstructionData;

  try {
    data = JSON.parse(raw) as NewConstructionData;
  } catch {
    throw new Error(
      `Website ${filePath} is not valid JSON. Refusing to research or publish.`,
    );
  }

  validateBaseline(data);

  return {
    data,
    context: {
      apiUrl,
      branch,
      filePath,
      owner,
      repo,
      sha: file.sha,
      token,
    },
  };
}

export async function publishWebsiteNewConstruction(
  data: NewConstructionData,
  context: WebsiteFileContext,
): Promise<string> {
  const json = `${JSON.stringify(data, null, 2)}\n`;
  JSON.parse(json);

  const requestBody = {
    message: `Update new construction directory: ${data.lastVerified}`,
    content: Buffer.from(json, "utf8").toString("base64"),
    branch: context.branch,
    sha: context.sha,
  };

  const response = await fetch(
    context.apiUrl,
    {
      method: "PUT",
      headers: {
        ...githubHeaders(context.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Website new-construction publish failed (${response.status}): ${errorText}`,
    );
  }

  const result = await response.json() as GitHubPutResponse;

  return (
    result.content?.html_url ||
    result.commit?.html_url ||
    `https://github.com/${context.owner}/${context.repo}/blob/${context.branch}/${context.filePath}`
  );
}

function validateBaseline(data: NewConstructionData): void {
  if (!Array.isArray(data.builders) || data.builders.length === 0) {
    throw new Error(
      "Website new-construction data has no builders. Refusing to continue.",
    );
  }

  if (!Array.isArray(data.communities)) {
    throw new Error(
      "Website new-construction data has an invalid communities array.",
    );
  }

  const builderIds = new Set<string>();

  for (const builder of data.builders) {
    if (!builder.id || !builder.name || !builder.domain) {
      throw new Error(
        "Every builder must have id, name, and domain before automated research can run.",
      );
    }

    if (builderIds.has(builder.id)) {
      throw new Error(
        `Duplicate builder id in website data: ${builder.id}`,
      );
    }

    builderIds.add(builder.id);
  }

  for (const community of data.communities) {
    if (!builderIds.has(community.builderId)) {
      throw new Error(
        `Community ${community.name} references unknown builder ${community.builderId}.`,
      );
    }
  }
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "weekly-price-drop-report",
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is required for the new-construction research workflow.`,
    );
  }

  return value;
}
