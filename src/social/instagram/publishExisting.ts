import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

import type {
  RenderedInstagramCarousel,
} from "./types.js";

import {
  getInstagramAutomationConfig,
} from "./config.js";

import {
  publishInstagramCarousel,
} from "./instagramClient.js";

import {
  publishInstagramAssetsToGitHub,
} from "./publishAssetsToGitHub.js";

import {
  waitForPublicAssets,
} from "./waitForPublicAssets.js";

dotenv.config();

interface Manifest {
  reportDate: string;
  slug: string;
  caption: string;
  images: string[];
}

async function main(): Promise<void> {
  const config =
    getInstagramAutomationConfig();

  if (!config.assetBaseUrl) {
    throw new Error(
      "INSTAGRAM_ASSET_BASE_URL is required.",
    );
  }

  if (
    !config.userId ||
    !config.accessToken
  ) {
    throw new Error(
      "INSTAGRAM_USER_ID and INSTAGRAM_ACCESS_TOKEN are required.",
    );
  }

  const rendered =
    await loadLatestRenderedCarousel();

  const assets =
    await publishInstagramAssetsToGitHub(
      rendered.imagePaths,
      rendered.slug,
      config.assetBaseUrl,
      config.githubPath,
    );

  console.log(
    `Published Instagram assets: ${assets.commitUrl}`,
  );

  await waitForPublicAssets(
    assets.imageUrls,
  );

  const mediaId =
    await publishInstagramCarousel({
      apiVersion:
        config.apiVersion,
      userId:
        config.userId,
      accessToken:
        config.accessToken,
      imageUrls:
        assets.imageUrls,
      caption:
        rendered.caption,
    });

  console.log(
    `Instagram carousel published. Media ID: ${mediaId}`,
  );
}

async function loadLatestRenderedCarousel(): Promise<RenderedInstagramCarousel> {
  const instagramDirectory =
    path.join(
      process.cwd(),
      "output",
      "market-stats",
      "instagram",
    );

  const entries =
    await fs.readdir(
      instagramDirectory,
      {
        withFileTypes:
          true,
      },
    );

  const directories =
    entries
      .filter(
        (entry) =>
          entry.isDirectory(),
      )
      .map(
        (entry) =>
          entry.name,
      )
      .sort()
      .reverse();

  const slug =
    directories[0];

  if (!slug) {
    throw new Error(
      "No rendered Instagram carousel found. Run npm run instagram:preview first.",
    );
  }

  const outputDirectory =
    path.join(
      instagramDirectory,
      slug,
    );

  const manifestPath =
    path.join(
      outputDirectory,
      "manifest.json",
    );

  const manifest =
    JSON.parse(
      await fs.readFile(
        manifestPath,
        "utf8",
      ),
    ) as Manifest;

  const imagePaths =
    manifest.images.map(
      (filename) =>
        path.join(
          outputDirectory,
          filename,
        ),
    );

  return {
    outputDirectory,
    reportDate:
      manifest.reportDate,
    slug:
      manifest.slug,
    caption:
      manifest.caption,
    imagePaths,
    svgPaths: [],
    manifestPath,
  };
}

main().catch(
  (error) => {
    console.error("");
    console.error(
      "Instagram publish failed:",
    );
    console.error(
      error instanceof Error
        ? error.message
        : String(error),
    );
    process.exitCode = 1;
  },
);
