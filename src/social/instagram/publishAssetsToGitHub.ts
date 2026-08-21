import fs from "node:fs/promises";
import path from "node:path";

interface GitHubRefResponse {
  object: {
    sha: string;
  };
}

interface GitHubCommitResponse {
  sha: string;
  tree: {
    sha: string;
  };
}

interface GitHubBlobResponse {
  sha: string;
}

interface GitHubTreeResponse {
  sha: string;
}

interface GitHubCreateCommitResponse {
  sha: string;
  html_url?: string;
}

export interface PublishedInstagramAssets {
  commitUrl: string;
  imageUrls: string[];
}

export async function publishInstagramAssetsToGitHub(
  imagePaths: string[],
  slug: string,
  assetBaseUrl: string,
  githubRootPath: string,
): Promise<PublishedInstagramAssets> {
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

  if (!token) {
    throw new Error(
      "SITE_GITHUB_TOKEN is required to publish Instagram assets.",
    );
  }

  if (
    imagePaths.length < 2
  ) {
    throw new Error(
      "Instagram carousel publishing requires at least two images.",
    );
  }

  const ref =
    await githubRequest<GitHubRefResponse>(
      token,
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );

  const parentCommit =
    await githubRequest<GitHubCommitResponse>(
      token,
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${ref.object.sha}`,
    );

  const treeEntries:
    Array<{
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }> = [];

  for (
    const imagePath
    of imagePaths
  ) {
    const data =
      await fs.readFile(
        imagePath,
      );

    const blob =
      await githubRequest<GitHubBlobResponse>(
        token,
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        {
          method:
            "POST",
          body: {
            content:
              data.toString(
                "base64",
              ),
            encoding:
              "base64",
          },
        },
      );

    treeEntries.push({
      path:
        `${githubRootPath}/${slug}/${path.basename(imagePath)}`,
      mode:
        "100644",
      type:
        "blob",
      sha:
        blob.sha,
    });
  }

  const tree =
    await githubRequest<GitHubTreeResponse>(
      token,
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method:
          "POST",
        body: {
          base_tree:
            parentCommit.tree.sha,
          tree:
            treeEntries,
        },
      },
    );

  const commit =
    await githubRequest<GitHubCreateCommitResponse>(
      token,
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method:
          "POST",
        body: {
          message:
            `Publish Portland Home Guide Instagram carousel: ${slug}`,
          tree:
            tree.sha,
          parents: [
            parentCommit.sha,
          ],
        },
      },
    );

  await githubRequest(
    token,
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
    {
      method:
        "PATCH",
      body: {
        sha:
          commit.sha,
        force:
          false,
      },
    },
  );

  const normalizedBaseUrl =
    assetBaseUrl.replace(
      /\/+$/,
      "",
    );

  const imageUrls =
    imagePaths.map(
      (imagePath) =>
        `${normalizedBaseUrl}/${encodeURIComponent(slug)}/${encodeURIComponent(path.basename(imagePath))}`,
    );

  return {
    commitUrl:
      commit.html_url ||
      `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    imageUrls,
  };
}

async function githubRequest<T = unknown>(
  token: string,
  url: string,
  options: {
    method?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const response =
    await fetch(
      url,
      {
        method:
          options.method ||
          "GET",
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
          options.body === undefined
            ? undefined
            : JSON.stringify(
                options.body,
              ),
      },
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `GitHub Instagram asset publish failed (${response.status}): ${errorText}`,
    );
  }

  if (
    response.status === 204
  ) {
    return undefined as T;
  }

  return await response.json() as T;
}
