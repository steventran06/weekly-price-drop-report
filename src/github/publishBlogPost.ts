import type { GeneratedBlogPost } from "../blog/generateBlogPost.js";

interface GitHubFileResponse {
  sha?: string;
}

export async function publishBlogPost(
  post: GeneratedBlogPost,
): Promise<string> {
  const token =
    process.env.WEBSITE_GITHUB_TOKEN?.trim();

  const owner =
    process.env.WEBSITE_GITHUB_OWNER?.trim() ||
    "steventran06";

  const repo =
    process.env.WEBSITE_GITHUB_REPO?.trim() ||
    "steventranrealestate-blog";

  const branch =
    process.env.WEBSITE_GITHUB_BRANCH?.trim() ||
    "main";

  const postsPath =
    process.env.WEBSITE_POSTS_PATH?.trim() ||
    "src/content/blog";

  if (!token) {
    throw new Error(
      "WEBSITE_GITHUB_TOKEN is missing.",
    );
  }

  const filePath =
    `${postsPath}/${post.filename}`;

  const encodedPath = filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const apiUrl =
    `https://api.github.com/repos/` +
    `${owner}/${repo}/contents/${encodedPath}`;

  console.log(
    `Publishing blog post to ${owner}/${repo}/${filePath}...`,
  );

  /*
   * Check whether this week's file already exists.
   * GitHub requires the existing blob SHA when updating.
   */
  const existingFile = await getExistingFile(
    apiUrl,
    token,
    branch,
  );

  const body: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message:
      `Publish weekly price drops: ${post.filename}`,
    content: Buffer.from(
      post.markdown,
      "utf8",
    ).toString("base64"),
    branch,
  };

  if (existingFile?.sha) {
    body.sha = existingFile.sha;
  }

  const response = await fetch(apiUrl, {
    method: "PUT",

    headers: {
      Accept:
        "application/vnd.github+json",

      Authorization:
        `Bearer ${token}`,

      "X-GitHub-Api-Version":
        "2026-03-10",

      "Content-Type":
        "application/json",

      "User-Agent":
        "weekly-price-drop-report",
    },

    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `GitHub publish failed (${response.status}): ${errorText}`,
    );
  }

  const result =
    await response.json() as {
      content?: {
        html_url?: string;
      };
      commit?: {
        html_url?: string;
      };
    };

  console.log(
    existingFile
      ? "Updated existing weekly blog post."
      : "Created new weekly blog post.",
  );

  return (
    result.content?.html_url ||
    result.commit?.html_url ||
    `https://github.com/${owner}/${repo}/blob/${branch}/${filePath}`
  );
}

async function getExistingFile(
  apiUrl: string,
  token: string,
  branch: string,
): Promise<GitHubFileResponse | null> {
  const url =
    `${apiUrl}?ref=${encodeURIComponent(
      branch,
    )}`;

  const response = await fetch(url, {
    method: "GET",

    headers: {
      Accept:
        "application/vnd.github+json",

      Authorization:
        `Bearer ${token}`,

      "X-GitHub-Api-Version":
        "2026-03-10",

      "User-Agent":
        "weekly-price-drop-report",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `GitHub file check failed (${response.status}): ${errorText}`,
    );
  }

  return await response.json() as GitHubFileResponse;
}