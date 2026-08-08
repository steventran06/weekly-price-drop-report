interface PublishableBlogPost {
  filename: string;
  markdown: string;
}

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

export async function publishBlogPost(
  post: PublishableBlogPost,
): Promise<string> {
  const token =
    process.env.BLOG_GITHUB_TOKEN?.trim();

  const owner =
    process.env.BLOG_GITHUB_OWNER?.trim() ||
    "steventran06";

  const repo =
    process.env.BLOG_GITHUB_REPO?.trim() ||
    "steventranrealestate-blog";

  const branch =
    process.env.BLOG_GITHUB_BRANCH?.trim() ||
    "main";

  const postsPath =
    process.env.BLOG_POSTS_PATH?.trim() ||
    "src/content/blog";

  if (
    !token
  ) {
    throw new Error(
      "BLOG_GITHUB_TOKEN is missing.",
    );
  }

  if (!post.filename?.trim()) {
    throw new Error(
      "Blog post filename is missing.",
    );
  }

  if (!post.markdown?.trim()) {
    throw new Error(
      "Blog post markdown is empty.",
    );
  }

  const normalizedPostsPath =
    postsPath.replace(
      /^\/+|\/+$/g,
      "",
    );

  const filePath =
    `${normalizedPostsPath}/${post.filename}`;

  const encodedPath =
    filePath
      .split("/")
      .map(
        (part) =>
          encodeURIComponent(part),
      )
      .join("/");

  const apiUrl =
    `https://api.github.com/repos/` +
    `${owner}/${repo}/contents/${encodedPath}`;

  console.log(
    `Publishing blog post to ${owner}/${repo}/${filePath}...`,
  );

  /*
   * GitHub requires the existing file SHA
   * if we're updating a file that already exists.
   */
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
        post.filename,
        Boolean(
          existingFile?.sha,
        ),
      ),

    content:
      Buffer.from(
        post.markdown,
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
        method: "PUT",

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
      `GitHub publish failed (${response.status}): ${errorText}`,
    );
  }

  const result =
    await response.json() as GitHubPutResponse;

  if (existingFile?.sha) {
    console.log(
      "Updated existing blog post.",
    );
  } else {
    console.log(
      "Created new blog post.",
    );
  }

  const htmlUrl =
    result.content?.html_url;

  const commitUrl =
    result.commit?.html_url;

  if (htmlUrl) {
    return htmlUrl;
  }

  if (commitUrl) {
    return commitUrl;
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
        method: "GET",

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
    response.status === 404
  ) {
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

function createCommitMessage(
  filename: string,
  isUpdate: boolean,
): string {
  if (isUpdate) {
    return (
      `Update generated blog post: ` +
      filename
    );
  }

  return (
    `Publish generated blog post: ` +
    filename
  );
}
